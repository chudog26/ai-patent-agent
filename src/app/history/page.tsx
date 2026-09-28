'use client';

import { useState, useEffect } from 'react';
import { History, FileText, Calendar, Download, Trash2, Search, Filter, FileCheck, AlertCircle, CheckCircle, XCircle, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser } from '@/contexts/UserContext';

interface PatentHistory {
  id: string;
  userId: string;
  title: string;
  field: string;
  background: string;
  content: string;
  solution: string;
  generatedContent: string;
  summaryTitle: string;
  summaryContent: string;
  descriptionTitle: string;
  descriptionContent: string;
  drawingsTitle: string;
  drawingsContent: string;
  drawingsImages: string[];
  claimsTitle: string;
  claimsContent: string;
  references: Array<{ text: string; url?: string }>;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  progress: number;
  currentStage: string;
  errorMessage: string;
  completedAt: string;
  createdAt: string;
}

interface ReviewHistory {
  id: string;
  title: string;
  status: 'pending' | 'reviewing' | 'completed' | 'failed';
  progress: number;
  currentStage: string;
  errorMessage: string;
  completedAt: string;
  createdAt: string;
  reviewResult: ReviewResult | null;
}

interface ReviewIssue {
  type: 'must_fix' | 'should_fix' | 'potential_issue';
  severity: 'high' | 'medium' | 'low';
  category: string;
  message: string;
  location?: string;
  originalText?: string;
  revisedText?: string;
  reason?: string;
  suggestion?: string;
  reference?: string;
  sourceUrl?: string;
}

interface Improvement {
  direction: string;
  suggestion: string;
  example: string;
  expectedEffect: string;
}

interface ReviewResult {
  overallScore: number;
  dimensionScores: {
    expressionQuality: number;
    contentCompleteness: number;
    technicalReasonableness: number;
    legalCompliance: number;
    formatCompliance: number;
    innovationLevel: number;
    protectionScope: number;
  };
  summary: string;
  issues: ReviewIssue[];
  improvements: Improvement[];
  completeness: {
    score: number;
    items: Array<{ name: string; status: 'present' | 'missing' | 'incomplete' }>;
  };
}

