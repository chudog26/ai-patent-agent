import { NextRequest, NextResponse } from 'next/server';
import { patentHistoryManager } from '@/storage/database';
import { AlignmentType, Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
// 与 /api/download 保持一致：静态 import jsPDF，避免服务端 require 浏览器库的历史写法
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
/** 正文字号（单位半磅）：12pt 正文 / 14pt 小标题 / 16pt 大标题 */
const BODY_SIZE = 24;
const SUBHEADING_SIZE = 28;
const TITLE_SIZE = 32;
/** 1.5 倍行距 / 首行缩进 2 字符 */
const LINE_SPACING = { line: 360, lineRule: 'auto' as const };
const FIRST_LINE_INDENT = { firstLine: 480 };

/** 节标题段落（黑体加粗） */
function buildSectionHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 320, after: 200, ...LINE_SPACING },
    children: [
      new TextRun({ text, bold: true, size: SUBHEADING_SIZE, font: HEADING_FONT }),
    ],
  });
}

/** 参考文献段落（悬挂缩进） */
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: historyId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') || 'doc';

    // 获取历史记录
    const history = await patentHistoryManager.getPatentHistoryById(historyId);
    if (!history) {
      return NextResponse.json({ error: '历史记录不存在' }, { status: 404 });
    }

    const sections = {
      summary: {
        title: history.summaryTitle || '摘要',
        content: history.summaryContent || '',
      },
      description: {
        title: history.descriptionTitle || '发明专利说明书',
        content: history.descriptionContent || '',
      },
      drawings: {
        title: history.drawingsTitle || '专利附图',
        content: history.drawingsContent || '',
      },
      claims: {
        title: history.claimsTitle || '权利要求书',
        content: history.claimsContent || '',
      },
      references: history.references || [],
    };

    const title = history.title;

    if (format === 'doc') {
      return generateDoc(title, sections);
    } else if (format === 'pdf') {
      return await generatePdf(title, sections);
    } else {
      return NextResponse.json({ error: '不支持的格式' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in history download API:', error);
    return NextResponse.json({ error: '下载失败' }, { status: 500 });
  }
}

function generateDoc(title: string, sections: any) {
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
        'Content-Disposition': `attachment; filename="${encodeURIComponent(
          title || '专利说明书'
        )}.docx"`,
      },
    });
  });
}

function generatePdf(title: string, sections: any): Promise<NextResponse> {
  // 含中文时直接拒绝，避免产出乱码 PDF（详见 lib/pdfSupport.ts）
  const unsupported = rejectUnsupportedCjkPdf(title, sections);
  if (unsupported) return Promise.resolve(unsupported);

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
          'Content-Disposition': `attachment; filename="${encodeURIComponent(
            title || '专利说明书'
          )}.pdf"`,
        },
      }));
    } catch (error) {
      reject(error);
    }
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
