import { NextRequest, NextResponse } from 'next/server';
import { AlignmentType, Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun } from 'docx';
// jsPDF 只在导出 PDF 分支用到，静态 import 以便被 ESLint/打包器正确解析
// （原先用 require 是历史写法，已在移除 html2pdf.js 时一并纠正）
import { jsPDF } from 'jspdf';
import { rejectUnsupportedCjkPdf } from '@/lib/pdfSupport';

/** A4 页面与页边距（单位 twips，1440 twips = 1 英寸 ≈ 2.54cm） */
const PAGE_PROPERTIES = {
  page: {
    size: { width: 11906, height: 16838 },
    margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
  },
};

/** 中文文档常规字体搭配：西文 Times New Roman，中文宋体 */
const BODY_FONT = { ascii: 'Times New Roman', hAnsi: 'Times New Roman', eastAsia: '宋体' };
/** 标题字体：中文黑体 */
const HEADING_FONT = { ascii: 'Arial', hAnsi: 'Arial', eastAsia: '黑体' };
/** 正文 12pt（小四）、小标题 14pt（四号）、大标题 16pt（三号），size 单位为半磅 */
const BODY_SIZE = 24;
const SUBHEADING_SIZE = 28;
const TITLE_SIZE = 32;
/** 1.5 倍行距 / 首行缩进 2 字符 */
const LINE_SPACING = { line: 360, lineRule: 'auto' as const };
const FIRST_LINE_INDENT = { firstLine: 480 };

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, sections, format, section } = body;

    // 如果指定了section，只下载该部分
    const filteredSections = section ? { [section]: sections[section] } : sections;

    if (format === 'doc') {
      return generateDoc(title, filteredSections, section);
    } else if (format === 'pdf') {
      return await generatePdf(title, filteredSections, section);
    } else {
      return NextResponse.json({ error: '不支持的格式' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in download API:', error);
    return NextResponse.json({ error: '下载失败' }, { status: 500 });
  }
}

function generateDoc(title: string, sections: any, sectionName?: string) {
  // 获取文件名
  const getFileName = () => {
    if (sectionName) {
      const sectionNames: Record<string, string> = {
        summary: '摘要',
        description: '说明书',
        drawings: '附图',
        claims: '权利要求书',
      };
      return `${title}-${sectionNames[sectionName] || sectionName}.docx`;
    }
    return `${title || '专利说明书'}.docx`;
  };

  const doc = new Document({
    sections: [
      {
        properties: PAGE_PROPERTIES,
        children: [
          // 标题
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 360, ...LINE_SPACING },
            children: [
              new TextRun({
                text: title || '专利说明书',
                bold: true,
                size: TITLE_SIZE,
                font: HEADING_FONT,
              }),
            ],
          }),

          // 摘要
          ...(sections.summary?.content
            ? [
                buildSectionHeading(sections.summary.title || '摘要'),
                ...parseContentToParagraphs(sections.summary.content),
              ]
            : []),

          // 发明专利说明书
          ...(sections.description?.content
            ? [
                buildSectionHeading(sections.description.title || '发明专利说明书'),
                ...parseContentToParagraphs(sections.description.content),
              ]
            : []),

          // 专利附图
          ...(sections.drawings?.content
            ? [
                buildSectionHeading(sections.drawings.title || '专利附图'),
                ...parseContentToParagraphs(sections.drawings.content),
              ]
            : []),

          // 权利要求书
          ...(sections.claims?.content
            ? [
                buildSectionHeading(sections.claims.title || '权利要求书'),
                ...parseContentToParagraphs(sections.claims.content),
              ]
            : []),

          // 参考来源
          ...(sections.references?.length
            ? [
                buildSectionHeading('参考来源'),
                ...buildReferenceParagraphs(sections.references),
              ]
            : []),
        ],
      },
    ],
  });

  return Packer.toBlob(doc).then((blob) => {
    return new NextResponse(blob, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(getFileName())}"`,
      },
    });
  });
}

