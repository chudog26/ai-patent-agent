import { NextRequest, NextResponse } from 'next/server';
import { getChatClient } from '@/lib/ai';
import { errorResponse, getUserIdFromRequest } from '@/lib/api-helpers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { field, title, existingData } = body;

    const userId = getUserIdFromRequest(request);

    // 优先用用户自带的模型配置，其次全局配置，最后环境变量
    const { client, config: llmConfig } = await getChatClient(userId);

    let prompt = '';
    const systemPrompt = '你是一位专业的专利代理人和技术写作专家，擅长撰写专利申请文件。';

    switch (field) {
      case 'field':
        prompt = `请根据以下发明名称，生成一段专业的"技术领域"描述（约100-200字）：
发明名称：${title}
${existingData.content ? `发明内容：${existingData.content}` : ''}

要求：
1. 准确定位该发明所属的技术领域
2. 使用专业的专利术语
3. 简洁明了，重点突出`;
        break;

      case 'background':
        prompt = `请根据以下信息，生成一段详细的"背景技术"描述（约300-500字）：
发明名称：${title}
${existingData.field ? `技术领域：${existingData.field}` : ''}
${existingData.content ? `发明内容：${existingData.content}` : ''}

要求：
1. 描述现有技术状况
2. 指出现有技术存在的问题和不足
3. 说明本发明的技术背景
4. 逻辑清晰，层次分明`;
        break;

      case 'content':
        prompt = `请根据以下信息，生成一段详细的"发明内容"描述（约500-800字）：
发明名称：${title}
${existingData.field ? `技术领域：${existingData.field}` : ''}
${existingData.background ? `背景技术：${existingData.background}` : ''}

请用户提供的发明内容作为基础进行扩展和优化：
${existingData.content}

要求：
1. 包含要解决的技术问题
2. 详细描述技术方案
3. 说明有益效果和技术优势
4. 突出创新性和技术亮点`;
        break;

      case 'solution':
        prompt = `请根据以下信息，生成一段详细的"具体实施方式"描述（约400-600字）：
发明名称：${title}
${existingData.content ? `发明内容：${existingData.content}` : ''}

请用户提供的具体实施方式作为基础进行扩展和优化：
${existingData.solution || '请根据发明内容推测具体实施方式'}

要求：
1. 详细描述实施步骤和过程
2. 包含具体的技术参数和实施方案
3. 说明实施效果和优势
4. 具有可操作性，便于技术人员理解`;
        break;

      default:
        return NextResponse.json({ error: '无效的字段' }, { status: 400 });
    }

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: prompt },
    ];

    const response = await client.invoke(messages, {
      model: llmConfig.model,
      temperature: llmConfig.temperature,
    });

    return NextResponse.json({ content: response.content });
  } catch (error) {
    console.error('Error in assist-fill API:', error);
    return errorResponse(error, 'AI 辅助填写失败');
  }
}
