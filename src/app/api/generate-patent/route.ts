import { NextRequest, NextResponse } from 'next/server';
import {
  getChatClient,
  tryImageClient,
  trySearchClient,
  type ChatClient,
} from '@/lib/ai';
import { errorResponse, publicErrorMessage } from '@/lib/api-helpers';
import { patentHistoryManager } from '@/storage/database';

interface PatentSection {
  title: string;
  content: string;
  images?: string[];
}

interface Reference {
  text: string;
  url?: string;
}

// 辅助函数：带超时和重试的LLM调用
async function invokeLLMWithRetry(
  llmClient: ChatClient,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: { model: string; temperature?: number },
  stage: string,
  maxRetries: number = 3,
  timeoutMs: number = 180000 // 默认3分钟超时
): Promise<{ content: string }> {
  let lastError: Error | null = null;
  const startTime = Date.now();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      console.log(`[${stage}] 尝试第 ${attempt}/${maxRetries} 次调用... 超时时间: ${timeoutMs}ms`);

      // 使用 Promise.race 实现超时控制
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`调用超时（${timeoutMs}ms）`));
        }, timeoutMs);
      });

      const response = await Promise.race([llmClient.invoke(messages, options), timeoutPromise]);
      const elapsed = Date.now() - startTime;

      console.log(`[${stage}] 第 ${attempt} 次调用成功，耗时: ${elapsed}ms`);
      return response;
    } catch (error) {
      lastError = error as Error;
      const elapsed = Date.now() - startTime;
      console.error(`[${stage}] 第 ${attempt} 次调用失败 (耗时${elapsed}ms):`, error);

      // 如果不是最后一次尝试，等待后重试
      if (attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt) * 1000; // 指数退避
        console.log(`[${stage}] 等待 ${waitTime}ms 后重试...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  // 所有重试都失败，抛出最后一个错误
  throw new Error(`[${stage}] LLM调用失败（已重试${maxRetries}次）: ${lastError?.message}`);
}

export async function POST(request: NextRequest) {
  let body: any = null;
  try {
    // 从请求头获取用户ID
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: '用户未登录' },
        { status: 401 }
      );
    }

    try {
      body = await request.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return NextResponse.json(
        { error: '无效的请求格式' },
        { status: 400 }
      );
    }

    const { title, field, background, content, solution, taskId } = body;

    // 验证必填字段
    if (!title || !content) {
      return NextResponse.json(
        { error: '发明名称和发明内容为必填项' },
        { status: 400 }
      );
    }

    // 对话模型是必需能力；搜索与图像为可选，未配置时对应步骤自动跳过
    const { client: llmClient, config: llmConfig } = await getChatClient(userId);
    const searchClient = await trySearchClient(userId);
    const imageClient = await tryImageClient(userId);

    if (!searchClient) {
      console.warn('[生成] 未配置联网搜索服务，将跳过文献检索步骤');
    }
    if (!imageClient) {
      console.warn('[生成] 未配置图像生成服务，将跳过专利附图绘制');
    }

    // 如果提供了taskId，更新任务状态为generating
    if (taskId) {
      await patentHistoryManager.updateTaskStatus(taskId, 'generating', {
        progress: 0,
        currentStage: '准备中',
      });
    }

    // 创建 ReadableStream 并流式输出
    const encoder = new TextEncoder();
    let fullContent = '';
    const sectionsData: any = {};
    const drawingImages: string[] = [];
    const referencesList: Reference[] = [];
    let clientDisconnected = false;

    // 辅助函数：更新任务状态（不依赖SSE连接）
    const updateTaskProgress = async (stage: string, message: string, progress: number) => {
      if (taskId) {
        await patentHistoryManager.updateTaskStatus(taskId, 'generating', {
          progress,
          currentStage: `${stage} - ${message}`,
        }).catch(err => console.error('Failed to update task status:', err));
      }
    };

    // 辅助函数：发送进度到SSE
    const sendProgress = async (
      controller: ReadableStreamDefaultController,
      encoder: TextEncoder,
      stage: string,
      message: string,
      progress: number
    ) => {
      // 先更新任务状态（等待完成）
      await updateTaskProgress(stage, message, progress);

      // 如果客户端已断开，跳过发送
      if (clientDisconnected) {
        return;
      }

      try {
        const chunk = JSON.stringify({
          type: 'progress',
          stage,
          message,
          progress,
        }) + '\n\n';
        controller.enqueue(encoder.encode(chunk));
      } catch (error) {
        // 如果发送失败（如客户端断开连接），静默处理，不影响生成流程
        console.log('Failed to send progress (client may have disconnected):', error);
        clientDisconnected = true;
      }
    };

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          await sendProgress(
            controller,
            encoder,
            '正在分析发明信息',
            '读取并解析用户输入的发明数据',
            5
          );

          const systemPrompt = `你是一位资深的专利代理人和技术写作专家，拥有10年以上的专利申请撰写经验。请严格按照用户要求的格式和顺序生成专利申请文件的各个部分。`;

          // ========== 第1步：联网搜索相关专利（50篇以上）==========
          await sendProgress(
            controller,
            encoder,
            '正在搜索相关专利',
            '联网搜索与发明内容相关的专利文献',
            10
          );

          const searchQuery = `${title} ${field ? field + ' ' : ''}专利 发明 专利技术`;
          const searchCount = 50;

          const patentReferences: Reference[] = [];

          if (searchClient) {
            console.log('开始搜索，查询词:', searchQuery, '数量:', searchCount);
            try {
              const searchResponse = await searchClient.webSearch(searchQuery, searchCount, true);
              console.log('搜索结果数量:', searchResponse.web_items?.length || 0);

              for (const item of searchResponse.web_items ?? []) {
                patentReferences.push({
                  text: item.title + (item.snippet ? `: ${item.snippet.substring(0, 100)}...` : ''),
                  url: item.url,
                });
              }
            } catch (searchError) {
              // 检索失败不应阻断正文生成
              console.error('联网检索失败，继续生成:', searchError);
            }
          }

          // 发送参考来源
          await sendProgress(
            controller,
            encoder,
            '正在整理参考来源',
            `已找到 ${patentReferences.length} 篇相关专利文献`,
            15
          );

          try {
            const referencesData = JSON.stringify({
              type: 'references',
              data: patentReferences,
            }) + '\n\n';
            if (!clientDisconnected) {
              controller.enqueue(encoder.encode(referencesData));
            }
          } catch (error) {
            console.log('Failed to send references (client may have disconnected)');
            clientDisconnected = true;
          }

          fullContent += `### 参考来源\n\n`;
          patentReferences.forEach((ref, index) => {
            fullContent += `[${index + 1}] ${ref.text}\nURL: ${ref.url || '无'}\n\n`;
          });

          referencesList.push(...patentReferences);

          // 实时保存参考来源到数据库
          if (taskId) {
            patentHistoryManager.updateGeneratedContent(taskId, {
              references: referencesList,
            }).catch(err => console.error('Failed to save references:', err));
          }

          // ========== 第2步：分析差异化并整理==========
          await sendProgress(
            controller,
            encoder,
            '正在分析专利差异化',
            '阅读搜索结果，分析现有专利的优缺点',
            20
          );

          const patentSummary = patentReferences
            .slice(0, 10)
            .map((ref, index) => `[${index + 1}] ${ref.text}`)
            .join('\n');

          const differentiationPrompt = `请根据以下专利信息，分析本发明与现有专利的【差异化优势】，字数约800-1000字：

本发明信息：
发明名称：${title}
技术领域：${field || '请根据发明内容推断'}
发明内容：${content}

相关专利文献（前10篇）：
${patentSummary}

要求：
1. 分析现有专利的主要技术方案和特点
2. 指出本发明与现有专利的主要差异点
3. 突出本发明的创新性和技术优势
4. 说明本发明解决了现有技术中的哪些问题
5. 为后续撰写权利要求书提供差异化依据
6. 使用专业的专利术语和分析方法`;

          const differentiationResponse = await invokeLLMWithRetry(
            llmClient,
            [
              { role: 'system' as const, content: systemPrompt },
              { role: 'user' as const, content: differentiationPrompt },
            ],
            { model: llmConfig.model, temperature: llmConfig.temperature },
            '差异化分析',
            3,
            120000 // 2分钟超时
          );

          await sendProgress(
            controller,
            encoder,
            '差异化分析完成',
            '已整理出本发明的差异化优势',
            25
          );

          const differentiationContent = differentiationResponse.content;

          // ========== 第3步：生成摘要（300-400字）==========
          await sendProgress(
            controller,
            encoder,
            '正在生成摘要',
            '调用文本生成工具，创作专利摘要（300-400字）',
            30
          );

          const summaryPrompt = `请根据以下发明信息和差异化分析，生成【摘要】部分，严格控制在300-400字之间：

发明名称：${title}
技术领域：${field || '请根据发明内容推断'}
发明内容：${content}

差异化分析：
${differentiationContent}

要求：
1. 严格控制在300-400字之间（不含标点）
2. 简洁概括发明的技术领域、技术方案和有益效果
3. 突出发明的创新点和实用性
4. 基于差异化分析，突出本发明的优势
5. 使用专业、规范的专利语言
6. 确保摘要完整、准确、精炼`;

          const summaryResponse = await invokeLLMWithRetry(
            llmClient,
            [
              { role: 'system' as const, content: systemPrompt },
              { role: 'user' as const, content: summaryPrompt },
            ],
            { model: llmConfig.model, temperature: llmConfig.temperature },
            '生成摘要',
            3,
            120000 // 2分钟超时
          );

          const summarySection = {
            name: 'summary',
            title: '摘要',
            content: summaryResponse.content,
          };
          sectionsData.summary = {
            title: '摘要',
            content: summaryResponse.content,
          };
          fullContent += `### 摘要\n\n${summaryResponse.content}\n\n`;

          // 实时保存摘要到数据库
          if (taskId) {
            patentHistoryManager.updateGeneratedContent(taskId, {
              patentTitle: title,
              summaryTitle: summarySection.title,
              summaryContent: summaryResponse.content,
            }).catch(err => console.error('Failed to save summary:', err));
          }

          try {
            const summaryData = JSON.stringify({
              type: 'section',
              data: summarySection,
            }) + '\n\n';
            if (!clientDisconnected) {
              controller.enqueue(encoder.encode(summaryData));
            }
          } catch (error) {
            console.log('Failed to send summary section (client may have disconnected)');
            clientDisconnected = true;
          }

          // ========== 第4步：生成发明专利说明书（8000字以上）==========
          await sendProgress(
            controller,
            encoder,
            '正在生成发明专利说明书',
            '分多次生成详细的发明专利说明书（8000字以上）',
            35
          );

          const descriptionParts = [];
          const partPrompts = [
            {
              title: '技术领域与背景技术',
              prompt: `请根据以下发明信息和差异化分析，生成【发明专利说明书】的第1部分，包含"技术领域"和"背景技术"两个小标题，总字数约1500-2000字：

发明名称：${title}
技术领域：${field || '请根据发明内容推断'}
背景技术：${background || '请根据发明内容推断'}
发明内容：${content}

差异化分析：
${differentiationContent}

要求：
1. 【技术领域】（约300-500字）：明确说明发明所属或应用的技术领域
2. 【背景技术】（约1200-1500字）：详细介绍相关领域的现有技术状况，引用搜索到的专利文献，分析现有技术存在的问题和不足
3. 基于差异化分析，强调现有技术的不足
4. 逻辑清晰，层次分明`,
            },
            {
              title: '发明内容',
              prompt: `请根据以下发明信息和差异化分析，生成【发明专利说明书】的第2部分"发明内容"，总字数约3000-3500字：

发明名称：${title}
发明内容：${content}

差异化分析：
${differentiationContent}

要求：
1. 按照以下结构生成：
   - 要解决的技术问题（约500-800字）
   - 技术方案（约2000-2500字）
   - 有益效果（约500-800字）
2. 技术方案要详细描述发明的各个组成部分、技术特征和相互关系
3. 有益效果要具体说明技术优势和应用价值
4. 基于差异化分析，突出本发明的创新点
5. 使用专业、准确的专利术语`,
            },
            {
              title: '具体实施方式',
              prompt: `请根据以下发明信息和差异化分析，生成【发明专利说明书】的第3部分"具体实施方式"，总字数约3500-4000字：

发明名称：${title}
发明内容：${content}
具体实施方式：${solution || '请根据发明内容详细描述'}

差异化分析：
${differentiationContent}

要求：
1. 详细描述发明的具体实施步骤和参数
2. 提供至少2-3个具体的实施例
3. 每个实施例要包含详细的技术参数和操作流程
4. 使用图表辅助说明（用文字描述图表内容）
5. 基于差异化分析，突出实施方式的优势
6. 确保内容详实、可操作性强`,
            },
          ];

          // 分多次生成说明书
          for (let i = 0; i < partPrompts.length; i++) {
            const part = partPrompts[i];
            const partProgress = 40 + (i / partPrompts.length) * 20;

            await sendProgress(
              controller,
              encoder,
              `正在生成说明书：${part.title}`,
              `生成第 ${i + 1}/${partPrompts.length} 部分`,
              partProgress
            );

            const partResponse = await invokeLLMWithRetry(
              llmClient,
              [
                { role: 'system' as const, content: systemPrompt },
                { role: 'user' as const, content: part.prompt },
              ],
              { model: llmConfig.model, temperature: llmConfig.temperature },
              `生成说明书：${part.title}`,
              3,
              300000 // 5分钟超时（说明书部分需要更长时间）
            );

            descriptionParts.push(partResponse.content);

            // 流式输出当前部分
            try {
              const partialSection = JSON.stringify({
                type: 'section',
                data: {
                  name: 'description',
                  title: '发明专利说明书（部分）',
                  content: `【${part.title}】\n\n${partResponse.content}\n\n---\n\n`,
                },
              }) + '\n\n';
              if (!clientDisconnected) {
                controller.enqueue(encoder.encode(partialSection));
              }
            } catch (error) {
              console.log('Failed to send description part (client may have disconnected)');
              clientDisconnected = true;
            }

            // 立即保存当前已生成的部分到数据库（实时保存，支持分步加载）
            if (taskId) {
              const partialDescription = descriptionParts.join('\n\n---\n\n');
              patentHistoryManager.updateGeneratedContent(taskId, {
                descriptionTitle: '发明专利说明书',
                descriptionContent: partialDescription,
              }).catch(err => console.error('Failed to save partial description:', err));
            }
          }

          // 合并所有部分（用于保存到历史记录）
          const fullDescription = descriptionParts.join('\n\n---\n\n');
          sectionsData.description = {
            title: '发明专利说明书',
            content: fullDescription,
          };
          fullContent += `### 发明专利说明书\n\n${fullDescription}\n\n`;

          // 实时保存说明书到数据库
          if (taskId) {
            patentHistoryManager.updateGeneratedContent(taskId, {
              descriptionTitle: sectionsData.description.title,
              descriptionContent: fullDescription,
            }).catch(err => console.error('Failed to save description:', err));
          }

          await sendProgress(
            controller,
            encoder,
            '正在生成附图说明',
            '调用文本生成工具，编写附图说明文字',
            65
          );

          // ========== 第5步：生成附图说明和图片==========
          await sendProgress(
            controller,
            encoder,
            '正在生成专利附图',
            '调用图像生成工具，创建附图示意图',
            70
          );

          const drawingsPrompt = `请根据以下发明信息，生成【专利附图】的文字说明部分：

发明名称：${title}
发明内容：${content}
具体实施方式：${solution || '请根据发明内容详细描述'}

要求：
1. 至少生成5个附图的文字说明
2. 每个附图要有明确的编号和标题（如：图1为本发明的整体结构示意图）
3. 每个附图要有详细的说明文字（150-200字/个）
4. 附图应涵盖：整体结构、关键部件、工作流程、实施例等不同角度
5. 使用专业的附图说明格式

格式示例：
【附图说明】
图1为本发明的整体结构示意图。如图1所示，系统包括数据采集模块、处理模块和输出模块。
图2为本发明中核心算法的流程图。如图2所示，算法包括数据预处理、特征提取和决策输出三个步骤。
（以此类推）`;

          // 生成附图文字说明
          const drawingsTextResponse = await invokeLLMWithRetry(
            llmClient,
            [
              { role: 'system' as const, content: systemPrompt },
              { role: 'user' as const, content: drawingsPrompt },
            ],
            { model: llmConfig.model, temperature: llmConfig.temperature },
            '生成附图文字说明',
            3,
            120000 // 2分钟超时
          );

          await sendProgress(
            controller,
            encoder,
            '正在合成附图',
            '使用图像生成模型，绘制专利附图',
            75
          );

          // 生成附图图片
          const imagePrompts = [];
          const figureCount = 5;

          // 分析附图文字说明，提取每个附图的描述
          const figureLines = drawingsTextResponse.content.split('\n').filter(line => line.includes('图'));
          for (let i = 0; i < Math.min(figureCount, figureLines.length); i++) {
            const line = figureLines[i];
            const figureDescription = line.substring(line.indexOf('。') + 1) || '技术示意图';
            imagePrompts.push(
              `${title} - ${figureDescription}，专业专利附图风格，清晰的线条图，技术原理图`
            );
          }

          // 填充不足的提示词
          while (imagePrompts.length < figureCount) {
            imagePrompts.push(
              `${title} - 专利附图${imagePrompts.length + 1}，专业专利附图风格，技术示意图`
            );
          }

          await sendProgress(
            controller,
            encoder,
            '正在生成附图',
            imageClient
              ? `正在绘制第 1/${figureCount} 张附图`
              : '未配置图像服务，仅生成附图文字说明',
            80
          );

          // 并发生成图片（未配置图像服务时直接跳过，附图说明文字仍然保留）
          const drawingImagesFromApi: string[] = [];

          if (imageClient) {
            const imageRequests = imagePrompts.slice(0, figureCount).map((prompt) =>
              imageClient.generate({
                prompt,
                size: '2K',
                watermark: false,
              })
            );

            const imageResponses = await Promise.all(imageRequests);

            for (const response of imageResponses) {
              if (response.success && response.imageUrls.length > 0) {
                drawingImagesFromApi.push(response.imageUrls[0]);
              }
            }
          }

          await sendProgress(
            controller,
            encoder,
            '正在生成附图',
            imageClient
              ? `正在绘制第 ${figureCount}/${figureCount} 张附图`
              : '附图文字说明已生成',
            90
          );

          drawingImages.push(...drawingImagesFromApi);

          sectionsData.drawings = {
            title: '专利附图',
            content: drawingsTextResponse.content,
            images: drawingImages,
          };
          fullContent += `### 专利附图\n\n${drawingsTextResponse.content}\n\n`;

          // 实时保存附图到数据库
          if (taskId) {
            patentHistoryManager.updateGeneratedContent(taskId, {
              drawingsTitle: sectionsData.drawings.title,
              drawingsContent: drawingsTextResponse.content,
              drawingsImages: drawingImages,
            }).catch(err => console.error('Failed to save drawings:', err));
          }

          try {
            const drawingsData = JSON.stringify({
              type: 'section',
              data: {
                name: 'drawings',
                title: '专利附图',
                content: drawingsTextResponse.content,
                images: drawingImages,
              },
            }) + '\n\n';
            if (!clientDisconnected) {
              controller.enqueue(encoder.encode(drawingsData));
            }
          } catch (error) {
            console.log('Failed to send drawings section (client may have disconnected)');
            clientDisconnected = true;
          }

          // ========== 第6步：生成权利要求书（1000-2000字）==========
          await sendProgress(
            controller,
            encoder,
            '正在生成权利要求书',
            '调用文本生成工具，编写权利要求书',
            95
          );

          const claimsPrompt = `请根据以下发明信息和差异化分析，生成【权利要求书】部分，字数严格控制在1000-2000字之间：

发明名称：${title}
发明内容：${content}

差异化分析：
${differentiationContent}

要求：
1. 至少包含1个独立权利要求（权利要求1）
2. 至少包含8-15个从属权利要求
3. 总字数严格控制在1000-2000字之间（不含标点）
4. 每个权利要求都要清晰、明确、有依据
5. 使用标准的权利要求格式：
   - 独立权利要求：一种...其特征在于，包括：(1)...；(2)...；...
   - 从属权利要求：根据权利要求X所述的...其特征在于，所述...为...。
6. 权利要求之间要有逻辑层次关系
7. 基于差异化分析，确保权利要求覆盖本发明的创新点
8. 用词准确，范围适当
9. 内容详实，涵盖发明的各个技术特征

格式示例：
【权利要求书】
1. 一种[发明名称]，其特征在于，包括：
   (1)...；
   (2)...；
   ...
2. 根据权利要求1所述的[发明名称]，其特征在于，所述...为...。
3. 根据权利要求1所述的[发明名称]，其特征在于，还包括...。
（以此类推）

**重要要求：**
1. 字数严格控制在1000-2000字之间
2. 权利要求内容要详细、准确
3. 确保每个权利要求都有明确的技术特征
4. 从属权利要求要逐步细化
5. 基于差异化分析，突出本发明的专利保护范围`;

          const claimsResponse = await invokeLLMWithRetry(
            llmClient,
            [
              { role: 'system' as const, content: systemPrompt },
              { role: 'user' as const, content: claimsPrompt },
            ],
            { model: llmConfig.model, temperature: llmConfig.temperature },
            '生成权利要求书',
            3,
            120000 // 2分钟超时
          );

          sectionsData.claims = {
            title: '权利要求书',
            content: claimsResponse.content,
          };
          fullContent += `### 权利要求书\n\n${claimsResponse.content}\n\n`;

          // 实时保存权利要求书到数据库
          if (taskId) {
            patentHistoryManager.updateGeneratedContent(taskId, {
              claimsTitle: sectionsData.claims.title,
              claimsContent: claimsResponse.content,
              references: referencesList,
            }).catch(err => console.error('Failed to save claims:', err));
          }

          try {
            const claimsData = JSON.stringify({
              type: 'section',
              data: {
                name: 'claims',
                title: '权利要求书',
                content: claimsResponse.content,
              },
            }) + '\n\n';
            if (!clientDisconnected) {
              controller.enqueue(encoder.encode(claimsData));
            }
          } catch (error) {
            console.log('Failed to send claims section (client may have disconnected)');
            clientDisconnected = true;
          }

          // 发送完成信号
          await sendProgress(
            controller,
            encoder,
            '完成',
            '所有内容生成完成',
            100
          );

          // 更新任务状态为completed，并保存最终生成的内容
          if (taskId) {
            // 构建完整的内容
            const generatedContent = fullContent;

            // 更新任务
            await patentHistoryManager.updateTaskStatus(taskId, 'completed', {
              progress: 100,
              currentStage: '完成',
              generatedContent,
              summaryTitle: sectionsData.summary?.title,
              summaryContent: sectionsData.summary?.content,
              descriptionTitle: sectionsData.description?.title,
              descriptionContent: sectionsData.description?.content,
              drawingsTitle: sectionsData.drawings?.title,
              drawingsContent: sectionsData.drawings?.content,
              drawingsImages: sectionsData.drawings?.images || drawingImages,
              claimsTitle: sectionsData.claims?.title,
              claimsContent: sectionsData.claims?.content,
              references: referencesList,
            });
          }

          try {
            if (!clientDisconnected) {
              controller.enqueue(encoder.encode(JSON.stringify({ type: 'done' }) + '\n\n'));
            }
          } catch (error) {
            console.log('Failed to send done signal (client may have disconnected)');
            clientDisconnected = true;
          }

          try {
            if (!clientDisconnected) {
              controller.close();
            }
          } catch (error) {
            // Controller可能已经关闭，忽略此错误
            console.log('Controller already closed or failed to close');
          }
        } catch (error) {
          console.error('Streaming error:', error);
          const errorMessage = (error as Error).message || '生成失败';
          // 原始文本仅用于下面的错误类型判断；落库与下发客户端的文案一律净化，
          // 避免数据库驱动层原文（含 SQL 与绑定参数）泄露给前端。
          const safeMessage = publicErrorMessage(error, '生成失败，请稍后重试');

          // 判断是否是Controller相关错误（客户端断开连接）
          const isControllerError = errorMessage.includes('Controller') ||
                                    errorMessage.includes('controller') ||
                                    errorMessage.includes('closed');

          // 判断是否是LLM调用失败
          const isLLMError = errorMessage.includes('LLM调用失败') ||
                            errorMessage.includes('调用超时');

          if (taskId) {
            if (isControllerError) {
              // 客户端断开连接，不要标记为失败
              // 已经生成的内容已经通过updateGeneratedContent保存到数据库
              console.log('Client disconnected, task will continue in background');
              // 保持generating状态，允许轮询获取更新
            } else {
              // 真正的生成错误，标记为失败
              console.error('Task failed:', errorMessage);
              await patentHistoryManager.updateTaskStatus(taskId, 'failed', {
                errorMessage: isLLMError
                  ? '生成过程中模型响应超时或失败，请稍后重试。'
                  : safeMessage,
                completedAt: new Date(),
              });
            }
          }

          try {
            if (!clientDisconnected) {
              // 发送错误信息到客户端
              controller.enqueue(encoder.encode(JSON.stringify({
                type: 'error',
                message: isLLMError
                  ? '生成过程中模型响应超时或失败，已取消任务。请稍后重试。'
                  : safeMessage,
              }) + '\n\n'));
              controller.error(error);
            }
          } catch (controllerError) {
            // Controller可能已经关闭
            console.log('Failed to send error to controller');
          }
        }
      },
    });

    return new NextResponse(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    console.error('Error in generate-patent API:', error);

    // 如果有taskId，更新任务状态为failed
    if (body?.taskId) {
      await patentHistoryManager.updateTaskStatus(body.taskId, 'failed', {
        errorMessage: publicErrorMessage(error, '生成失败'),
      });
    }

    return errorResponse(error, '生成专利说明书失败');
  }
}
