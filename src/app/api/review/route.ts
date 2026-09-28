import { NextRequest, NextResponse } from 'next/server';
import { getChatClient, trySearchClient } from '@/lib/ai';
import { errorResponse, publicErrorMessage } from '@/lib/api-helpers';
import { userManager, reviewManager } from '@/storage/database';

export async function POST(request: NextRequest) {
  try {
    // 检查用户认证
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      );
    }

    // 验证用户是否存在
    const user = await userManager.getUserById(userId);
    if (!user) {
      return NextResponse.json(
        { error: '用户不存在或已失效' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { content, taskId } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: '请提供有效的专利内容' },
        { status: 400 }
      );
    }

    // 清理输入文本
    const cleanContent = content
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
      .replace(/^\ufeff/, '')
      .trim();

    // 优先用用户自带的模型配置，其次全局配置，最后环境变量
    const { client: llmClient, config: llmConfig } = await getChatClient(userId);
    // 联网搜索属于可选能力：未配置时跳过检索步骤，审查仍可正常进行
    const searchClient = await trySearchClient(userId);

    const encoder = new TextEncoder();
    let isControllerClosed = false;
    let fullContent = '';

    // 创建可读流用于 SSE 响应
    const readable = new ReadableStream({
      async start(controller) {
        try {
          // 发送进度信息到前端
          const sendProgressToFrontend = async (stage: string, percent: number) => {
            if (!isControllerClosed) {
              try {
                controller.enqueue(encoder.encode(`[PROGRESS] {"stage":"${stage}","percent":${percent}}\n`));
              } catch (e) {
                console.error('发送进度到前端失败:', e);
                isControllerClosed = true;
              }
            }
          };

          // 更新数据库状态
          const updateDatabaseProgress = async (stage: string, percent: number) => {
            if (taskId) {
              try {
                await reviewManager.updateReviewStatus(taskId, {
                  progress: percent,
                  currentStage: stage,
                });
              } catch (e) {
                console.error('更新数据库进度失败:', e);
              }
            }
          };

          // 统一的进度更新函数
          const updateProgress = async (stage: string, percent: number) => {
            await Promise.all([
              sendProgressToFrontend(stage, percent),
              updateDatabaseProgress(stage, percent),
            ]);
          };

          // 第一步：分析专利内容
          await updateProgress('正在分析专利内容...', 10);
          await new Promise(resolve => setTimeout(resolve, 500));

          // 第二步：联网搜索获取参考依据
          await updateProgress('正在查询专利法规和参考依据...', 20);
          await new Promise(resolve => setTimeout(resolve, 500));

          const searchResults: Array<{ query: string; results: any[] }> = [];
          const searchQueries = ['专利审查指南', '专利法', '发明创造专利申请'];

          if (searchClient) {
            for (let i = 0; i < Math.min(searchQueries.length, 2); i++) {
              try {
                const query = searchQueries[i];
                const searchResponse = await searchClient.webSearchWithSummary(query + ' 专利审查', 3);
                if (searchResponse.web_items && searchResponse.web_items.length > 0) {
                  searchResults.push({
                    query,
                    results: searchResponse.web_items.map(item => ({
                      title: item.title,
                      url: item.url,
                      snippet: item.snippet,
                    })),
                  });
                }
              } catch (searchError) {
                console.error(`搜索失败:`, searchError);
              }
            }
          } else {
            console.warn('[审查] 未配置联网搜索服务，跳过法规依据检索');
          }

          await updateProgress('正在查询专利法规和参考依据...', 30);
          await new Promise(resolve => setTimeout(resolve, 500));

          // 第三步：构建参考依据文本
          await updateProgress('正在整合参考依据...', 40);
          await new Promise(resolve => setTimeout(resolve, 500));

          const referenceContext = searchResults.map(result => {
            return `
查询：${result.query}
参考结果：
${result.results.map(r => `- ${r.title}\n  ${r.snippet}\n  链接：${r.url}`).join('\n')}
`;
          }).join('\n');

          await updateProgress('正在整合参考依据...', 50);
          await new Promise(resolve => setTimeout(resolve, 500));

          await updateProgress('正在整合参考依据...', 60);
          await new Promise(resolve => setTimeout(resolve, 500));

          // 第四步：进行专利审查
          await updateProgress('正在执行专利审查分析...', 70);
          await new Promise(resolve => setTimeout(resolve, 500));

          await updateProgress('正在执行专利审查分析...', 80);
          await new Promise(resolve => setTimeout(resolve, 500));

          const reviewSystemPrompt = `你是一位专利审查专家。请审查专利文档，输出JSON格式的审查结果。

JSON结构要求：
{
  "overallScore": 75,
  "dimensionScores": {
    "expressionQuality": 80,
    "contentCompleteness": 70,
    "technicalReasonableness": 75,
    "legalCompliance": 72,
    "formatCompliance": 85,
    "innovationLevel": 68,
    "protectionScope": 70
  },
  "summary": "本专利申请技术方案完整，但在权利要求书的保护范围界定和说明书的实施例描述方面存在改进空间。",
  "completeness": {
    "score": 70,
    "items": [
      {"name": "技术领域", "status": "present"},
      {"name": "背景技术", "status": "present"},
      {"name": "发明内容", "status": "present"},
      {"name": "附图说明", "status": "incomplete"},
      {"name": "具体实施方式", "status": "incomplete"},
      {"name": "权利要求书", "status": "present"}
    ]
  },
  "issues": [
    {
      "type": "must_fix",
      "severity": "high",
      "category": "权利要求书",
      "message": "权利要求1缺少必要技术特征",
      "location": "权利要求书第1项",
      "originalText": "1. 一种装置，其特征在于，包括组件A。",
      "revisedText": "1. 一种装置，其特征在于，包括组件A和组件B，所述组件B与所述组件A连接。",
      "reason": "缺少解决技术问题的必要技术特征，不符合专利法实施细则第20条第2款的规定",
      "suggestion": "补充解决技术问题的必要技术特征",
      "reference": "专利审查指南第二部分第二章第3.1.2节",
      "sourceUrl": "https://www.cnipa.gov.cn"
    },
    {
      "type": "should_fix",
      "severity": "medium",
      "category": "说明书",
      "message": "具体实施方式部分描述不够详细",
      "location": "说明书具体实施方式部分",
      "originalText": "本实施例如图1所示。",
      "revisedText": "本实施例如图1所示，包括组件1、组件2和组件3。组件1通过螺栓固定在组件2上，组件3与组件2电连接。工作时，组件1接收信号并传递给组件2，组件2处理后驱动组件3动作。",
      "reason": "不符合专利法第26条第3款关于清楚完整公开的要求",
      "suggestion": "补充具体的连接关系、工作过程和参数",
      "reference": "专利审查指南第二部分第二章第2.2.6节",
      "sourceUrl": "https://www.cnipa.gov.cn"
    },
    {
      "type": "potential_issue",
      "severity": "low",
      "category": "新颖性",
      "message": "需要进一步检索现有技术",
      "location": "整体技术方案",
      "originalText": "全文",
      "revisedText": "建议补充现有技术对比",
      "reason": "可能存在影响新颖性的现有技术",
      "suggestion": "进行全面的现有技术检索",
      "reference": "专利法第22条第2款",
      "sourceUrl": "https://www.cnipa.gov.cn"
    }
  ],
  "improvements": [
    {
      "direction": "权利要求书优化",
      "suggestion": "明确各组件之间的连接关系和位置关系",
      "example": "所述组件A设置在所述组件B上方，通过焊接方式固定连接",
      "expectedEffect": "提高权利要求的保护范围的确定性"
    },
    {
      "direction": "说明书充实",
      "suggestion": "增加2-3个具体实施例，覆盖不同的实施场景",
      "example": "实施例1：应用于手机；实施例2：应用于平板；实施例3：应用于电脑",
      "expectedEffect": "支持更广泛的权利要求保护范围"
    },
    {
      "direction": "附图完善",
      "suggestion": "补充爆炸图、流程图和方框图",
      "example": "图1：立体图；图2：爆炸图；图3：工作流程图",
      "expectedEffect": "增强说明书公开的充分性"
    },
    {
      "direction": "技术效果描述",
      "suggestion": "量化描述技术效果，提供实验数据",
      "example": "本发明使效率提升30%，能耗降低25%",
      "expectedEffect": "增强创造性的说服力"
    }
  ]
}

注意：只输出纯JSON，不要其他文字。`;

          const reviewMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
            { role: 'system', content: reviewSystemPrompt },
            { role: 'user', content: `请审查以下专利内容：\n\n${cleanContent}` },
          ];

          // 第五步：生成审查报告
          await updateProgress('正在生成审查报告...', 90);
          await new Promise(resolve => setTimeout(resolve, 500));

          const reviewStream = llmClient.stream(reviewMessages, {
            model: llmConfig.model,
            temperature: llmConfig.temperature,
          });

          fullContent = '';
          let hasTimedOut = false;
          const timeoutPromise = new Promise<void>((resolve) => {
            setTimeout(() => {
              hasTimedOut = true;
              resolve();
            }, 5 * 60 * 1000);
          });

          const streamPromise = (async () => {
            for await (const chunk of reviewStream) {
              if (hasTimedOut) break;
              if (chunk.content) {
                const contentStr = chunk.content.toString();
                fullContent += contentStr;
                // 注意：不向用户发送大模型的原始内容
              }
            }
          })();

          await Promise.race([streamPromise, timeoutPromise]);

          // 即使前端断开连接，也要确保数据库更新
          if (!isControllerClosed) {
            await sendProgressToFrontend('审查完成', 100);
          }
          await updateDatabaseProgress('审查完成', 100);

          // 解析并保存审查结果
          if (taskId && fullContent.trim()) {
            let reviewResult = null;
            const cleanedContent = fullContent.trim()
              .replace(/^```json\s*/i, '')
              .replace(/^```\s*/, '')
              .replace(/\s*```$/, '');

            try {
              reviewResult = JSON.parse(cleanedContent);
            } catch (e) {
              try {
                const firstBrace = cleanedContent.indexOf('{');
                const lastBrace = cleanedContent.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                  const fixedJson = cleanedContent.substring(firstBrace, lastBrace + 1);
                  reviewResult = JSON.parse(fixedJson);
                }
              } catch (fixError) {
                console.error('修复JSON失败:', fixError);
              }
            }

            if (!reviewResult) {
              reviewResult = {
                overallScore: 0,
                summary: '审查结果解析失败',
                issues: [],
                improvements: [],
                completeness: { score: 0, items: [] },
                dimensionScores: {
                  expressionQuality: 0,
                  contentCompleteness: 0,
                  technicalReasonableness: 0,
                  legalCompliance: 0,
                  formatCompliance: 0,
                  innovationLevel: 0,
                  protectionScope: 0,
                },
              };
            }

            try {
              await reviewManager.updateReviewStatus(taskId, {
                status: 'completed',
                progress: 100,
                currentStage: '审查完成',
                reviewResult,
                completedAt: new Date(),
              });
            } catch (saveError) {
              console.error('保存审查结果失败:', saveError);
            }
          }

          if (!isControllerClosed) {
            controller.close();
          }
          isControllerClosed = true;
        } catch (error) {
          console.error('审查过程发生错误:', error);
          isControllerClosed = true;
          
          if (taskId) {
            try {
              await reviewManager.updateReviewStatus(taskId, {
                status: 'failed',
                errorMessage: publicErrorMessage(error, '审查失败'),
              });
            } catch (e) {
              console.error('保存错误状态失败:', e);
            }
          }
          
          if (!isControllerClosed) {
            controller.error(error);
          }
        }
      },
    });

    return new NextResponse(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('审查API错误:', error);
    if (error instanceof Error && error.name === 'ProviderNotConfiguredError') {
      return errorResponse(error, '审查失败');
    }
    return NextResponse.json(
      { error: publicErrorMessage(error, '审查失败') },
      { status: 500 }
    );
  }
}
