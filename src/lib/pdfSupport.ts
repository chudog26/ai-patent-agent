import { NextResponse } from 'next/server';

/**
 * PDF 中文支持判定。
 *
 * jsPDF 内置字体（helvetica）不含 CJK 字形，服务端又没有任何中文字体可用，
 * 强行渲染只会得到乱码 PDF。与其产出坏文件，不如明确拒绝并引导用户走
 * 「浏览器导出 PDF」或「下载 Word 再另存为 PDF」。
 *
 * 纯英文内容仍然可以正常生成 PDF。
 */

/** 中日韩文字及全角标点 */
const CJK_PATTERN =
  /[\u2e80-\u303f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/;

interface SectionLike {
  title?: unknown;
  content?: unknown;
}

/** 汇总即将写入 PDF 的全部可见文本 */
export function collectPdfText(
  title: unknown,
  sections: Record<string, unknown> | null | undefined
): string {
  const parts: string[] = [String(title ?? '')];

  if (sections && typeof sections === 'object') {
    for (const value of Object.values(sections)) {
      if (!value) continue;

      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string') {
            parts.push(item);
          } else if (item && typeof item === 'object') {
            const ref = item as { text?: unknown; url?: unknown };
            parts.push(String(ref.text ?? ''), String(ref.url ?? ''));
          }
        }
        continue;
      }

      if (typeof value === 'object') {
        const section = value as SectionLike;
        parts.push(String(section.title ?? ''), String(section.content ?? ''));
      } else {
        parts.push(String(value));
      }
    }
  }

  return parts.join('\n');
}

export function containsCjk(text: string): boolean {
  return CJK_PATTERN.test(text);
}

/**
 * 内容含中文时返回可读的拒绝响应；返回 null 表示可以继续生成 PDF。
 */
export function rejectUnsupportedCjkPdf(
  title: unknown,
  sections: Record<string, unknown> | null | undefined
): NextResponse | null {
  if (!containsCjk(collectPdfText(title, sections))) {
    return null;
  }

  return NextResponse.json(
    {
      error:
        '服务端 PDF 渲染不含中文字形，直接导出会得到乱码。请在生成结果页使用「导出 PDF」（由浏览器渲染，中文完整），或先下载 Word 文档再另存为 PDF。',
      code: 'PDF_CJK_UNSUPPORTED',
    },
    { status: 501 }
  );
}
