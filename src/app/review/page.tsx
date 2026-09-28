'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Send, Download, AlertCircle, CheckCircle, Info, RefreshCw, Loader2, FileCheck, CheckSquare, XCircle, Brain, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useUser } from '@/contexts/UserContext';
import mammoth from 'mammoth';


interface Improvement {
  direction: string;
  suggestion: string;
  example: string;
  expectedEffect: string;
}

interface Issue {
  type: 'must_fix' | 'should_fix' | 'potential_issue';
  severity: 'high' | 'medium' | 'low';
  category: string;
  message: string;
  location: string;
  originalText: string;
  revisedText: string;
  reason: string;
  suggestion: string;
  reference: string;
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
  issues: Issue[];
  improvements: Improvement[];
  completeness: {
    score: number;
    items: Array<{ name: string; status: 'present' | 'missing' | 'incomplete' }>;
  };
}

export default function ReviewPage() {
  const { currentUser, setNeedsAuth, isLoading } = useUser();
  const [inputMethod, setInputMethod] = useState<'text' | 'file'>('text');
  const [textContent, setTextContent] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [streamContent, setStreamContent] = useState('');
  const [isFileUploadActive, setIsFileUploadActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 任务管理
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState('');
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentTaskIdRef = useRef<string | null>(null);
  const hasRestoredTaskRef = useRef(false); // 防止重复恢复任务的标志

  // 检查用户登录状态（只有在isLoading完成后才检查）
  useEffect(() => {
    if (!isLoading && !currentUser) {
      // 只有在加载完成后且用户未登录时，才显示登录弹窗
      console.log('ReviewPage: 用户未登录，显示登录弹窗');
      setNeedsAuth(true);
    }
  }, [currentUser, isLoading, setNeedsAuth]);

  // 页面加载时恢复未完成的任务
  useEffect(() => {
    let cleanup: (() => void) | null = null;

    if (currentUser?.id) {
      const loadPendingTask = async () => {
        console.log('ReviewPage: 开始检查活跃审查任务...', {
          isReviewing,
          currentTaskId: currentTaskIdRef.current,
          userId: currentUser.id,
        });

        // 如果已经在审查中，不再重复恢复
        if (isReviewing || currentTaskIdRef.current) {
          console.log('ReviewPage: 已经在审查中，跳过恢复');
          return;
        }

        try {
          console.log('ReviewPage: 正在请求用户最新的一条审查任务...');
          const response = await fetch('/api/review-histories', {
            headers: { 'x-user-id': currentUser.id },
          });
          const histories = await response.json();
          console.log('ReviewPage: 获取到的审查任务列表:', histories);

          if (Array.isArray(histories) && histories.length > 0) {
            // 只检查最新的一条任务（第一个元素）
            const latestTask = histories[0];
            console.log('ReviewPage: 最新一条审查任务:', latestTask.id, '状态:', latestTask.status, '创建时间:', latestTask.created_at);

            // 只有最新任务状态为 reviewing 时才恢复
            if (latestTask.status !== 'reviewing') {
              console.log('ReviewPage: 最新审查任务状态不是 reviewing (状态:', latestTask.status, ')，跳过恢复');
              hasRestoredTaskRef.current = true; // 标记已检查过

              // 如果最新任务是completed，恢复审查结果
              if (latestTask.status === 'completed' && latestTask.reviewResult) {
                console.log('ReviewPage: 最新审查任务已完成，恢复审查结果');
                setReviewResult(latestTask.reviewResult);
                setProgress(100);
                setCurrentStage('审查完成');
              }

              return;
            }

            console.log('ReviewPage: 最新审查任务状态为 reviewing，准备恢复');
            const taskId = latestTask.id;

            // 在恢复之前，立即验证任务实际状态
            console.log('ReviewPage: 立即验证任务实际状态...');
            try {
              const statusResponse = await fetch(`/api/review-tasks/${taskId}/status`, {
                headers: { 'x-user-id': currentUser.id },
              });

              if (statusResponse.ok) {
                const statusData = await statusResponse.json();
                console.log('ReviewPage: 任务实际状态:', statusData.status);

                // 如果任务已经完成或失败，不恢复
                if (statusData.status === 'completed') {
                  console.log('ReviewPage: 任务已完成，跳过恢复');
                  hasRestoredTaskRef.current = true;

                  // 如果有审查结果，恢复它
                  if (statusData.reviewResult) {
                    setReviewResult(statusData.reviewResult);
                    setProgress(100);
                    setCurrentStage('审查完成');
                  }

                  return;
                }

                if (statusData.status === 'failed') {
                  console.log('ReviewPage: 任务已失败，跳过恢复');
                  hasRestoredTaskRef.current = true;
                  alert(`审查任务失败: ${statusData.errorMessage || '未知错误'}`);
                  return;
                }
              } else {
                console.log('ReviewPage: 状态检查失败，跳过恢复');
                hasRestoredTaskRef.current = true;
                return;
              }
            } catch (error) {
              console.error('ReviewPage: 检查任务状态失败:', error);
              // 检查失败时不恢复任务
              hasRestoredTaskRef.current = true;
              return;
            }

            // 设置任务ID并开始审查状态
            setCurrentTaskId(taskId);
            currentTaskIdRef.current = taskId;
            setIsReviewing(true);
            hasRestoredTaskRef.current = true; // 标记已恢复

            // 恢复任务输入数据（如果有）
            if (latestTask.input_text) {
              setTextContent(latestTask.input_text);
            }
            if (latestTask.input_method) {
              setInputMethod(latestTask.input_method);
            }

            // 添加超时控制（30分钟）
            const timeoutId = setTimeout(() => {
              console.log('ReviewPage: 审查任务轮询超时，停止轮询');
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
              }
              setIsReviewing(false);
              alert('审查任务执行超时，请手动检查任务状态');
            }, 30 * 60 * 1000); // 30分钟

            // 轮询任务状态
            const pollTaskStatus = async () => {
              // 检查页面是否可见
              if (typeof document !== 'undefined' && document.hidden) {
                console.log('ReviewPage: 页面不可见，跳过本次轮询');
                return;
              }

              try {
                const response = await fetch(`/api/review-tasks/${taskId}/status`, {
                  headers: { 'x-user-id': currentUser.id },
                });
                const statusData = await response.json();

                if (statusData.status === 'completed') {
                  console.log('ReviewPage: 审查任务完成，停止轮询');
                  clearTimeout(timeoutId);
                  if (pollingIntervalRef.current) {
                    clearInterval(pollingIntervalRef.current);
                    pollingIntervalRef.current = null;
                  }
                  setIsReviewing(false);
                  currentTaskIdRef.current = null; // 清除ref
                  setProgress(100);
                  setCurrentStage('审查完成');
                  if (statusData.reviewResult) {
                    setReviewResult(statusData.reviewResult);
                  }
                } else if (statusData.status === 'failed') {
                  console.log('ReviewPage: 审查任务失败，停止轮询:', statusData.errorMessage);
                  clearTimeout(timeoutId);
                  if (pollingIntervalRef.current) {
                    clearInterval(pollingIntervalRef.current);
                    pollingIntervalRef.current = null;
                  }
                  setIsReviewing(false);
                  currentTaskIdRef.current = null; // 清除ref
                  alert(`审查失败: ${statusData.errorMessage || '未知错误'}`);
                } else {
                  setProgress(statusData.progress || 0);
                  setCurrentStage(statusData.currentStage || '');
                }
              } catch (error) {
                console.error('ReviewPage: 获取任务状态失败:', error);
              }
            };

            // 立即查询一次
            pollTaskStatus();

            // 每2秒轮询一次
            pollingIntervalRef.current = setInterval(pollTaskStatus, 2000);

            // 页面可见性变化监听
            const handleVisibilityChange = () => {
              if (document.hidden) {
                console.log('ReviewPage: 页面隐藏，暂停审查轮询');
                if (pollingIntervalRef.current) {
                  clearInterval(pollingIntervalRef.current);
                  pollingIntervalRef.current = null;
                }
              } else {
                console.log('ReviewPage: 页面可见，恢复审查轮询');
                if (!pollingIntervalRef.current && isReviewing) {
                  pollTaskStatus();
                  pollingIntervalRef.current = setInterval(pollTaskStatus, 2000);
                }
              }
            };

            document.addEventListener('visibilitychange', handleVisibilityChange);

            cleanup = () => {
              console.log('ReviewPage: 清理轮询和事件监听');
              document.removeEventListener('visibilitychange', handleVisibilityChange);
              clearTimeout(timeoutId);
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
              }
            };
          } else {
            console.log('ReviewPage: 未找到未完成的审查任务，跳过恢复');
            hasRestoredTaskRef.current = true;
          }
        } catch (error) {
          console.error('ReviewPage: 加载未完成任务失败:', error);
          hasRestoredTaskRef.current = true;
        }
      };

      loadPendingTask();
    }

    return () => {
      if (cleanup) {
        console.log('ReviewPage: 执行cleanup');
        cleanup();
      }
    };
  }, [currentUser, isReviewing]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // 验证文件类型
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      const allowedExtensions = ['docx'];

      if (!allowedExtensions.includes(fileExtension || '')) {
        alert(`不支持的文件格式。仅支持 .docx 格式，当前文件格式：.${fileExtension}`);
        return;
      }

      setUploadedFile(file);

      try {
        let textContent = '';

        if (fileExtension === 'docx') {
          // 处理 .docx 文件
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          textContent = result.value;

          // 清理文本：移除不可见控制字符和过多空白
          textContent = textContent
            // 替换多个空白字符为单个空格
            .replace(/[ \t]+/g, ' ')
            // 替换多个换行为单个换行
            .replace(/\n{3,}/g, '\n\n')
            // 移除不可见控制字符（保留换行符和制表符）
            .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
            // 移除BOM标记
            .replace(/^\ufeff/, '')
            // 去除首尾空白
            .trim();
        }

        setTextContent(textContent);
      } catch (error) {
        console.error('文件读取失败:', error);
        alert(`文件读取失败: ${error instanceof Error ? error.message : '未知错误'}`);
        setUploadedFile(null);
      }
    }
  };

  const handleStartReview = async () => {
    if (!textContent.trim()) {
      return;
    }

    // 检查用户是否登录
    if (!currentUser || !currentUser.id) {
      setNeedsAuth(true);
      return;
    }

    // 检查是否正在进行中的审查任务
    try {
      const response = await fetch('/api/review-histories', {
        headers: { 'x-user-id': currentUser.id },
      });
      const histories = await response.json();

      if (Array.isArray(histories) && histories.length > 0) {
        const latestTask = histories[0];

        // 如果最新任务是进行中，不允许发起新任务
        if (latestTask.status === 'reviewing' || isReviewing) {
          alert('您有一条正在进行的审查任务，请等待它完成后再开始新的审查。');
          return;
        }
      }
    } catch (error) {
      console.error('检查任务状态失败:', error);
    }

    // 停止之前的轮询（如果有的话）
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    setIsReviewing(true);
    setStreamContent('');
    setReviewResult(null);
    setProgress(0);
    setCurrentStage('正在创建审查任务...');

    try {
      // 第一步：创建审查任务
      const createResponse = await fetch('/api/review-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({
          content: textContent,
          title: uploadedFile?.name || '专利文档审查',
        }),
      });

      if (!createResponse.ok) {
        throw new Error('创建审查任务失败');
      }

      const createData = await createResponse.json();
      const taskId = createData.taskId;
      setCurrentTaskId(taskId);

      // 第二步：调用审查API（SSE流式输出）
      const response = await fetch('/api/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({ content: textContent, taskId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('审查请求失败:', errorText);
        throw new Error(`审查请求失败: ${errorText || '未知错误'}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法读取响应流');
      }

      const decoder = new TextDecoder();
      let rawContent = '';
      let filteredContent = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          rawContent += chunk;

          // 解析[PROGRESS]标记并更新进度
          const progressRegex = /\[PROGRESS\]\s*(\{[^\}]*\})\n?/g;
          let match;
          while ((match = progressRegex.exec(chunk)) !== null) {
            try {
              const progressData = JSON.parse(match[1]);
              if (progressData.percent !== undefined) {
                setProgress(progressData.percent);
              }
              if (progressData.stage !== undefined) {
                setCurrentStage(progressData.stage);
              }
            } catch (e) {
              console.error('解析进度数据失败:', e);
            }
          }

          // 过滤掉[PROGRESS]标记，只保留实际内容
          filteredContent = rawContent.replace(/\[PROGRESS\][^\n]*\n?/g, '');

          // 显示过滤后的内容
          setStreamContent(filteredContent);
        }
        console.log('流式读取完成');
      } catch (streamError) {
        console.error('流式读取错误:', streamError);
        // 流式读取错误不代表任务失败，后端可能还在处理
        // 通过轮询来检查最终状态
      }

      // 添加超时控制（30分钟）
      const timeoutId = setTimeout(() => {
        console.log('审查任务轮询超时，停止轮询');
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        setIsReviewing(false);
        alert('审查任务执行超时，请手动检查任务状态');
      }, 30 * 60 * 1000); // 30分钟

      // 轮询任务状态
      const pollTaskStatus = async () => {
        // 检查页面是否可见
        if (typeof document !== 'undefined' && document.hidden) {
          console.log('页面不可见，跳过本次轮询');
          return;
        }

        try {
          const statusResponse = await fetch(`/api/review-tasks/${taskId}/status`, {
            headers: { 'x-user-id': currentUser!.id },
          });
          const statusData = await statusResponse.json();

          if (statusData.status === 'completed') {
            console.log('审查任务完成，停止轮询');
            clearTimeout(timeoutId);
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            setIsReviewing(false);
            setProgress(100);
            setCurrentStage('审查完成');
            if (statusData.reviewResult) {
              setReviewResult(statusData.reviewResult);
            }
          } else if (statusData.status === 'failed') {
            console.log('审查任务失败，停止轮询:', statusData.errorMessage);
            clearTimeout(timeoutId);
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            setIsReviewing(false);
            alert(`审查失败: ${statusData.errorMessage || '未知错误'}`);
          } else {
            setProgress(statusData.progress || 0);
            setCurrentStage(statusData.currentStage || '');
          }
        } catch (error) {
          console.error('获取任务状态失败:', error);
        }
      };

      // 立即查询一次
      pollTaskStatus();

      // 每2秒轮询一次
      pollingIntervalRef.current = setInterval(pollTaskStatus, 2000);

      // 页面可见性变化监听
      const handleVisibilityChange = () => {
        if (document.hidden) {
          console.log('页面隐藏，暂停审查轮询');
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        } else {
          console.log('页面可见，恢复审查轮询');
          if (!pollingIntervalRef.current && isReviewing) {
            pollTaskStatus();
            pollingIntervalRef.current = setInterval(pollTaskStatus, 2000);
          }
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      // 清理函数（存储到ref以便后续使用）
      const cleanup = () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        clearTimeout(timeoutId);
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };

      // 将cleanup函数存储到ref，以便handleReset时调用
      (window as any).__reviewCleanup = cleanup;
    } catch (error) {
      console.error('审查失败:', error);
      alert('审查失败，请稍后重试');
      setIsReviewing(false);
    }
  };

  const handleReset = () => {
    // 调用cleanup函数（如果存在）
    if ((window as any).__reviewCleanup) {
      (window as any).__reviewCleanup();
      delete (window as any).__reviewCleanup;
    }

    setTextContent('');
    setUploadedFile(null);
    setReviewResult(null);
    setStreamContent('');
    setIsFileUploadActive(false);
    setCurrentTaskId(null);
    setProgress(0);
    setCurrentStage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const handleDownloadReport = () => {
    console.log('========== handleDownloadReport 开始 ==========');
    console.log('reviewResult:', reviewResult);
    
    if (!reviewResult) {
      console.log('❌ 没有 reviewResult');
      alert('暂无审查结果可下载');
      return;
    }

    try {
      console.log('✅ 开始生成HTML报告...');
      const htmlContent = generateHTMLReport(reviewResult);
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
      link.download = '专利审查报告_' + new Date().toISOString().slice(0,10) + '.html';
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

  const generateHTMLReport = (result: ReviewResult): string => {
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
      <h1>专利审查报告</h1>
      <p>生成时间：${new Date().toLocaleString('zh-CN')}</p>
    </div>

    <div class="score-section">
      <div class="score-row">
        <div>
          <h2 style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">总体评分</h2>
          <div class="score-value" style="color: ${getScoreColor(result.overallScore)}">${result.overallScore}分</div>
        </div>
      </div>
      <p class="summary">${escapeHtml(result.summary)}</p>
    </div>

    ${result.dimensionScores ? `
    <div class="section">
      <h2 class="section-title">维度评分</h2>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px;">
        <div style="background: #f9fafb; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb;">
          <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">文字表达质量</div>
          <div style="font-size: 32px; font-weight: 700; color: ${getScoreColor(result.dimensionScores.expressionQuality)}">${result.dimensionScores.expressionQuality}分</div>
        </div>
        <div style="background: #f9fafb; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb;">
          <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">内容完整性</div>
          <div style="font-size: 32px; font-weight: 700; color: ${getScoreColor(result.dimensionScores.contentCompleteness)}">${result.dimensionScores.contentCompleteness}分</div>
        </div>
        <div style="background: #f9fafb; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb;">
          <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">技术合理性</div>
          <div style="font-size: 32px; font-weight: 700; color: ${getScoreColor(result.dimensionScores.technicalReasonableness)}">${result.dimensionScores.technicalReasonableness}分</div>
        </div>
        <div style="background: #f9fafb; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb;">
          <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">法律合规性</div>
          <div style="font-size: 32px; font-weight: 700; color: ${getScoreColor(result.dimensionScores.legalCompliance)}">${result.dimensionScores.legalCompliance}分</div>
        </div>
        <div style="background: #f9fafb; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb;">
          <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">格式规范性</div>
          <div style="font-size: 32px; font-weight: 700; color: ${getScoreColor(result.dimensionScores.formatCompliance)}">${result.dimensionScores.formatCompliance}分</div>
        </div>
        <div style="background: #f9fafb; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb;">
          <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">创新性</div>
          <div style="font-size: 32px; font-weight: 700; color: ${getScoreColor(result.dimensionScores.innovationLevel)}">${result.dimensionScores.innovationLevel}分</div>
        </div>
        <div style="background: #f9fafb; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb;">
          <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">保护范围合理性</div>
          <div style="font-size: 32px; font-weight: 700; color: ${getScoreColor(result.dimensionScores.protectionScope)}">${result.dimensionScores.protectionScope}分</div>
        </div>
      </div>
    </div>
    ` : ''}

    ${result.completeness && result.completeness.items.length > 0 ? `
    <div class="section">
      <h2 class="section-title">完整性检查</h2>
      <div class="completeness-grid">
        ${result.completeness.items.map(item => `
          <div class="completeness-item">
            ${getStatusBadge(item.status)}
            <span style="font-size: 13px; color: #374151;">${escapeHtml(item.name)}</span>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    ${result.issues && result.issues.length > 0 ? `
    <div class="section">
      <h2 class="section-title">问题列表 (${result.issues.length})</h2>
      ${result.issues.map(issue => `
        <div class="issue-card ${issue.type}-card">
          <div class="issue-header">
            <span class="issue-category">${escapeHtml(issue.category)}</span>
            <span style="background: ${issue.type === 'must_fix' ? '#fee2e2' : issue.type === 'should_fix' ? '#fef9c3' : '#f3f4f6'}; color: ${issue.type === 'must_fix' ? '#dc2626' : issue.type === 'should_fix' ? '#ca8a04' : '#4b5563'}; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600;">${getIssueTypeLabel(issue.type)}</span>
          </div>
          <p class="issue-message">${escapeHtml(issue.message)}</p>
          ${issue.location ? `<div class="issue-detail"><span class="issue-detail-label">位置：</span><span class="issue-detail-content">${escapeHtml(issue.location)}</span></div>` : ''}
          ${issue.originalText ? `<div class="issue-detail"><span class="issue-detail-label">原文：</span><span class="issue-detail-content" style="color: #dc2626;">${escapeHtml(issue.originalText)}</span></div>` : ''}
          ${issue.revisedText ? `<div class="issue-detail"><span class="issue-detail-label">修改后：</span><span class="issue-detail-content" style="color: #16a34a;">${escapeHtml(issue.revisedText)}</span></div>` : ''}
          ${issue.reason ? `<div class="issue-detail"><span class="issue-detail-label">原因：</span><span class="issue-detail-content">${escapeHtml(issue.reason)}</span></div>` : ''}
          ${issue.suggestion ? `<div class="issue-detail"><span class="issue-detail-label">建议：</span><span class="issue-detail-content">${escapeHtml(issue.suggestion)}</span></div>` : ''}
          ${issue.reference ? `<div class="issue-detail"><span class="issue-detail-label">依据：</span><span class="issue-detail-content">${escapeHtml(issue.reference)}</span></div>` : ''}
          ${issue.sourceUrl ? `<div style="margin-top: 8px;"><a href="${escapeHtml(issue.sourceUrl)}" target="_blank" style="color: #374151; text-decoration: underline; font-size: 14px;">查看来源 →</a></div>` : ''}
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${result.improvements && result.improvements.length > 0 ? `
    <div class="section">
      <h2 class="section-title">改进建议</h2>
      ${result.improvements.map(imp => `
        <div class="improvement-item">
          
          <div class="improvement-content">
            <div style="font-weight: 600; margin-bottom: 8px; color: #374151;">${escapeHtml(imp.direction)}</div>
            <div style="margin-bottom: 8px;">${escapeHtml(imp.suggestion)}</div>
            <div style="background: #f9fafb; padding: 12px; border-radius: 6px; margin-bottom: 8px;">
              <div style="font-size: 12px; color: #374151; margin-bottom: 4px;">改进实例：</div>
              <div style="font-size: 14px; color: #1f2937;">${escapeHtml(imp.example)}</div>
            </div>
            <div style="font-size: 13px; color: #6b7280;">预期效果：${escapeHtml(imp.expectedEffect)}</div>
          </div>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <div class="footer">
      <p>本报告由 AI 专利审查系统自动生成</p>
    </div>
  </div>
</body>
</html>
    `;
  };

  const getIssueIcon = (type: Issue['type']) => {
    switch (type) {
      case 'must_fix':
        return <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />;
      case 'should_fix':
        return <AlertCircle className="w-4 h-4 text-warning flex-shrink-0" />;
      case 'potential_issue':
        return <Info className="w-4 h-4 text-info flex-shrink-0" />;
    }
  };

  const getIssueVariant = (type: Issue['type']) => {
    switch (type) {
      case 'must_fix':
        return 'destructive' as const;
      case 'should_fix':
        return 'default' as const;
      case 'potential_issue':
        return 'default' as const;
    }
  };

  const getIssueBgColor = (type: Issue['type']) => {
    switch (type) {
      case 'must_fix':
        return 'bg-destructive-subtle';
      case 'should_fix':
        return 'bg-warning-subtle';
      case 'potential_issue':
        return 'bg-info-subtle';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />;
      case 'missing':
        return <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />;
      case 'incomplete':
        return <AlertCircle className="w-4 h-4 text-warning flex-shrink-0" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <div className="h-[calc(100vh-30px)] flex flex-col overflow-hidden">
      {/* 页面标题 */}
      <div className="page-header flex-shrink-0">
        <div className="container mx-auto">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 sm:p-3 rounded-xl bg-brand shadow-soft">
                <FileCheck className="w-5 h-5 sm:w-6 sm:h-6 text-brand-foreground" />
              </div>
              <div>
                <h1 className="page-title">专利审查</h1>
                <p className="page-subtitle">AI驱动的专利文档智能审查系统</p>
              </div>
            </div>
            {reviewResult && (
              <div className="flex items-center gap-2 px-4 py-2 bg-success-subtle rounded-lg">
                <CheckCircle className="w-5 h-5 text-success" />
                <span className="text-sm font-semibold text-success">审查完成</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 主体内容 */}
      <div className="flex-1 overflow-hidden">
        <div className="container mx-auto px-4 py-4 h-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
            {/* 左侧：输入区域 */}
            <div className="flex flex-col h-full min-h-0">
              <Card className="flex-1 flex flex-col min-h-0 shadow-soft">
                <CardHeader className="flex-shrink-0">
                  <CardTitle className="lead-title flex items-center gap-2">
                    <Upload className="w-5 h-5 text-brand" />
                    专利文档输入
                  </CardTitle>
                  <CardDescription className="text-xs font-medium text-muted-foreground mt-1">上传文件或直接输入专利内容进行审查</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-4">
                  <Tabs value={inputMethod} onValueChange={(v) => {
                    setInputMethod(v as 'text' | 'file');
                    setIsFileUploadActive(false);
                  }} className="flex-1 flex flex-col min-h-0">
                    <TabsList className="grid w-full grid-cols-2 mb-4 px-1.5 py-0.5 rounded-xl bg-muted">
                      <TabsTrigger
                        value="text"
                        className="text-sm font-medium transition-colors data-[state=active]:text-brand data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted"
                      >
                        文本输入
                      </TabsTrigger>
                      <TabsTrigger
                        value="file"
                        className="text-sm font-medium transition-colors data-[state=active]:text-brand data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted"
                      >
                        文件上传
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="text" className="flex-1 flex flex-col min-h-0">
                      <Textarea
                        placeholder="请在此处粘贴专利内容..."
                        value={textContent}
                        onChange={(e) => setTextContent(e.target.value)}
                        className="flex-1 min-h-0 resize-none text-sm text-foreground placeholder:text-muted-foreground transition-colors"
                        disabled={isReviewing}
                      />
                    </TabsContent>

                    <TabsContent value="file" className="flex-1 flex flex-col min-h-0">
                      <div
                        className={`flex-1 rounded-xl p-8 text-center cursor-pointer bg-muted transition-colors ${
                          isFileUploadActive
                            ? 'bg-brand-subtle'
                            : 'hover:bg-accent'
                        }`}
                        onClick={() => {
                          setIsFileUploadActive(true);
                          fileInputRef.current?.click();
                        }}
                        onMouseLeave={() => {
                          if (!uploadedFile) {
                            setIsFileUploadActive(false);
                          }
                        }}
                      >
                        <div className="mb-4">
                          <Upload className="w-16 h-16 mx-auto text-muted-foreground hover:text-brand transition-colors" />
                        </div>
                        <p className="text-base font-medium text-foreground mb-2">
                          点击上传或拖拽文件到此处
                        </p>
                        <p className="text-sm text-muted-foreground">
                          支持 .docx 格式
                        </p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".docx"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </div>
                      {uploadedFile && (
                        <div className="flex items-center gap-3 p-4 bg-muted rounded-xl mt-3">
                          <div className="p-2 bg-brand-subtle rounded-lg">
                            <FileText className="w-5 h-5 text-brand" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {uploadedFile.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {(uploadedFile.size / 1024).toFixed(2)} KB
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setUploadedFile(null);
                              setTextContent('');
                              if (fileInputRef.current) {
                                fileInputRef.current.value = '';
                              }
                            }}
                            className="h-9 px-3 text-xs font-medium hover:text-destructive transition-colors"
                          >
                            删除
                          </Button>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>

                  <div className="flex gap-3 mt-4 flex-shrink-0">
                    <Button
                      onClick={handleStartReview}
                      disabled={!textContent.trim() || isReviewing}
                      className="flex-1 text-sm font-semibold"
                    >
                      {isReviewing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          审查中...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          开始审查
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleReset}
                      disabled={isReviewing}
                      className="text-sm font-medium"
                    >
                      重置
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 右侧：审查结果 */}
            <div className="flex flex-col h-full min-h-0">
              <Card className="flex-1 flex flex-col min-h-0 shadow-soft">
                <CardHeader className="flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="lead-title flex items-center gap-2">
                        <FileCheck className="w-5 h-5 text-brand" />
                        审查报告
                      </CardTitle>
                      <CardDescription className="text-xs font-medium text-muted-foreground mt-1">
                        {isReviewing ? '正在生成审查报告...' : reviewResult ? '审查完成' : '等待审查...'}
                      </CardDescription>
                    </div>
                    {reviewResult && (
                      <Badge variant="success" className="font-medium">
                        <CheckSquare className="w-3 h-3 mr-1" />
                        已完成
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-4">
                  <ScrollArea className="h-full">
                    {isReviewing ? (
                      <div className="space-y-4">
                        {/* 进度显示 */}
                        {currentStage && (
                          <div className="p-4 bg-muted rounded-xl">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin text-brand" />
                                <span className="text-sm font-medium text-foreground">
                                  {currentStage}
                                </span>
                              </div>
                              <span className="text-sm font-bold text-brand">
                                {progress}%
                              </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div
                                className="bg-brand h-2 rounded-full transition-colors"
                              ></div>
                            </div>
                          </div>
                        )}


                      </div>
                    ) : reviewResult ? (
                      <div className="space-y-4 pr-4">
                        {/* 总体评分 */}
                        <div className="p-5 bg-muted rounded-xl">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="section-title flex items-center gap-2">
                              <Sparkles className="w-5 h-5 text-brand" />
                              总体评分
                            </h3>
                            {reviewResult.overallScore > 0 && (
                              <div className="flex items-center gap-2">
                                <CheckCircle className="w-6 h-6 text-success" />
                                <span className={`text-4xl font-bold ${getScoreColor(reviewResult.overallScore)}`}>
                                  {reviewResult.overallScore}
                                </span>
                                <span className="text-base text-muted-foreground font-bold">分</span>
                              </div>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed font-medium">{reviewResult.summary}</p>
                        </div>

                        {/* 完整性检查 */}
                        {reviewResult.completeness && reviewResult.completeness.items.length > 0 && (
                          <div>
                            <h4 className="section-title flex items-center gap-2 mb-3">
                              <CheckCircle className="w-5 h-5 text-brand" />
                              完整性检查
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              {reviewResult.completeness.items.map((item, index) => (
                                <div
                                  key={index}
                                  className="flex items-center gap-2.5 p-3 bg-muted rounded-xl cursor-default"
                                >
                                  {getStatusIcon(item.status)}
                                  <span className="text-xs font-medium text-foreground truncate flex-1">{item.name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 问题列表 */}
                        {reviewResult.issues && reviewResult.issues.length > 0 && (
                          <div>
                            <h4 className="section-title flex items-center gap-2 mb-3">
                              <AlertCircle className="w-5 h-5 text-brand" />
                              问题列表
                              <Badge variant="brand" className="ml-2 font-medium">
                                {reviewResult.issues.length}
                              </Badge>
                            </h4>
                            <div className="space-y-3">
                              {reviewResult.issues.map((issue, index) => (
                                <div
                                  key={index}
                                  className={`${getIssueBgColor(issue.type)} rounded-xl p-4 transition-colors cursor-default`}
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 mt-0.5">
                                      {getIssueIcon(issue.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start justify-between gap-2 mb-3">
                                        <h5 className="font-bold text-sm text-foreground">
                                          {issue.category}
                                        </h5>
                                        <Badge className={`flex-shrink-0 text-xs font-medium border-0 ${
                                          issue.type === 'must_fix' ? 'bg-destructive text-destructive-foreground' :
                                          issue.type === 'should_fix' ? 'bg-warning text-warning-foreground' :
                                          'bg-info text-info-foreground'
                                        }`}>
                                          {issue.type === 'must_fix' ? '必须修改' : issue.type === 'should_fix' ? '建议修改' : '潜在问题'}
                                        </Badge>
                                      </div>

                                      <p className="text-sm text-foreground mb-3 leading-relaxed font-medium">
                                        {issue.message}
                                      </p>

                                      {issue.location && (
                                        <div className="mb-2 p-2 bg-card rounded-lg text-xs">
                                          <span className="font-medium text-muted-foreground">位置：</span>
                                          <span className="text-foreground">{issue.location}</span>
                                        </div>
                                      )}

                                      {issue.originalText && (
                                        <div className="mb-2 p-2 bg-destructive-subtle rounded-lg text-xs">
                                          <span className="font-medium text-destructive">原文：</span>
                                          <span className="text-foreground">{issue.originalText}</span>
                                        </div>
                                      )}

                                      {issue.revisedText && (
                                        <div className="mb-2 p-2 bg-success-subtle rounded-lg text-xs">
                                          <span className="font-medium text-success">修改后：</span>
                                          <span className="text-foreground">{issue.revisedText}</span>
                                        </div>
                                      )}

                                      {issue.reason && (
                                        <div className="mb-2 p-2 bg-card rounded-lg text-xs">
                                          <span className="font-medium text-muted-foreground">原因：</span>
                                          <span className="text-foreground">{issue.reason}</span>
                                        </div>
                                      )}

                                      {issue.suggestion && (
                                        <div className="mb-2 p-2 bg-card rounded-lg text-xs">
                                          <span className="font-medium text-muted-foreground">建议：</span>
                                          <span className="text-foreground">{issue.suggestion}</span>
                                        </div>
                                      )}

                                      {issue.reference && (
                                        <div className="mb-2 p-2 bg-card rounded-lg text-xs">
                                          <span className="font-medium text-muted-foreground">依据：</span>
                                          <span className="text-foreground">{issue.reference}</span>
                                        </div>
                                      )}

                                      {issue.sourceUrl && (
                                        <div className="mt-2">
                                          <a
                                            href={issue.sourceUrl.startsWith('http') ? issue.sourceUrl : `https://${issue.sourceUrl}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-brand underline inline-flex items-center gap-1 font-medium"
                                            onClick={(e) => {
                                              if (!issue.sourceUrl || issue.sourceUrl.length < 10) {
                                                e.preventDefault();
                                              }
                                            }}
                                          >
                                            查看来源 →
                                          </a>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 改进建议 */}
                        {reviewResult.improvements && reviewResult.improvements.length > 0 && (
                          <div>
                            <h4 className="section-title flex items-center gap-2 mb-3">
                              <Zap className="w-5 h-5 text-brand" />
                              改进建议
                            </h4>
                            <div className="space-y-3">
                              {reviewResult.improvements.map((improvement, index) => (
                                <div
                                  key={index}
                                  className="flex items-start gap-3 p-4 bg-muted rounded-xl cursor-default"
                                >
                                  <div className="p-1.5 bg-brand-subtle rounded-lg flex-shrink-0">
                                    <Zap className="w-4 h-4 text-brand" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-sm text-foreground mb-2">{improvement.direction}</div>
                                    <div className="text-sm text-foreground leading-relaxed mb-3">{improvement.suggestion}</div>
                                    <div className="p-3 bg-brand-subtle rounded-lg mb-2">
                                      <div className="text-xs text-brand-subtle-foreground font-medium mb-1">改进实例：</div>
                                      <div className="text-sm text-foreground">{improvement.example}</div>
                                    </div>
                                    <div className="text-xs text-muted-foreground">预期效果：{improvement.expectedEffect}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 下载报告按钮 */}
                        <Button
                          className="w-full font-medium"
                          onClick={handleDownloadReport}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          下载审查报告 (HTML)
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
                        <div className="mb-6">
                          <div className="p-6 bg-brand-subtle rounded-2xl">
                            <FileText className="w-16 h-16 text-brand" />
                          </div>
                        </div>
                        <p className="text-base font-medium text-muted-foreground mb-2">请输入专利内容并点击&ldquo;开始审查&rdquo;</p>
                        <p className="text-sm text-muted-foreground">AI 将为您智能分析专利文档</p>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
