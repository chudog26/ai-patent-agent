import { NextRequest } from 'next/server';
import { getChatClient } from '@/lib/ai';
import { errorResponse, publicErrorMessage } from '@/lib/api-helpers';
import {
  createBulkInspirations,
  getCategoryById,
  getCategoryByName,
} from '@/storage/database/inspirationManager';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { categoryId } = body;
    // count 缺省或非法时回退到 5，避免进度事件与截断逻辑出现 NaN
    const count = Math.max(1, Math.min(20, Number(body.count) || 5));

    // 获取分类信息。前端传的是分类 ID（UUID），这里按 ID 精确查；
    // 若传入的是分类名称也一并兼容；都取不到时回退到默认分类，
    // 避免提示词里的分类描述与实际选择的分类不一致。
    const rawCategory = categoryId ? String(categoryId).trim() : '';
    const category =
      (rawCategory
        ? (await getCategoryById(rawCategory)) ?? (await getCategoryByName(rawCategory))
        : null) ?? (await getCategoryByName('家电类'));

    if (!category) {
      return errorResponse(new Error('未找到默认灵感分类'), '生成灵感失败');
    }

    const userId = request.headers.get('x-user-id');

    // 优先用用户自带的模型配置，其次全局配置，最后环境变量
    const { client, config: llmConfig } = await getChatClient(userId);

    const encoder = new TextEncoder();

    // 创建流式响应
    const stream = new ReadableStream({
      async start(controller) {
        const sendProgress = (current: number, message: string) => {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'progress', current, total: count, message })}\n\n`
            )
          );
        };

        try {
          // 生成提示词
          const systemPrompt = '你是一位专业的专利代理人和技术创新专家，擅长发现和挖掘专利创新点。';
          const userPrompt = `请为【${category.name}】分类生成 ${count} 个有价值的专利灵感方向。

分类描述：${category.description}

对于每个灵感，请按照以下格式输出（每个灵感用 === 分隔）：

标题：[简洁有力的专利标题，15-25字]
描述：[详细描述这个专利的方向、应用场景和创新点，100-150字]
稀缺性：[1-10的数字，表示该领域的创新稀缺程度，10为极度稀缺，1为常见]
关键词：[2-4个关键词，用逗号分隔]

要求：
1. 灵感要具有创新性和实用性
2. 符合当前技术发展趋势
3. 覆盖该分类的不同子领域
4. 稀缺性值要有差异化分布
5. 避免过于笼统或已有的成熟技术`;

          sendProgress(0, '正在分析分类并生成灵感...');

          const messages = [
            { role: 'system' as const, content: systemPrompt },
            { role: 'user' as const, content: userPrompt },
          ];

          const response = await client.invoke(messages, {
            model: llmConfig.model,
            temperature: llmConfig.temperature,
          });

          sendProgress(1, 'AI 生成完成，正在解析内容...');

          // 解析生成的灵感
          const content = response.content;
          const sections = content.split('===').filter(s => s.trim());

          const inspirations = [];

          for (let i = 0; i < Math.min(sections.length, count); i++) {
            const section = sections[i].trim();
            const lines = section.split('\n').filter(l => l.trim());

            let title = '';
            let description = '';
            let rarity = 5;
            const keywords: string[] = [];

            for (const line of lines) {
              if (line.startsWith('标题：')) {
                title = line.replace('标题：', '').trim();
              } else if (line.startsWith('描述：')) {
                description = line.replace('描述：', '').trim();
              } else if (line.startsWith('稀缺性：')) {
                rarity = parseInt(line.replace('稀缺性：', '').trim()) || 5;
                rarity = Math.max(1, Math.min(10, rarity));
              } else if (line.startsWith('关键词：')) {
                const kw = line.replace('关键词：', '').trim();
                keywords.push(...kw.split(',').map(k => k.trim()).filter(k => k));
              }
            }

            if (title && description) {
              inspirations.push({
                categoryId: category.id,
                title,
                description,
                rarity,
                tags: keywords,
                status: 'published',
              });
            }

            sendProgress(i + 1, `已解析 ${i + 1}/${count} 个灵感...`);
          }

          sendProgress(count, '正在保存到数据库...');

          // 保存到数据库
          if (inspirations.length > 0) {
            await createBulkInspirations(inspirations);
          }

          // 发送完成消息
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'complete',
                current: count,
                total: count,
                message: `成功生成 ${inspirations.length} 个灵感！`,
              })}\n\n`
            )
          );
        } catch (error) {
          console.error('Error in generate-inspirations:', error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'error',
                message: '生成失败: ' + publicErrorMessage(error, '请稍后重试'),
              })}\n\n`
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in generate-inspirations API:', error);
    return errorResponse(error, '生成灵感失败');
  }
}
