/**
 * 专利文档的「可打印 HTML」生成器（浏览器端使用）。
 *
 * 为什么不在服务端生成中文 PDF：
 * 服务端 Node 环境既没有中文字形，jsPDF 内置的 helvetica 也不含 CJK，
 * 硬排只会得到乱码；要正确渲染就得内嵌数 MB 的中文字体文件。浏览器本身
 * 具备完整的字体与排版引擎，由浏览器渲染再「另存为 PDF」既零成本、结果
 * 又是可选中的矢量文字，因此把中文 PDF 交给浏览器是更合理的分工。
 */

export interface PatentPrintSection {
  title?: string;
  content?: string;
}

export interface PatentPrintInput {
  summary?: PatentPrintSection;
  description?: PatentPrintSection;
  drawings?: PatentPrintSection;
  claims?: PatentPrintSection;
  references?: Array<{ text: string; url?: string }>;
}

const CJK_FONT_STACK = '"Songti SC", "SimSun", "宋体", "Noto Serif CJK SC", "Source Han Serif SC", serif';
const CJK_HEADING_FONT_STACK =
  '"Heiti SC", "SimHei", "黑体", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 把正文按行拆成段落；含【】的行按小标题处理（与 Word 导出保持一致） */
function renderContent(content?: string): string {
  if (!content) return '';

  return content
    .split('\n')
    .map((rawLine) => {
      const line = rawLine.trim();
      if (!line) return '';
      if (line.includes('【') && line.includes('】')) {
        return `<h3>${escapeHtml(line)}</h3>`;
      }
      return `<p>${escapeHtml(line)}</p>`;
    })
    .filter(Boolean)
    .join('\n');
}

function renderSection(section: PatentPrintSection | undefined, fallbackTitle: string): string {
  if (!section?.content) return '';
  return `<section>
  <h2>${escapeHtml(section.title || fallbackTitle)}</h2>
${renderContent(section.content)}
</section>`;
}

function renderReferences(references?: PatentPrintInput['references']): string {
  if (!references?.length) return '';

  const items = references
    .map((ref) => {
      const text = escapeHtml(String(ref.text ?? ''));
      const url = ref.url ? `<div class="url">${escapeHtml(ref.url)}</div>` : '';
      return `<li>${text}${url}</li>`;
    })
    .join('\n');

  return `<section class="references">
  <h2>参考来源</h2>
  <ol>
${items}
  </ol>
</section>`;
}

/** 生成一份自包含的、排版就绪的 HTML 文档（可直接打印/另存为 PDF） */
export function buildPatentPrintHtml(title: string, data: PatentPrintInput): string {
  const documentTitle = (title || '').trim() || '专利说明书';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(documentTitle)}</title>
<style>
  @page { size: A4; margin: 25mm 22mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: ${CJK_FONT_STACK};
    font-size: 12pt;
    line-height: 1.75;
    color: #000;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  h1 {
    font-family: ${CJK_HEADING_FONT_STACK};
    font-size: 18pt;
    font-weight: 700;
    line-height: 1.5;
    text-align: center;
    margin: 0 0 24pt;
  }
  h2 {
    font-family: ${CJK_HEADING_FONT_STACK};
    font-size: 14pt;
    font-weight: 700;
    margin: 20pt 0 10pt;
    text-indent: 0;
  }
  h3 {
    font-family: ${CJK_HEADING_FONT_STACK};
    font-size: 12pt;
    font-weight: 700;
    margin: 12pt 0 6pt;
    text-indent: 0;
  }
  p {
    margin: 0 0 6pt;
    text-indent: 2em;
    text-align: justify;
  }
  section { break-inside: auto; }
  .references ol { padding-left: 2em; margin: 0; }
  .references li { margin-bottom: 6pt; word-break: break-all; }
  .references .url { color: #444; font-size: 10pt; }
  @media screen {
    body { max-width: 210mm; margin: 0 auto; padding: 25mm 22mm; }
  }
</style>
</head>
<body>
<h1>${escapeHtml(documentTitle)}</h1>
${renderSection(data.summary, '摘要')}
${renderSection(data.description, '发明专利说明书')}
${renderSection(data.drawings, '专利附图')}
${renderSection(data.claims, '权利要求书')}
${renderReferences(data.references)}
</body>
</html>`;
}