export default function HistoryPage() {
  const { currentUser } = useUser();
  const [activeTab, setActiveTab] = useState<'patent' | 'review'>('patent');
  
  // 专利生成历史
  const [histories, setHistories] = useState<PatentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'generating' | 'completed' | 'failed'>('all');
  const [selectedHistory, setSelectedHistory] = useState<PatentHistory | null>(null);

  // 专利审查历史
  const [reviewHistories, setReviewHistories] = useState<ReviewHistory[]>([]);
  const [reviewLoading, setReviewLoading] = useState(true);
  const [reviewSearchQuery, setReviewSearchQuery] = useState('');
  const [reviewFilterType, setReviewFilterType] = useState<'all' | 'reviewing' | 'completed' | 'failed'>('all');
  const [selectedReview, setSelectedReview] = useState<ReviewHistory | null>(null);

  useEffect(() => {
    loadHistories();
    loadReviewHistories();
  }, []);

  const loadHistories = async () => {
    if (!currentUser || !currentUser.id) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/patent-histories', {
        headers: {
          'x-user-id': currentUser.id,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setHistories(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to load histories:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReviewHistories = async () => {
    if (!currentUser || !currentUser.id) {
      setReviewLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/review-histories', {
        headers: {
          'x-user-id': currentUser.id,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setReviewHistories(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to load review histories:', error);
    } finally {
      setReviewLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条记录吗？')) return;

    try {
      const response = await fetch(`/api/patent-histories/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setHistories(histories.filter(h => h.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete history:', error);
    }
  };

  const handleDownload = async (history: PatentHistory) => {
    try {
      const response = await fetch(`/api/history-download/${history.id}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${history.title}.docx`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to download:', error);
    }
  };

  const handleReviewDelete = async (id: string) => {
    if (!confirm('确定要删除这条审查记录吗？')) return;
    if (!currentUser?.id) {
      console.error('User not logged in');
      return;
    }

    try {
      const response = await fetch('/api/review-histories', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({ id }),
      });

      if (response.ok) {
        setReviewHistories(reviewHistories.filter(h => h.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete review history:', error);
    }
  };

  const handleViewReview = async (id: string) => {
    if (!currentUser?.id) {
      console.error('User not logged in');
      return;
    }

    try {
      const response = await fetch(`/api/review-histories/${id}`, {
        headers: { 'x-user-id': currentUser.id },
      });
      const review = await response.json();
      
      // 安全解析reviewResult，防止数据库中的格式不兼容
      if (review && review.reviewResult) {
        try {
          // 如果reviewResult是字符串，尝试解析
          if (typeof review.reviewResult === 'string') {
            review.reviewResult = JSON.parse(review.reviewResult);
          }
        } catch (e) {
          console.error('解析reviewResult失败:', e);
          review.reviewResult = null;
        }
      }
      
      setSelectedReview(review);
    } catch (error) {
      console.error('Failed to load review detail:', error);
    }
  };

  // 生成HTML报告
  const generateHTMLReport = (result: any): string => {
    // 安全检查：如果result不存在或格式不正确，返回默认报告
    if (!result) {
      return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>专利审查报告</title>
  <style>
    body { font-family: system-ui; padding: 40px; text-align: center; }
    h1 { color: #666; }
  </style>
</head>
<body>
  <h1>审查结果解析失败</h1>
  <p>请联系管理员查看原始审查数据</p>
</body>
</html>`;
    }

    // 确保result有正确的结构
    const safeResult = {
      overallScore: result.overallScore || 0,
      summary: result.summary || '审查结果解析失败',
      dimensionScores: result.dimensionScores || {},
      completeness: result.completeness || { score: 0, items: [] },
      issues: Array.isArray(result.issues) ? result.issues : [],
      improvements: Array.isArray(result.improvements) ? result.improvements : [],
    };

    // HTML转义函数
    const escapeHtml = (text: string): string => {
      if (!text) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    const getScoreColor = (score: number) => {
      if (score >= 80) return '#22c55e';
      if (score >= 60) return '#eab308';
      return '#ef4444';
    };

    const getIssueTypeLabel = (type: string) => {
      const labels = { must_fix: '必须修改', should_fix: '建议修改', potential_issue: '潜在问题' };
      return labels[type as keyof typeof labels] || type;
    };

    const getStatusBadge = (status: string) => {
      const badges = {
        present: { text: '存在', color: '#22c55e', bg: '#dcfce7' },
        missing: { text: '缺失', color: '#ef4444', bg: '#fee2e2' },
        incomplete: { text: '不完整', color: '#eab308', bg: '#fef9c3' },
      };
      const badge = badges[status as keyof typeof badges];
      return `<span style="background-color: ${badge.bg}; color: ${badge.color}; padding: 2px 8px; border-radius: 9999px; font-size: 12px; font-weight: 500;">${badge.text}</span>`;
    };

    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>专利审查报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', 'Helvetica Neue', Helvetica, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'; line-height: 1.6; color: #1f2937; background: #f9fafb; padding: 20px; }
    .container { max-width: 900px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
    .header { background: #1f2937; padding: 40px; color: white; }
    .header h1 { font-size: 32px; font-weight: 700; margin-bottom: 12px; }
    .header p { font-size: 16px; opacity: 0.9; }
    .score-section { background: white; padding: 30px; border-bottom: 1px solid #e5e7eb; }
    .score-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .score-value { font-size: 48px; font-weight: 700; }
    .summary { color: #6b7280; line-height: 1.8; }
    .section { padding: 30px; border-bottom: 1px solid #e5e7eb; }
    .section:last-child { border-bottom: none; }
    .section-title { font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 20px; display: flex; align-items: center; gap: 8px; }
    .completeness-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    @media (min-width: 768px) { .completeness-grid { grid-template-columns: repeat(4, 1fr); } }
    .completeness-item { background: #f9fafb; padding: 12px; border-radius: 8px; display: flex; align-items: center; gap: 8px; }
    .issue-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 16px; }
    .issue-header { display: flex; align-items: start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
    .issue-category { font-size: 16px; font-weight: 600; }
    .issue-message { color: #4b5563; line-height: 1.6; margin-bottom: 12px; }
    .issue-detail { background: #f9fafb; padding: 12px; border-radius: 6px; margin-bottom: 8px; }
    .issue-detail-label { font-weight: 600; color: #374151; margin-right: 8px; }
    .issue-detail-content { color: #6b7280; word-break: break-word; }
    .improvement-item { background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 12px; display: flex; gap: 12px; align-items: start; }
    .improvement-content { color: #4b5563; line-height: 1.6; flex: 1; }
    .footer { text-align: center; padding: 20px; color: #9ca3af; font-size: 14px; }
    .error-card { border-color: #fecaca; background: #fef2f2; }
    .warning-card { border-color: #fde68a; background: #fffbeb; }
    .suggestion-card { border-color: #e5e7eb; background: #f9fafb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📄 专利审查报告</h1>
      <p>生成时间：${new Date().toLocaleString('zh-CN')}</p>
    </div>

    <div class="score-section">
      <div class="score-row">
        <div>
          <h2 style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">总体评分</h2>
          <div class="score-value" style="color: ${getScoreColor(safeResult.overallScore)}">${safeResult.overallScore}分</div>
        </div>
      </div>
      <p class="summary">${escapeHtml(safeResult.summary)}</p>
    </div>

    ${safeResult.dimensionScores ? `
    <div class="section">
      <h2 class="section-title">📊 维度评分</h2>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px;">
        <div style="background: #f9fafb; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb;">
          <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">文字表达质量</div>
          <div style="font-size: 32px; font-weight: 700; color: ${getScoreColor((safeResult.dimensionScores as any).expressionQuality || 0)}">${(safeResult.dimensionScores as any).expressionQuality || 0}分</div>
        </div>
        <div style="background: #f9fafb; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb;">
          <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">内容完整性</div>
          <div style="font-size: 32px; font-weight: 700; color: ${getScoreColor((safeResult.dimensionScores as any).contentCompleteness || 0)}">${(safeResult.dimensionScores as any).contentCompleteness || 0}分</div>
        </div>
        <div style="background: #f9fafb; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb;">
          <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">技术合理性</div>
          <div style="font-size: 32px; font-weight: 700; color: ${getScoreColor((safeResult.dimensionScores as any).technicalReasonableness || 0)}">${(safeResult.dimensionScores as any).technicalReasonableness || 0}分</div>
        </div>
        <div style="background: #f9fafb; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb;">
          <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">法律合规性</div>
          <div style="font-size: 32px; font-weight: 700; color: ${getScoreColor((safeResult.dimensionScores as any).legalCompliance || 0)}">${(safeResult.dimensionScores as any).legalCompliance || 0}分</div>
        </div>
        <div style="background: #f9fafb; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb;">
          <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">格式规范性</div>
          <div style="font-size: 32px; font-weight: 700; color: ${getScoreColor((safeResult.dimensionScores as any).formatCompliance || 0)}">${(safeResult.dimensionScores as any).formatCompliance || 0}分</div>
        </div>
        <div style="background: #f9fafb; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb;">
          <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">创新性</div>
          <div style="font-size: 32px; font-weight: 700; color: ${getScoreColor((safeResult.dimensionScores as any).innovationLevel || 0)}">${(safeResult.dimensionScores as any).innovationLevel || 0}分</div>
        </div>
        <div style="background: #f9fafb; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb;">
          <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">保护范围合理性</div>
          <div style="font-size: 32px; font-weight: 700; color: ${getScoreColor((safeResult.dimensionScores as any).protectionScope || 0)}">${(safeResult.dimensionScores as any).protectionScope || 0}分</div>
        </div>
      </div>
    </div>
    ` : ''}

    ${safeResult.completeness && safeResult.completeness.items && safeResult.completeness.items.length > 0 ? `
    <div class="section">
      <h2 class="section-title">✅ 完整性检查</h2>
      <div class="completeness-grid">
        ${safeResult.completeness.items.map((item: any) => `
          <div class="completeness-item">
            ${item.status === 'present' ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>' : ''}
            ${item.status === 'missing' ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>' : ''}
            ${item.status === 'incomplete' ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>' : ''}
            <span>${escapeHtml(item.name)}</span>
            ${getStatusBadge(item.status)}
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    ${safeResult.issues && safeResult.issues.length > 0 ? `
    <div class="section">
      <h2 class="section-title">⚠️ 问题列表 (${safeResult.issues.length})</h2>
      ${safeResult.issues.map((issue: any) => `
        <div class="issue-card ${issue.type === 'must_fix' ? 'error-card' : issue.type === 'should_fix' ? 'warning-card' : 'suggestion-card'}">
          <div class="issue-header">
            <div>
              <div class="issue-category">${escapeHtml(issue.category)}</div>
              <span style="font-size: 12px; padding: 2px 8px; border-radius: 4px; background: ${issue.type === 'must_fix' ? '#fee2e2' : issue.type === 'should_fix' ? '#fef9c3' : '#f3f4f6'}; color: ${issue.type === 'must_fix' ? '#ef4444' : issue.type === 'should_fix' ? '#eab308' : '#4b5563'}; font-weight: 500;">${getIssueTypeLabel(issue.type)}</span>
            </div>
            <span style="font-size: 12px; color: #6b7280;">${issue.severity === 'high' ? '高' : issue.severity === 'medium' ? '中' : '低'}影响</span>
          </div>
          <div class="issue-message">${escapeHtml(issue.message)}</div>
          ${issue.location ? `<div class="issue-detail"><span class="issue-detail-label">位置：</span><span class="issue-detail-content">${escapeHtml(issue.location)}</span></div>` : ''}
          ${issue.originalText ? `<div class="issue-detail"><span class="issue-detail-label">原文：</span><span class="issue-detail-content">${escapeHtml(issue.originalText)}</span></div>` : ''}
          ${issue.revisedText ? `<div class="issue-detail"><span class="issue-detail-label">修改建议：</span><span class="issue-detail-content">${escapeHtml(issue.revisedText)}</span></div>` : ''}
          ${issue.reason ? `<div class="issue-detail"><span class="issue-detail-label">原因：</span><span class="issue-detail-content">${escapeHtml(issue.reason)}</span></div>` : ''}
          ${issue.suggestion ? `<div class="issue-detail"><span class="issue-detail-label">操作建议：</span><span class="issue-detail-content">${escapeHtml(issue.suggestion)}</span></div>` : ''}
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${safeResult.improvements && safeResult.improvements.length > 0 ? `
    <div class="section">
      <h2 class="section-title">💡 改进建议 (${safeResult.improvements.length})</h2>
      ${safeResult.improvements.map((improvement: any) => `
        <div class="improvement-item">
          <div style="flex-shrink: 0;">
            <div style="width: 32px; height: 32px; background: #f3f4f6; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4b5563" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            </div>
          </div>
          <div class="improvement-content">
            <div style="font-weight: 600; margin-bottom: 8px;">${escapeHtml(improvement.direction)}</div>
            <div style="margin-bottom: 12px;">${escapeHtml(improvement.suggestion)}</div>
            ${improvement.example ? `<div style="background: white; padding: 12px; border-radius: 6px; margin-bottom: 8px;"><span style="font-size: 12px; color: #374151; font-weight: 600;">示例：</span><div>${escapeHtml(improvement.example)}</div></div>` : ''}
            ${improvement.expectedEffect ? `<div style="font-size: 12px; color: #6b7280;">预期效果：${escapeHtml(improvement.expectedEffect)}</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <div class="footer">
      <p>本报告由AI专利审查系统自动生成</p>
    </div>
  </div>
</body>
</html>
    `;
  };

  // 下载审查报告
  const handleDownloadReviewReport = (review: ReviewHistory) => {
    console.log('========== handleDownloadReviewReport 开始 ==========');
    console.log('review:', review);
    console.log('review.reviewResult:', review.reviewResult);
    
    if (!review.reviewResult) {
      console.log('❌ 没有 reviewResult');
      alert('暂无审查结果可下载');
      return;
    }

    try {
      console.log('✅ 开始生成HTML报告...');
      const htmlContent = generateHTMLReport(review.reviewResult);
      console.log('✅ HTML生成成功，长度:', htmlContent.length);
      console.log('✅ HTML前200字符:', htmlContent.substring(0, 200));

      // 创建blob
      console.log('✅ 创建Blob...');
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      console.log('✅ Blob创建成功，大小:', blob.size);

      // 创建下载链接
      console.log('✅ 创建下载链接...');
      const url = window.URL.createObjectURL(blob);
      console.log('✅ URL创建成功:', url);

      // 创建a标签
      console.log('✅ 创建a标签...');
      const link = document.createElement('a');
      link.href = url;
      
      const safeTitle = review.title ? review.title.replace(/[^\w\u4e00-\u9fa5]/g, '_') : '审查报告';
      link.download = '专利审查报告_' + safeTitle + '_' + new Date().toISOString().slice(0,10) + '.html';
      link.style.display = 'none';
      
      console.log('✅ 准备点击...');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('✅ 点击完成，释放URL...');
      window.URL.revokeObjectURL(url);
      
      console.log('========== 下载完成 ==========');
    } catch (error) {
      console.error('❌ 下载失败:', error);
      console.error('❌ 错误详情:', error instanceof Error ? error.stack : error);
      alert('下载失败: ' + (error instanceof Error ? error.message : '未知错误'));
    }
  };

  const filteredHistories = histories.filter(history => {
    const matchesSearch = history.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || history.status === filterType;
    return matchesSearch && matchesType;
  });


  const filteredReviewHistories = reviewHistories.filter(review => {
    const matchesSearch = review.title.toLowerCase().includes(reviewSearchQuery.toLowerCase());
    const matchesType = reviewFilterType === 'all' || review.status === reviewFilterType;
    return matchesSearch && matchesType;
  });

  const getStatusLabel = (status: string) => {
    const labels = {
      pending: '待处理',
      generating: '生成中',
      completed: '已完成',
      failed: '失败',
      reviewing: '审查中',
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-muted text-foreground',
      generating: 'bg-brand-subtle text-brand',
      reviewing: 'bg-brand-subtle text-brand',
      completed: 'bg-success text-success',
      failed: 'bg-destructive text-destructive',
    };
    return colors[status as keyof typeof colors] || 'bg-muted text-foreground';
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-destructive';
  };

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'must_fix':
        return <XCircle className="w-5 h-5 text-destructive" />;
      case 'should_fix':
        return <AlertCircle className="w-5 h-5 text-warning" />;
      case 'potential_issue':
        return <FileText className="w-5 h-5 text-brand" />;
      default:
        return <AlertCircle className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getIssueTypeLabel = (type: string) => {
    const labels = { must_fix: '必须修改', should_fix: '建议修改', potential_issue: '潜在问题' };
    return labels[type as keyof typeof labels] || type;
  };

  const getIssueVariant = (type: string) => {
    switch (type) {
      case 'must_fix':
        return 'border-destructive/40 bg-destructive hover:bg-destructive';
      case 'should_fix':
        return 'border-warning/40 bg-warning hover:bg-warning';
      case 'potential_issue':
        return 'border-border bg-brand-subtle hover:bg-brand-subtle';
      default:
        return 'border-border bg-muted hover:bg-muted/80';
    }
  };

  return (
    <div className="min-h-screen">
      {/* 页面标题 */}
      <div className="page-header">
        <div className="container mx-auto max-w-6xl">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 sm:p-3 rounded-xl bg-brand shadow-soft">
              <History className="w-5 h-5 sm:w-6 sm:h-6 text-brand-foreground" />
            </div>
            <div>
              <h1 className="page-title">
                历史记录
              </h1>
              <p className="page-subtitle mt-1">
                查看和管理您的历史专利文档
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 主体内容 */}
      <div className="container mx-auto max-w-6xl px-2 sm:px-4 py-4 sm:py-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'patent' | 'review')}>
          <TabsList className="grid w-full grid-cols-2 mb-6 shadow-soft">
            <TabsTrigger value="patent" className="text-sm font-medium">
              专利生成历史
            </TabsTrigger>
            <TabsTrigger value="review" className="text-sm font-medium">
              专利审查历史
            </TabsTrigger>
          </TabsList>

          {/* 专利生成历史标签页 */}
          <TabsContent value="patent" className="space-y-4">
            {/* 搜索和筛选 */}
            <Card className="shadow-soft">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="搜索专利标题..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant={filterType === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilterType('all')}
                      className={`text-xs ${filterType === 'all' ? '    ' : ''}`}
                    >
                      全部
                    </Button>
                    <Button
                      variant={filterType === 'generating' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilterType('generating')}
                      className={`text-xs ${filterType === 'generating' ? '    ' : ''}`}
                    >
                      生成中
                    </Button>
                    <Button
                      variant={filterType === 'completed' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilterType('completed')}
                      className={`text-xs ${filterType === 'completed' ? '    ' : ''}`}
                    >
                      已完成
                    </Button>
                    <Button
                      variant={filterType === 'failed' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilterType('failed')}
                      className={`text-xs ${filterType === 'failed' ? '    ' : ''}`}
                    >
                      失败
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 历史记录列表 */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 border-4 border-t-brand rounded-full animate-spin" />
                  <p className="text-sm text-muted-foreground">加载历史记录中...</p>
                </div>
              </div>
            ) : filteredHistories.length === 0 ? (
              <Card className="shadow-soft">
                <CardContent className="p-12 text-center">
                  <History className="w-16 h-16 mx-auto text-brand mb-4" />
                  <h3 className="lead-title mb-2">
                    {searchQuery || filterType !== 'all' ? '没有找到匹配的记录' : '暂无历史记录'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {searchQuery || filterType !== 'all'
                      ? '请尝试其他搜索条件或筛选选项'
                      : '开始生成专利文档后，历史记录将显示在这里'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredHistories.map((history) => (
                  <Card
                    key={history.id}
                    className="shadow-soft hover:shadow-soft transition-all duration-300"
                  >
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge className={getStatusColor(history.status)}>
                              {getStatusLabel(history.status)}
                            </Badge>
                            {history.status === 'generating' && (
                              <Badge variant="outline" className="text-brand">
                                {history.progress}%
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(history.createdAt).toLocaleDateString('zh-CN')}
                            </span>
                          </div>
                          <h3 className="section-title mb-2 truncate">
                            {history.title}
                          </h3>
                          {history.status === 'generating' && history.currentStage && (
                            <p className="text-xs text-brand mb-1 truncate">
                              {history.currentStage}
                            </p>
                          )}
                          {history.status === 'failed' && history.errorMessage && (
                            <p className="text-xs text-destructive mb-1 truncate">
                              {history.errorMessage}
                            </p>
                          )}
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {history.content}
                          </p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          {history.status === 'completed' && (
                            <>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSelectedHistory(history)}
                                    className="hover:border-border hover:bg-brand-subtle"
                                  >
                                    <FileText className="w-4 h-4 mr-1" />
                                    查看
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="bg-card max-w-4xl overflow-hidden">
                                  <DialogHeader className="pb-4 border-b">
                                    <DialogTitle className="lead-title pr-8">{history.title}</DialogTitle>
                                    <DialogDescription className="text-muted-foreground mt-1">
                                      {new Date(history.createdAt).toLocaleString('zh-CN')}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <ScrollArea className="h-[60vh] w-full rounded-lg border-0 bg-card p-4 shadow-inner overflow-hidden">
                                    <pre className="text-sm whitespace-pre-wrap font-sans text-foreground leading-relaxed break-all max-w-full">
                                      {history.generatedContent}
                                    </pre>
                                  </ScrollArea>
                                </DialogContent>
                              </Dialog>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownload(history)}
                                className="hover:bg-muted hover:text-brand"
                              >
                                <Download className="w-4 h-4 mr-1" />
                                下载
                              </Button>
                            </>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(history.id)}
                            className="border-destructive/40 text-destructive hover:bg-destructive-subtle"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* 专利审查历史标签页 */}
          <TabsContent value="review" className="space-y-4">
            {/* 搜索和筛选 */}
            <Card className="shadow-soft">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="搜索审查标题..."
                        value={reviewSearchQuery}
                        onChange={(e) => setReviewSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant={reviewFilterType === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setReviewFilterType('all')}
                      className={`text-xs ${reviewFilterType === 'all' ? '    ' : ''}`}
                    >
                      全部
                    </Button>
                    <Button
                      variant={reviewFilterType === 'reviewing' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setReviewFilterType('reviewing')}
                      className={`text-xs ${reviewFilterType === 'reviewing' ? '    ' : ''}`}
                    >
                      审查中
                    </Button>
                    <Button
                      variant={reviewFilterType === 'completed' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setReviewFilterType('completed')}
                      className={`text-xs ${reviewFilterType === 'completed' ? '    ' : ''}`}
                    >
                      已完成
                    </Button>
                    <Button
                      variant={reviewFilterType === 'failed' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setReviewFilterType('failed')}
                      className={`text-xs ${reviewFilterType === 'failed' ? '    ' : ''}`}
                    >
                      失败
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 审查记录列表 */}
            {reviewLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 border-4 border-t-brand rounded-full animate-spin" />
                  <p className="text-sm text-muted-foreground">加载审查记录中...</p>
                </div>
              </div>
            ) : filteredReviewHistories.length === 0 ? (
              <Card className="shadow-soft">
                <CardContent className="p-12 text-center">
                  <FileCheck className="w-16 h-16 mx-auto text-brand mb-4" />
                  <h3 className="lead-title mb-2">
                    {reviewSearchQuery || reviewFilterType !== 'all' ? '没有找到匹配的记录' : '暂无审查记录'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {reviewSearchQuery || reviewFilterType !== 'all'
                      ? '请尝试其他搜索条件或筛选选项'
                      : '开始专利审查后，审查记录将显示在这里'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredReviewHistories.map((review) => (
                  <Card
                    key={review.id}
                    className="shadow-soft hover:shadow-soft transition-all duration-300"
                  >
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge className={getStatusColor(review.status)}>
                              {getStatusLabel(review.status)}
                            </Badge>
                            {review.status === 'reviewing' && (
                              <Badge variant="outline" className="text-brand">
                                {review.progress}%
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(review.createdAt).toLocaleDateString('zh-CN')}
                            </span>
                          </div>
                          <h3 className="section-title mb-2 truncate">
                            {review.title}
                          </h3>
                          {review.status === 'reviewing' && review.currentStage && (
                            <p className="text-xs text-brand mb-1 truncate">
                              {review.currentStage}
                            </p>
                          )}
                          {review.status === 'failed' && review.errorMessage && (
                            <p className="text-xs text-destructive mb-1 truncate">
                              {review.errorMessage}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          {review.status === 'completed' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewReview(review.id)}
                                className="hover:border-border hover:bg-brand-subtle"
                              >
                                <FileText className="w-4 h-4 mr-1" />
                                查看
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadReviewReport(review)}
                                className="hover:bg-muted hover:text-brand"
                              >
                                <Download className="w-4 h-4 mr-1" />
                                下载报告
                              </Button>
                            </>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReviewDelete(review.id)}
                            className="border-destructive/40 text-destructive hover:bg-destructive-subtle"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* 审查详情对话框 */}
        {selectedReview && (
          <Dialog open={!!selectedReview} onOpenChange={() => setSelectedReview(null)}>
            <DialogContent className="bg-card max-w-5xl">
              <DialogHeader className="pb-4 border-b">
                <DialogTitle className="lead-title flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-brand" />
                  专利审查报告
                </DialogTitle>
                <DialogDescription className="text-muted-foreground mt-1">
                  审查时间：{new Date(selectedReview.createdAt || Date.now()).toLocaleString('zh-CN')}
                </DialogDescription>
              </DialogHeader>
              {selectedReview.reviewResult ? (
                <div className="flex flex-col gap-4">
                  {/* 下载按钮 */}
                  <Button
                    className="w-full text-primary-foreground border-0 font-medium shadow-soft hover:shadow-soft transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] bg-primary"
                    onClick={() => handleDownloadReviewReport(selectedReview)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    下载审查报告 (HTML)
                  </Button>
                  {/* 使用iframe显示HTML报告 */}
                  <div className="h-[65vh] w-full rounded-lg border-0 shadow-inner overflow-hidden bg-card">
                    <iframe
                      srcDoc={generateHTMLReport(selectedReview.reviewResult)}
                      title="专利审查报告"
                      className="w-full h-full border-0"
                      sandbox="allow-same-origin"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileCheck className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">暂无审查结果</p>
                </div>
              )}
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