function generatePdf(title: string, sections: any, sectionName?: string): Promise<NextResponse> {
  // 含中文时直接拒绝，避免产出乱码 PDF（详见 lib/pdfSupport.ts）
  const unsupported = rejectUnsupportedCjkPdf(title, sections);
  if (unsupported) return Promise.resolve(unsupported);

  // 获取文件名
  const getFileName = () => {
    if (sectionName) {
      const sectionNames: Record<string, string> = {
        summary: '摘要',
        description: '说明书',
        drawings: '附图',
        claims: '权利要求书',
      };
      return `${title}-${sectionNames[sectionName] || sectionName}.pdf`;
    }
    return `${title || '专利说明书'}.pdf`;
  };
  // 创建HTML内容
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: "Microsoft YaHei", "SimSun", Arial, sans-serif;
          padding: 20px;
          line-height: 1.6;
        }
        h1 {
          text-align: center;
          font-size: 24px;
          margin-bottom: 20px;
          font-weight: bold;
        }
        h2 {
          font-size: 18px;
          margin-top: 20px;
          margin-bottom: 10px;
          font-weight: bold;
          border-bottom: 2px solid #333;
          padding-bottom: 5px;
        }
        h3 {
          font-size: 16px;
          margin-top: 15px;
          margin-bottom: 8px;
          font-weight: bold;
        }
        p {
          margin: 10px 0;
          text-align: justify;
        }
        .references {
          margin-top: 30px;
        }
        .reference-item {
          margin: 8px 0;
          padding: 5px;
          background: #f5f5f5;
        }
        .reference-url {
          color: #0066cc;
          word-break: break-all;
        }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      ${sections.summary?.content ? `
        <h2>${sections.summary.title || '摘要'}</h2>
        <div>${formatContent(sections.summary.content)}</div>
      ` : ''}
      ${sections.description?.content ? `
        <h2>${sections.description.title || '发明专利说明书'}</h2>
        <div>${formatContent(sections.description.content)}</div>
      ` : ''}
      ${sections.drawings?.content ? `
        <h2>${sections.drawings.title || '专利附图'}</h2>
        <div>${formatContent(sections.drawings.content)}</div>
      ` : ''}
      ${sections.claims?.content ? `
        <h2>${sections.claims.title || '权利要求书'}</h2>
        <div>${formatContent(sections.claims.content)}</div>
      ` : ''}
      ${sections.references?.length ? `
        <div class="references">
          <h2>参考来源</h2>
          ${sections.references.map((ref: any, index: number) => `
            <div class="reference-item">
              <strong>[${index + 1}]</strong> ${ref.text}
              ${ref.url ? `<br><span class="reference-url">${ref.url}</span>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}
    </body>
    </html>
  `;

  // 注意：服务端无法使用 html2pdf.js / html2canvas（依赖浏览器 DOM），
  // 这里用 jsPDF 生成。jsPDF 内置字体不含中文字形，中文内容建议优先
  // 导出 Word（format=doc）。如需完美中文 PDF，请换成 pdfmake 并内嵌
  // 一份 CJK 字体，或改由前端用 html2pdf.js 生成。
  return new Promise((resolve, reject) => {
    try {
      const pdf = new jsPDF();
      
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const maxWidth = pageWidth - margin * 2;
      let yPosition = margin;

      // 标题
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      const titleLines = pdf.splitTextToSize(title, maxWidth);
      titleLines.forEach((line: string) => {
        if (yPosition > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
        }
        pdf.text(line, margin, yPosition);
        yPosition += 10;
      });
      yPosition += 10;

      // 辅助函数：添加内容
      const addContent = (title: string, content: string) => {
        if (!content) return;

        // 节标题
        if (yPosition > pageHeight - margin - 10) {
          pdf.addPage();
          yPosition = margin;
        }
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text(title, margin, yPosition);
        yPosition += 10;

        // 内容
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'normal');
        const paragraphs = content.split('\n\n');
        paragraphs.forEach((para) => {
          const lines = pdf.splitTextToSize(para, maxWidth);
          lines.forEach((line: string) => {
            if (yPosition > pageHeight - margin) {
              pdf.addPage();
              yPosition = margin;
            }
            pdf.text(line, margin, yPosition);
            yPosition += 6;
          });
          yPosition += 4;
        });
        yPosition += 5;
      };

      // 添加各个部分
      if (sections.summary?.content) {
        addContent(sections.summary.title || '摘要', sections.summary.content);
      }
      if (sections.description?.content) {
        addContent(
          sections.description.title || '发明专利说明书',
          sections.description.content
        );
      }
      if (sections.drawings?.content) {
        addContent(sections.drawings.title || '专利附图', sections.drawings.content);
      }
      if (sections.claims?.content) {
        addContent(sections.claims.title || '权利要求书', sections.claims.content);
      }

      // 参考来源
      if (sections.references?.length) {
        if (yPosition > pageHeight - margin - 10) {
          pdf.addPage();
          yPosition = margin;
        }
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text('参考来源', margin, yPosition);
        yPosition += 10;

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        sections.references.forEach((ref: { text: string; url?: string }, index: number) => {
          const refText = `[${index + 1}] ${ref.text}${ref.url ? '\n' + ref.url : ''}`;
          const lines = pdf.splitTextToSize(refText, maxWidth);
          lines.forEach((line: string) => {
            if (yPosition > pageHeight - margin) {
              pdf.addPage();
              yPosition = margin;
            }
            pdf.text(line, margin, yPosition);
            yPosition += 6;
          });
          yPosition += 4;
        });
      }

      resolve(new NextResponse(pdf.output('arraybuffer'), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(getFileName())}"`,
        },
      }));
    } catch (error) {
      reject(error);
    }
  });
}

// 格式化内容为HTML
function formatContent(content: string): string {
  if (!content) return '';
  
  return content
    .split('\n')
    .map(line => {
      if (!line.trim()) return '<br>';
      
      // 检查是否是小标题（包含【】）
      if (line.includes('【') && line.includes('】')) {
        return `<h3>${line}</h3>`;
      }
      
      return `<p>${line}</p>`;
    })
    .join('');
}

/** 节标题段落（黑体加粗） */
function buildSectionHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 320, after: 200, ...LINE_SPACING },
    children: [
      new TextRun({ text, bold: true, size: SUBHEADING_SIZE, font: HEADING_FONT }),
    ],
  });
}

/**
 * 参考文献段落。
 * 兼容两种入参形态：字符串数组，以及 { text, url } 对象数组。
 * 早期实现一律按字符串处理，遇到对象会渲染成 "[object Object]"，此处已修正。
 */
function buildReferenceParagraphs(
  references: Array<{ text?: string; url?: string } | string>
): Paragraph[] {
  return references.map((ref, index) => {
    const isObject = ref !== null && typeof ref === 'object';
    const text = isObject ? String((ref as { text?: string }).text ?? '') : String(ref);
    const url = isObject ? (ref as { url?: string }).url : undefined;

    return new Paragraph({
      spacing: { after: 60, ...LINE_SPACING },
      indent: { left: 480, hanging: 480 },
      children: [
        new TextRun({
          text: `[${index + 1}] ${text}${url ? ' ' + url : ''}`,
          size: BODY_SIZE,
          font: BODY_FONT,
        }),
      ],
    });
  });
}

// 将内容解析为段落（中文文档规范：宋体、首行缩进 2 字符、1.5 倍行距）
function parseContentToParagraphs(content: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const lines = content.split('\n');

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return; // 空行由段落间距承担，不再生成空段落

    // 检查是否是小标题（包含【】）
    const isSubheading = line.includes('【') && line.includes('】');

    paragraphs.push(
      new Paragraph({
        spacing: isSubheading
          ? { before: 200, after: 120, ...LINE_SPACING }
          : { after: 0, ...LINE_SPACING },
        indent: isSubheading ? undefined : FIRST_LINE_INDENT,
        children: [
          new TextRun({
            text: line,
            bold: isSubheading,
            size: isSubheading ? SUBHEADING_SIZE : BODY_SIZE,
            font: isSubheading ? HEADING_FONT : BODY_FONT,
          }),
        ],
      })
    );
  });

  return paragraphs;
}
