'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Loader2,
  FileText,
  Sparkles,
  History,
  Copy,
  Download,
  FileDown,
  BookOpen,
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  X,
  CheckCircle,
  AlertCircle,
  Info,
  AlertTriangle,
  Wand2,
  ArrowRight,
  User,
  Settings,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useUser } from '@/contexts/UserContext';
import { buildPatentPrintHtml } from '@/lib/patentDocument';

interface PatentFormData {
  title: string;
  field: string;
  background: string;
  content: string;
  solution: string;
}

interface PatentSection {
  title: string;
  content: string;
  images?: string[];
}

interface PatentData {
  summary?: PatentSection;
  description?: PatentSection;
  drawings?: PatentSection & { images?: string[] };
  claims?: PatentSection;
  references?: Array<{ text: string; url?: string }>;
}

interface GenerationProgress {
  stage: string;
  message: string;
  progress: number;
}

interface HistoryItem {
  id: string;
  title: string;
  createdAt: string;
}

export default function Home() {
  const { currentUser, setCurrentUser, refreshUser, setNeedsAuth, isLoading } = useUser();
  const [formData, setFormData] = useState<PatentFormData>({
    title: '',
    field: '',
    background: '',
    content: '',
    solution: '',
  });

  const [patentData, setPatentData] = useState<PatentData>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);
  const [showExecutionHistory, setShowExecutionHistory] = useState(true);
  const [toasts, setToasts] = useState<Array<{ id: string; type: 'success' | 'error' | 'info' | 'warning'; message: string }>>([]);
  const [assistingField, setAssistingField] = useState<string | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [histories, setHistories] = useState<HistoryItem[]>([]);
  const [executionLog, setExecutionLog] = useState<Array<{ time: string; message: string; isCurrent?: boolean }>>([]);
  const [userForm, setUserForm] = useState<{ username: string; newPassword: string; confirmPassword: string }>({
    username: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);

  const executionLogRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentTaskIdRef = useRef<string | null>(null);
  const hasRestoredTaskRef = useRef(false); // 防止重复恢复任务的标志
  const hasShownCompleteToast = useRef(false); // 防止重复显示完成通知的标志

  // 调试：监听currentUser变化
  useEffect(() => {
    console.log('Page: currentUser changed:', currentUser?.currentUsername, 'ID:', currentUser?.id);
  }, [currentUser]);

  // 加载用户的活跃任务
  useEffect(() => {
    const loadActiveTasks = async () => {
      if (!currentUser) return;

      console.log('开始检查活跃任务…', {
        isGenerating,
        currentTaskId: currentTaskIdRef.current,
        userId: currentUser.id,
      });

      // 如果已经在生成中，不再重复恢复
      if (isGenerating || currentTaskIdRef.current) {
        console.log('已经在生成中，跳过恢复');
        return;
      }

      try {
        console.log('正在请求用户最新的一条任务…');
        const response = await fetch('/api/patent-histories', {
          headers: {
            'x-user-id': currentUser.id,
          },
        });
        if (response.ok) {
          const allTasks = await response.json();
          console.log('获取到的任务列表:', allTasks);

          if (allTasks && allTasks.length > 0) {
            // 只检查最新的一条任务（第一个元素）
            const latestTask = allTasks[0];
            console.log('最新一条任务:', latestTask.id, '状态:', latestTask.status, '创建时间:', latestTask.created_at);

            // 只有最新任务状态为 generating 时才恢复
            if (latestTask.status !== 'generating') {
              console.log('最新任务状态不是 generating (状态:', latestTask.status, ')，跳过恢复');
              hasRestoredTaskRef.current = true; // 标记已检查过
              return;
            }

            console.log('最新任务状态为 generating，准备恢复');
            const taskId = latestTask.id;

            // 在恢复之前，立即验证任务实际状态
            console.log('立即验证任务实际状态…');
            try {
              const statusResponse = await fetch(`/api/patent-tasks/${taskId}/status`, {
                headers: {
                  'x-user-id': currentUser.id,
                },
              });

              if (statusResponse.ok) {
                const statusData = await statusResponse.json();
                console.log('任务实际状态:', statusData.status);

                // 如果任务已经完成或失败，不恢复
                if (statusData.status === 'completed') {
                  console.log('任务已完成，跳过恢复');
                  hasRestoredTaskRef.current = true;
                  return;
                }

                if (statusData.status === 'failed') {
                  console.log('任务已失败，跳过恢复');
                  hasRestoredTaskRef.current = true;
                  return;
                }
              } else {
                console.log('状态检查失败，跳过恢复');
                hasRestoredTaskRef.current = true;
                return;
              }
            } catch (error) {
              console.error('检查任务状态失败:', error);
              // 检查失败时不恢复任务
              hasRestoredTaskRef.current = true;
              return;
            }

            setCurrentTaskId(taskId);
            currentTaskIdRef.current = taskId;
            setIsGenerating(true);
            hasRestoredTaskRef.current = true; // 标记已恢复

            // 恢复表单数据
            setFormData({
              title: latestTask.title,
              field: latestTask.field || '',
              background: latestTask.background || '',
              content: latestTask.content,
              solution: latestTask.solution || '',
            });

            // 恢复已生成的内容
            const restoredPatentData: PatentData = {};

            if (latestTask.summaryContent) {
              restoredPatentData.summary = {
                title: latestTask.summaryTitle || '摘要',
                content: latestTask.summaryContent,
              };
            }

            if (latestTask.descriptionContent) {
              restoredPatentData.description = {
                title: latestTask.descriptionTitle || '发明专利说明书',
                content: latestTask.descriptionContent,
              };
            }

            if (latestTask.drawingsContent) {
              restoredPatentData.drawings = {
                title: latestTask.drawingsTitle || '专利附图',
                content: latestTask.drawingsContent,
                images: latestTask.drawingsImages || [],
              };
            }

            if (latestTask.claimsContent) {
              restoredPatentData.claims = {
                title: latestTask.claimsTitle || '权利要求书',
                content: latestTask.claimsContent,
              };
            }

            if (latestTask.references && latestTask.references.length > 0) {
              restoredPatentData.references = latestTask.references;
              console.log('恢复的参考资料:', latestTask.references);
            } else {
              console.log('没有恢复参考资料，latestTask.references:', latestTask.references);
            }

            console.log('恢复的专利数据:', restoredPatentData);

            setPatentData(restoredPatentData);

            // 恢复执行记录
            console.log('检查是否需要恢复执行记录…');
            console.log('latestTask.executionLog:', latestTask.executionLog);
            console.log('latestTask.executionLog 类型:', typeof latestTask.executionLog);
            console.log('latestTask.executionLog 长度:', latestTask.executionLog?.length);

            if (latestTask.executionLog && Array.isArray(latestTask.executionLog) && latestTask.executionLog.length > 0) {
              console.log('恢复执行记录，记录数量:', latestTask.executionLog.length);
              setExecutionLog(latestTask.executionLog);
              setShowExecutionHistory(true); // 自动展开执行历史
            } else {
              console.log('没有执行记录需要恢复');
            }

            // 设置生成进度
            setGenerationProgress({
              stage: latestTask.currentStage || '生成中',
              message: '检测到未完成的任务',
              progress: latestTask.progress || 0,
            });

            addToast('info', '检测到未完成的任务，正在继续生成');

            // 添加超时控制（30分钟）
            const timeoutId = setTimeout(() => {
              console.log('任务轮询超时，停止轮询');
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
              }
              setIsGenerating(false);
              setGenerationProgress(null);
              setCurrentTaskId(null);
              currentTaskIdRef.current = null;
              addToast('warning', '任务执行超时，请手动检查任务状态');
            }, 30 * 60 * 1000); // 30分钟

            // 轮询任务状态和内容
            const pollTaskStatus = async () => {
              // 检查页面是否可见
              if (typeof document !== 'undefined' && document.hidden) {
                console.log('页面不可见，跳过本次轮询');
                return;
              }

              try {
                const statusResponse = await fetch(`/api/patent-tasks/${taskId}/status`, {
                  headers: {
                    'x-user-id': currentUser.id,
                  },
                });

                if (statusResponse.ok) {
                  const statusData = await statusResponse.json();

                  console.log('轮询任务状态:', {
                    id: statusData.id,
                    status: statusData.status,
                    progress: statusData.progress,
                    currentStage: statusData.currentStage,
                  });

                  // 更新生成进度
                  setGenerationProgress({
                    stage: statusData.currentStage || '生成中',
                    message: '正在生成中',
                    progress: statusData.progress || 0,
                  });

                  // 更新已生成的内容 - 保留原有内容
                  setPatentData(prev => {
                    const newPatentData = { ...prev };

                    if (statusData.summaryContent) {
                      newPatentData.summary = {
                        title: statusData.summaryTitle || '摘要',
                        content: statusData.summaryContent,
                      };
                    }

                    if (statusData.descriptionContent) {
                      newPatentData.description = {
                        title: statusData.descriptionTitle || '发明专利说明书',
                        content: statusData.descriptionContent,
                      };
                    }

                    if (statusData.drawingsContent) {
                      newPatentData.drawings = {
                        title: statusData.drawingsTitle || '专利附图',
                        content: statusData.drawingsContent,
                        images: statusData.drawingsImages || [],
                      };
                    }

                    if (statusData.claimsContent) {
                      newPatentData.claims = {
                        title: statusData.claimsTitle || '权利要求书',
                        content: statusData.claimsContent,
                      };
                    }

                    // 更新参考来源（保留原有）
                    if (statusData.references && statusData.references.length > 0) {
                      newPatentData.references = statusData.references;
                    } else if (prev.references && prev.references.length > 0) {
                      // 如果新数据中没有 references，保留原有的
                      newPatentData.references = prev.references;
                    }

                    return newPatentData;
                  });

                  // 恢复执行记录
                  if (statusData.executionLog && Array.isArray(statusData.executionLog) && statusData.executionLog.length > 0) {
                    console.log('轮询恢复执行记录，记录数量:', statusData.executionLog.length);
                    setExecutionLog(statusData.executionLog);
                    setShowExecutionHistory(true); // 确保展开
                  }

                  // 如果任务完成或失败，停止轮询
                  if (statusData.status === 'completed') {
                    console.log('任务完成，停止轮询');
                    setIsGenerating(false);
                    setGenerationProgress(null);
                    setCurrentTaskId(null);
                    currentTaskIdRef.current = null;
                    hasRestoredTaskRef.current = false; // 重置标志
                    clearTimeout(timeoutId);
                    if (pollingIntervalRef.current) {
                      clearInterval(pollingIntervalRef.current);
                      pollingIntervalRef.current = null;
                    }
                    // 只显示一次完成通知
                    if (!hasShownCompleteToast.current) {
                      addToast('success', '专利生成完成');
                      hasShownCompleteToast.current = true;
                    }
                  } else if (statusData.status === 'failed') {
                    console.log('任务失败，停止轮询，错误:', statusData.errorMessage);
                    setIsGenerating(false);
                    setGenerationProgress(null);
                    setCurrentTaskId(null);
                    currentTaskIdRef.current = null;
                    hasRestoredTaskRef.current = false; // 重置标志
                    clearTimeout(timeoutId);
                    if (pollingIntervalRef.current) {
                      clearInterval(pollingIntervalRef.current);
                      pollingIntervalRef.current = null;
                    }
                    addToast('error', statusData.errorMessage || '生成失败');
                  }
                }
              } catch (error) {
                console.error('Error polling task status:', error);
              }
            };

            // 立即查询一次
            pollTaskStatus();

            // 每2秒轮询一次
            pollingIntervalRef.current = setInterval(pollTaskStatus, 2000);

            // 页面可见性变化监听
            const handleVisibilityChange = () => {
              if (document.hidden) {
                console.log('页面隐藏，暂停轮询');
                if (pollingIntervalRef.current) {
                  clearInterval(pollingIntervalRef.current);
                  pollingIntervalRef.current = null;
                }
              } else {
                console.log('页面可见，恢复轮询');
                if (!pollingIntervalRef.current) {
                  pollTaskStatus();
                  pollingIntervalRef.current = setInterval(pollTaskStatus, 2000);
                }
              }
            };

            document.addEventListener('visibilitychange', handleVisibilityChange);

            // 清理函数
            return () => {
              document.removeEventListener('visibilitychange', handleVisibilityChange);
              clearTimeout(timeoutId);
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
              }
            };
          } else {
            // 没有活跃任务，也标记已检查
            hasRestoredTaskRef.current = true;
          }
        }
      } catch (error) {
        console.error('Error loading active tasks:', error);
        hasRestoredTaskRef.current = true; // 标记已检查过，避免重复请求
      }
    };

    loadActiveTasks();
  }, [currentUser, isGenerating]); // 添加 isGenerating 作为依赖

  // 监听页面可见性变化，切换回来时重新检查活跃任务
  useEffect(() => {
    const handleVisibilityChange = async () => {
      // 只有在页面变得可见，且当前没有任务时，才重新检查
      if (!document.hidden && !isGenerating && !currentTaskIdRef.current && currentUser) {
        console.log('页面重新可见，检查最新任务状态');
        hasRestoredTaskRef.current = false; // 重置标志，允许重新检查

        // 延迟500ms检查，避免频繁触发
        setTimeout(async () => {
          try {
            const response = await fetch('/api/patent-histories', {
              headers: {
                'x-user-id': currentUser.id,
              },
            });

            if (response.ok) {
              const allTasks = await response.json();
              console.log('页面可见性检查 - 获取到的任务列表:', allTasks);

              if (allTasks && allTasks.length > 0) {
                // 只检查最新的一条任务（第一个元素）
                const latestTask = allTasks[0];
                console.log('页面可见性检查 - 最新任务:', latestTask.id, '状态:', latestTask.status);

                // 如果最新任务状态不是 generating，跳过
                if (latestTask.status !== 'generating') {
                  console.log('页面可见性检查 - 最新任务状态不是 generating');
                  return;
                }

                // 验证任务实际状态
                try {
                  const statusResponse = await fetch(`/api/patent-tasks/${latestTask.id}/status`, {
                    headers: {
                      'x-user-id': currentUser.id,
                    },
                  });

                  if (statusResponse.ok) {
                    const statusData = await statusResponse.json();
                    console.log('页面可见性检查 - 任务实际状态:', statusData.status);

                    if (statusData.status === 'generating' && statusData.id !== currentTaskIdRef.current) {
                      console.log('页面可见性检查 - 发现新的活跃任务，触发重新加载页面');
                      // 重新加载页面以触发任务恢复
                      window.location.reload();
                    }
                  }
                } catch (error) {
                  console.error('页面可见性检查 - 验证任务状态失败:', error);
                }
              }
            }
          } catch (error) {
            console.error('Error checking active tasks:', error);
          }
        }, 500);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isGenerating, currentUser]);

  const addToast = (type: 'success' | 'error' | 'info' | 'warning', message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  const handleInputChange = (field: keyof PatentFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getToastIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-success" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-warning" />;
      default:
        return <Info className="w-5 h-5 text-info" />;
    }
  };

  const getToastBgColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-success-subtle';
      case 'error':
        return 'bg-destructive-subtle';
      case 'warning':
        return 'bg-warning-subtle';
      default:
        return 'bg-info-subtle';
    }
  };

  // AI辅助填写
  const handleAssistFill = async (field: string) => {
    setAssistingField(field);
    addToast('info', `正在使用AI辅助填写${field === 'field' ? '技术领域' : field === 'background' ? '背景技术' : field === 'content' ? '发明内容' : '实施方式'}…`);

    try {
      const response = await fetch('/api/assist-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field,
          title: formData.title,
          existingData: formData,
        }),
      });

      const result = await response.json();

      if (result.content) {
        handleInputChange(field as keyof PatentFormData, result.content);
        addToast('success', 'AI辅助填写成功');
      } else {
        addToast('error', result.error || 'AI辅助填写失败');
      }
    } catch (error) {
      console.error('Error in assist-fill:', error);
      addToast('error', 'AI辅助填写失败');
    } finally {
      setAssistingField(null);
    }
  };

  // 生成专利说明书
  const handleGenerate = async () => {
    // 等待用户状态加载完成
    if (isLoading) {
      console.log('用户状态加载中，请稍候');
      addToast('info', '用户状态加载中，请稍候');
      return;
    }

    // 检查用户是否登录
    if (!currentUser || !currentUser.id) {
      console.log('用户未登录，触发登录弹窗，currentUser:', currentUser);
      addToast('info', '请先登录');
      setNeedsAuth(true);
      return;
    }

    console.log('当前用户:', currentUser);

    // 验证必填项
    if (!formData.title.trim()) {
      addToast('warning', '请输入发明名称');
      return;
    }
    if (!formData.content.trim()) {
      addToast('warning', '请输入发明内容');
      return;
    }

    // 停止之前的轮询（如果有的话）
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // 重置恢复标志，这是新任务不是恢复任务
    hasRestoredTaskRef.current = false;
    hasShownCompleteToast.current = false; // 重置完成通知标志

    setIsGenerating(true);
    setPatentData({});
    setExecutionLog([]); // 重置执行记录
    setGenerationProgress({ stage: '准备中', message: '正在初始化生成任务', progress: 0 });

    const startTime = new Date();

    // 使用ref存储taskId，以便在后续操作中访问
    currentTaskIdRef.current = null;

    // 定义addExecutionLog函数
    const addExecutionLog = async (message: string) => {
      const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
      setExecutionLog(prev => {
        // 取消之前的当前状态
        const updated = prev.map(log => ({ ...log, isCurrent: false }));
        // 添加新的当前状态到开头
        const newLog = [{ time, message, isCurrent: true }, ...updated];

        // 如果有taskId，每次都保存到数据库（改为每次都保存，而不是每5条）
        if (currentTaskIdRef.current) {
          fetch(`/api/patent-tasks/${currentTaskIdRef.current}/execution-log`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-user-id': currentUser.id,
            },
            body: JSON.stringify({ executionLog: newLog }),
          }).catch(err => console.error('Failed to save execution log:', err));
        } else {
          console.log('无法保存执行日志：currentTaskIdRef.current 为空');
        }

        return newLog;
      });
    };

    // 创建任务记录
    let taskId: string | null = null;

    try {
      console.log('正在创建任务，用户ID:', currentUser.id);
      const createTaskResponse = await fetch('/api/patent-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify(formData),
      });

      console.log('创建任务响应状态:', createTaskResponse.status);

      if (!createTaskResponse.ok) {
        // 检查是否是401错误（用户未登录）
        if (createTaskResponse.status === 401) {
          addToast('error', '请先登录');
          setNeedsAuth(true);
          setIsGenerating(false);
          return;
        }
        const errorData = await createTaskResponse.json();
        console.error('创建任务失败:', errorData);
        throw new Error(errorData.error || '创建任务失败');
      }

      const task = await createTaskResponse.json();
      taskId = task.id;
      setCurrentTaskId(task.id);
      currentTaskIdRef.current = task.id; // 同时更新ref
    } catch (error) {
      console.error('Error creating task:', error);
      addToast('error', '创建任务失败');
      setIsGenerating(false);
      return;
    }

    try {
      const response = await fetch('/api/generate-patent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({
          ...formData,
          taskId: taskId,
        }),
      });

      if (!response.ok) {
        throw new Error('生成请求失败');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            try {
              const data = JSON.parse(line);

              if (data.type === 'progress') {
                setGenerationProgress({
                  stage: data.stage,
                  message: data.message,
                  progress: data.progress,
                });
                addExecutionLog(`${data.stage} - ${data.message}`);
              } else if (data.type === 'section') {
                setPatentData(prev => {
                  const existingSection = prev[data.data.name as keyof PatentData] as PatentSection | undefined;
                  return {
                    ...prev,
                    [data.data.name]: {
                      title: data.data.title,
                      content: existingSection?.content ? existingSection.content + data.data.content : data.data.content,
                      images: data.data.images,
                    },
                  };
                });
              } else if (data.type === 'references') {
                setPatentData(prev => ({
                  ...prev,
                  references: data.data,
                }));
              } else if (data.type === 'done') {
                addToast('success', '专利说明书生成完成');
                await addExecutionLog('生成完成');

                // 保存最终的执行记录到数据库
                if (taskId) {
                  await fetch(`/api/patent-tasks/${taskId}/execution-log`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'x-user-id': currentUser.id,
                    },
                    body: JSON.stringify({ executionLog }),
                  }).catch(err => console.error('Failed to save final execution log:', err));
                }
              } else if (data.type === 'error') {
                addToast('error', data.message);
                await addExecutionLog('生成失败: ' + data.message);
              }
            } catch (e) {
              // Ignore JSON parse errors for incomplete lines
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in generate-patent:', error);
      addToast('error', '生成失败，请重试');
      await addExecutionLog('生成失败: ' + (error as Error).message);
    } finally {
      setIsGenerating(false);
      setCurrentTaskId(null);
      currentTaskIdRef.current = null;
      hasRestoredTaskRef.current = false;
    }
  };

  // 下载功能
  const handleDownload = async () => {
    if (!patentData.summary && !patentData.description) {
      addToast('warning', '请先生成专利说明书');
      return;
    }

    // 要下载的部分
    const sections = ['summary', 'description', 'drawings', 'claims'];
    const sectionNames: Record<string, string> = {
      summary: '摘要',
      description: '说明书',
      drawings: '附图',
      claims: '权利要求书',
    };

    let successCount = 0;
    let failCount = 0;

    // 逐个下载每个部分
    for (const section of sections) {
      try {
        const response = await fetch('/api/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: formData.title,
            sections: patentData,
            format: 'doc',
            section,
          }),
        });

        if (!response.ok) {
          throw new Error('下载失败');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${formData.title || '专利说明书'}-${sectionNames[section]}.doc`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        successCount++;
      } catch (error) {
        console.error(`Error downloading ${section}:`, error);
        failCount++;
      }
    }

    if (successCount > 0) {
      addToast('success', `已下载${successCount}个 Word 文件`);
    }
    if (failCount > 0) {
      addToast('error', `${failCount}个文件下载失败`);
    }
  };

  // 导出 PDF：交给浏览器渲染，中文由系统字体呈现（服务端无中文字形，硬排会乱码）
  const handleExportPdf = () => {
    if (!patentData.summary && !patentData.description) {
      addToast('warning', '请先生成专利说明书');
      return;
    }

    try {
      const html = buildPatentPrintHtml(formData.title, patentData);

      const iframe = document.createElement('iframe');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.cssText =
        'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
      document.body.appendChild(iframe);

      const frameWindow = iframe.contentWindow;
      if (!frameWindow) {
        document.body.removeChild(iframe);
        addToast('error', '导出失败，请重试');
        return;
      }

      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      };

      frameWindow.document.open();
      frameWindow.document.write(html);
      frameWindow.document.close();
      frameWindow.addEventListener('afterprint', cleanup);

      // 等排版完成再唤起打印对话框
      window.setTimeout(() => {
        frameWindow.focus();
        frameWindow.print();
      }, 300);
      window.setTimeout(cleanup, 120000);

      addToast('info', '已打开打印窗口，在目标打印机中选择「另存为 PDF」即可');
    } catch (error) {
      console.error('导出 PDF 失败:', error);
      addToast('error', '导出 PDF 失败');
    }
  };

  // 加载用户信息（支持新用户检测和自动创建）
  // 更新用户信息
  const handleUpdateUser = async () => {
    if (!currentUser) return;

    // 验证
    if (userForm.newPassword && userForm.newPassword !== userForm.confirmPassword) {
      addToast('error', '两次输入的密码不一致');
      return;
    }

    if (userForm.newPassword && userForm.newPassword.length < 6) {
      addToast('error', '密码长度不能少于6位');
      return;
    }

    try {
      // 用户名走资料更新接口（PATCH /api/user 并不存在，历史上这里一直 405 静默失败）
      if (userForm.username && userForm.username !== currentUser.username) {
        const profileResponse = await fetch('/api/user', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': currentUser.id,
          },
          body: JSON.stringify({ username: userForm.username }),
        });
        const profileResult = await profileResponse.json();

        if (!profileResponse.ok) {
          addToast('error', profileResult.error || '用户名更新失败');
          return;
        }
      }

      // 密码走改密接口（密码已散列存储，服务端不可还原）
      if (userForm.newPassword) {
        const passwordResponse = await fetch('/api/user/change-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': currentUser.id,
          },
          body: JSON.stringify({ newPassword: userForm.newPassword }),
        });
        const passwordResult = await passwordResponse.json();

        if (!passwordResponse.ok) {
          addToast('error', passwordResult.error || '密码修改失败');
          return;
        }
      }

      await refreshUser();
      addToast('success', '用户信息更新成功');
      setUserForm({ username: userForm.username, newPassword: '', confirmPassword: '' });
      setUserDialogOpen(false);
    } catch (error) {
      console.error('Error updating user:', error);
      addToast('error', '更新失败，请重试');
    }
  };

  // 加载历史记录
  const loadHistories = async () => {
    if (!currentUser || !currentUser.id) {
      return;
    }

    try {
      const response = await fetch('/api/patent-histories', {
        headers: {
          'x-user-id': currentUser.id,
        },
      });
      const result = await response.json();

      if (Array.isArray(result)) {
        setHistories(result);
      }
    } catch (error) {
      console.error('Error loading histories:', error);
      addToast('error', '加载历史记录失败');
    }
  };

  // 打开历史记录对话框
  const openHistoryDialog = () => {
    loadHistories();
    setHistoryDialogOpen(true);
  };

  // 复制内容
  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    addToast('success', '已复制到剪贴板');
  };

  return (
    <div className="min-h-screen overflow-x-hidden w-full max-w-full">
      {/* Toast 容器 */}
      <div className="fixed top-2 right-2 sm:top-4 sm:right-4 z-[100] flex flex-col gap-2 max-w-[90vw] sm:max-w-md w-auto">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-start gap-2 p-2.5 sm:p-3 rounded-lg shadow-soft animate-in slide-in-from-right-full transition-colors duration-300  ${getToastBgColor(toast.type)}`}
          >
            {getToastIcon(toast.type)}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground break-words">{toast.message}</p>
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* 历史记录对话框 */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-lg sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="lead-title flex items-center gap-2 sm:gap-2.5">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-brand-subtle flex items-center justify-center shadow-soft">
                <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand" />
              </div>
              历史记录
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              查看和下载您的历史专利文档
            </DialogDescription>
          </DialogHeader>
          <div className="bg-card rounded-lg">
            <ScrollArea className="max-h-[400px] sm:max-h-[500px]">
              {histories.length > 0 ? (
                <div className="space-y-2 sm:space-y-3 p-3 sm:p-4">
                {histories.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 rounded-lg bg-card transition-colors"
                  >
                    <div className="flex-1 mb-2 sm:mb-0">
                      <h4 className="font-medium text-xs sm:text-sm text-foreground">{item.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{item.createdAt}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 sm:py-8 text-muted-foreground">
                <div className="bg-brand-subtle rounded-full w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 flex items-center justify-center">
                  <History className="w-5 h-5 sm:w-6 sm:h-6 text-brand" />
                </div>
                <p className="text-xs sm:text-sm">暂无历史记录</p>
              </div>
            )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* 用户管理对话框 */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="max-w-sm sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="lead-title flex items-center gap-2 sm:gap-2.5">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-brand-subtle flex items-center justify-center shadow-soft">
                <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand" />
              </div>
              用户管理
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              管理您的账号信息
            </DialogDescription>
          </DialogHeader>
          <div className="bg-card rounded-lg p-3 sm:p-4">
            <div className="space-y-3 sm:space-y-4 py-3 sm:py-4">
              {currentUser && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-xs sm:text-sm">用户名</Label>
                  <Input
                    id="username"
                    value={userForm.username}
                    onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                    placeholder="输入用户名"
                    className="text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-xs sm:text-sm">新密码（留空不修改）</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={userForm.newPassword}
                    onChange={(e) => setUserForm({ ...userForm, newPassword: e.target.value })}
                    placeholder="输入新密码"
                    className="text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-xs sm:text-sm">确认新密码</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={userForm.confirmPassword}
                    onChange={(e) => setUserForm({ ...userForm, confirmPassword: e.target.value })}
                    placeholder="再次输入新密码"
                    className="text-sm"
                  />
                </div>

                <div className="bg-warning-subtle rounded-lg p-2.5 sm:p-3 text-xs sm:text-sm text-warning-subtle-foreground">
                  <strong>提示：</strong>密码以加密方式存储，出于安全考虑不可回显；如需更换请直接填写新密码。
                </div>

                <div className="flex gap-1.5 sm:gap-2 pt-2 sm:pt-4">
                  <Button onClick={handleUpdateUser} className="flex-1 text-xs sm:text-sm h-9 sm:h-10">
                    保存修改
                  </Button>
                  <Button variant="outline" onClick={() => setUserDialogOpen(false)} className="flex-1 text-xs sm:text-sm h-9 sm:h-10">
                    取消
                  </Button>
                </div>
              </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 图片放大对话框 */}
      <Dialog open={!!enlargedImage} onOpenChange={() => setEnlargedImage(null)}>
        <DialogContent className="max-w-3xl sm:max-w-4xl p-0 overflow-hidden">
          <div className="relative w-full h-[60vh] sm:h-[80vh] flex items-center justify-center">
            {enlargedImage && (
              <img
                src={enlargedImage}
                alt="放大图片"
                className="max-w-full max-h-full object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 主内容区 - 响应式布局：移动端垂直堆叠，PC端三栏布局 */}
      <div className="container mx-auto px-2 sm:px-4 py-2 min-h-[calc(100vh+40px)] sm:h-[calc(100vh+30px)] w-full max-w-full overflow-x-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[35%_15%_50%] gap-0 md:gap-0 h-full bg-card rounded-xl shadow-soft overflow-hidden flex md:grid w-full min-w-0">
          {/* 左侧：填写信息区域（移动端全宽，桌面端35%） */}
          <div className="flex md:flex-col bg-card w-full min-w-0 overflow-hidden">
            <Card className="flex-1 flex flex-col m-0 rounded-none border-0 shadow-none w-full min-w-0">
              <CardHeader className="sticky top-0 z-10 bg-card flex-shrink-0 px-3 sm:px-5 py-3 h-[60px] sm:h-[68px]">
                <CardTitle className="lead-title flex items-center gap-2 sm:gap-2.5">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-brand-subtle flex items-center justify-center shadow-soft">
                    <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand" />
                  </div>
                  <span className="">发明信息填写</span>
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground ml-8 sm:ml-10 mt-0 tracking-wide">
                  填写相关信息，带*的必须填写哦
                </CardDescription>
              </CardHeader>
              <ScrollArea className="flex-1 max-h-[40vh] md:max-h-none">
                <CardContent className="space-y-3 sm:space-y-4 p-3 sm:p-5">
                  <div className="space-y-2 w-full min-w-0">
                    <Label htmlFor="title" className="text-xs sm:text-sm font-medium text-foreground tracking-wide">
                      发明名称 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="title"
                      placeholder="例如：一种智能家居控制系统"
                      value={formData.title}
                      onChange={(e) => handleInputChange('title', e.target.value)}
                      className="text-sm sm:text-base transition-colors duration-300 w-full min-w-0"
                    />
                  </div>

                  <div className="space-y-2 w-full min-w-0">
                    <Label htmlFor="field" className="text-xs sm:text-sm font-medium text-foreground tracking-wide">技术领域</Label>
                    <div className="flex flex-col sm:flex-row gap-2 relative w-full min-w-0">
                      <Textarea
                        id="field"
                        placeholder={assistingField === 'field' ? '' : '发明所属的技术领域…'}
                        value={formData.field}
                        onChange={(e) => handleInputChange('field', e.target.value)}
                        className="flex-1 text-sm sm:text-base resize-none max-h-24 min-h-[80px] overflow-y-auto transition-colors duration-300 w-full min-w-0"
                        disabled={assistingField === 'field'}
                      />
                      {assistingField === 'field' && (
                        <div className="absolute inset-0 bg-card/95 flex items-center justify-center gap-2 text-brand">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-xs sm:text-sm font-medium">AI正在生成内容…</span>
                        </div>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAssistFill('field')}
                        disabled={!!assistingField || !formData.title.trim()}
                        className="gap-1 sm:gap-1.5 text-xs sm:text-sm flex-shrink-0 h-8 sm:h-9 hover:bg-muted transition-colors duration-300"
                      >
                        <Wand2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-brand" />
                        AI辅助
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 w-full min-w-0">
                    <Label htmlFor="background" className="text-xs sm:text-sm font-medium text-foreground tracking-wide">背景技术</Label>
                    <div className="flex flex-col sm:flex-row gap-2 relative w-full min-w-0">
                      <Textarea
                        id="background"
                        placeholder={assistingField === 'background' ? '' : '现有技术存在的问题…'}
                        value={formData.background}
                        onChange={(e) => handleInputChange('background', e.target.value)}
                        className="flex-1 text-sm sm:text-base resize-none max-h-24 min-h-[80px] overflow-y-auto transition-colors duration-300 w-full min-w-0"
                        disabled={assistingField === 'background'}
                      />
                      {assistingField === 'background' && (
                        <div className="absolute inset-0 bg-card/95 flex items-center justify-center gap-2 text-brand">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-xs sm:text-sm font-medium">AI正在生成内容…</span>
                        </div>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAssistFill('background')}
                        disabled={!!assistingField || !formData.title.trim()}
                        className="gap-1 sm:gap-1.5 text-xs sm:text-sm flex-shrink-0 h-8 sm:h-9 hover:bg-muted transition-colors duration-300"
                      >
                        <Wand2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-brand" />
                        AI辅助
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 w-full min-w-0">
                    <Label htmlFor="content" className="text-xs sm:text-sm font-medium text-foreground tracking-wide">
                      发明内容 <span className="text-destructive">*</span>
                    </Label>
                    <div className="flex flex-col sm:flex-row gap-2 relative w-full min-w-0">
                      <Textarea
                        id="content"
                        placeholder={assistingField === 'content' ? '' : '详细描述发明的技术方案、创新点等…'}
                        value={formData.content}
                        onChange={(e) => handleInputChange('content', e.target.value)}
                        className="flex-1 text-sm sm:text-base resize-none max-h-32 min-h-[100px] overflow-y-auto transition-colors duration-300 w-full min-w-0"
                        disabled={assistingField === 'content'}
                      />
                      {assistingField === 'content' && (
                        <div className="absolute inset-0 bg-card/95 flex items-center justify-center gap-2 text-brand">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-xs sm:text-sm font-medium">AI正在生成内容…</span>
                        </div>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAssistFill('content')}
                        disabled={!!assistingField || !formData.title.trim()}
                        className="gap-1 sm:gap-1.5 text-xs sm:text-sm flex-shrink-0 h-8 sm:h-9 hover:bg-muted transition-colors duration-300"
                      >
                        <Wand2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-brand" />
                        AI辅助
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 w-full min-w-0">
                    <Label htmlFor="solution" className="text-xs sm:text-sm font-medium text-foreground tracking-wide">实施方式</Label>
                    <div className="flex flex-col sm:flex-row gap-2 relative w-full min-w-0">
                      <Textarea
                        id="solution"
                        placeholder={assistingField === 'solution' ? '' : '具体实施例和实现方式…'}
                        value={formData.solution}
                        onChange={(e) => handleInputChange('solution', e.target.value)}
                        className="flex-1 text-sm sm:text-base resize-none max-h-24 min-h-[80px] overflow-y-auto transition-colors duration-300 w-full min-w-0"
                        disabled={assistingField === 'solution'}
                      />
                      {assistingField === 'solution' && (
                        <div className="absolute inset-0 bg-card/95 flex items-center justify-center gap-2 text-brand">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-xs sm:text-sm font-medium">AI正在生成内容…</span>
                        </div>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAssistFill('solution')}
                        disabled={!!assistingField || !formData.title.trim()}
                        className="gap-1 sm:gap-1.5 text-xs sm:text-sm flex-shrink-0 h-8 sm:h-9 hover:bg-muted transition-colors duration-300"
                      >
                        <Wand2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-brand" />
                        AI辅助
                      </Button>
                    </div>
                  </div>

                  <div className="pt-3 sm:pt-4">
                    <Button
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      className="w-full h-10 sm:h-11 bg-primary text-primary-foreground shadow-soft transition-colors duration-300 text-xs sm:text-sm font-medium"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          生成中...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          生成专利说明书
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </ScrollArea>
            </Card>
          </div>

          {/* 中间：进度显示区域（移动端全宽，桌面端15%）
              三栏相邻且 gap-0、无描边时，唯一可靠的边界来源是色阶差：
              左右两块 bg-card，这条「进度轨道」沉一档用 bg-muted 切出来 */}
          <div className="flex md:flex-col bg-muted w-full min-w-0 overflow-hidden">
            <Card className="flex-1 flex flex-col m-0 rounded-none border-0 shadow-none w-full min-w-0 bg-muted">
              <CardHeader className="sticky top-0 z-10 flex-shrink-0 px-3 sm:px-5 py-3 h-[60px] sm:h-[68px]">
                <CardTitle className="lead-title flex items-center gap-2 sm:gap-2.5">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-brand-subtle flex items-center justify-center shadow-soft">
                    <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand" />
                  </div>
                  <span className="">生成进度</span>
                </CardTitle>
              </CardHeader>
              <ScrollArea className="flex-1 max-h-[50vh] md:max-h-none">
                <CardContent className="p-3 sm:p-4">
                  {generationProgress ? (
                    <div className="space-y-3 sm:space-y-4">
                      {/* 当前状态 - 固定在顶部 */}
                      <div className="rounded-xl bg-card p-3 sm:p-4 shadow-soft">
                        <div className="flex items-center gap-2 sm:gap-2.5 mb-2 sm:mb-3">
                          {isGenerating ? (
                            <div className="bg-muted p-1.5 rounded-lg shadow-soft">
                              <Loader2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-foreground animate-spin" />
                            </div>
                          ) : (
                            <div className="bg-muted p-1.5 rounded-lg shadow-soft">
                              <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-foreground" />
                            </div>
                          )}
                          <span className="font-bold text-xs tracking-wide">
                            {isGenerating ? '生成中' : '已完成'}
                          </span>
                        </div>
                        <div className="mb-2 sm:mb-3">
                          <div className="flex items-center justify-between text-xs sm:text-sm mb-1.5">
                            <span className="font-medium text-foreground">{generationProgress.stage}</span>
                            <span className="text-muted-foreground font-mono text-xs">{generationProgress.progress.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5 sm:h-2 overflow-hidden">
                            <div
                              className="bg-brand h-1.5 sm:h-2 rounded-full transition-colors duration-300 shadow-soft"
                              style={{ width: `${generationProgress.progress.toFixed(1)}%` }}
                            />
                          </div>
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{generationProgress.message}</p>

                        {/* 执行历史 - 可折叠 */}
                        {isGenerating && (
                          <div className="mt-4">
                            <Collapsible open={showExecutionHistory} onOpenChange={setShowExecutionHistory}>
                              <CollapsibleTrigger asChild>
                                <Button variant="outline" size="sm" className="w-full gap-2 text-xs transition-colors duration-300">
                                  {showExecutionHistory ? (
                                    <>
                                      <ChevronDown className="w-3 h-3" />
                                      收起历史
                                    </>
                                  ) : (
                                    <>
                                      <ChevronRight className="w-3 h-3" />
                                      展开历史
                                    </>
                                  )}
                                </Button>
                              </CollapsibleTrigger>

                              <CollapsibleContent>
                                <div className="mt-3 rounded-lg bg-muted">
                                  <ScrollArea className="h-[384px]">
                                    <div className="space-y-2 p-2" ref={executionLogRef}>
                                      {executionLog.length > 0 ? (
                                        executionLog.map((log, index) => (
                                          <div
                                            key={index}
                                            className={`flex gap-2 text-xs rounded-lg p-2 sm:p-2.5  transition-colors ${
                                              log.isCurrent
                                                ? '       shadow-soft '
                                                : 'bg-card'
                                            }`}
                                          >
                                            <span className="text-muted-foreground whitespace-nowrap flex items-center gap-1 flex-shrink-0">
                                              {log.isCurrent ? (
                                                <Loader2 className="w-2 h-2 sm:w-2.5 sm:h-2.5 animate-spin text-brand" />
                                              ) : (
                                                <Clock className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-muted-foreground" />
                                              )}
                                              {log.time}
                                            </span>
                                            <div className="flex-1">
                                              <p
                                                className={
                                                  log.isCurrent ? 'text-brand  font-medium' : 'text-foreground '
                                                }
                                              >
                                                {log.message}
                                              </p>
                                            </div>
                                          </div>
                                        ))
                                      ) : (
                                        <div className="text-center text-muted-foreground py-4 text-xs">
                                          暂无执行记录
                                        </div>
                                      )}
                                    </div>
                                  </ScrollArea>
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-6 sm:py-8">
                      <div className="bg-brand-subtle rounded-full w-12 h-12 sm:w-14 sm:h-14 mx-auto mb-3 sm:mb-4 flex items-center justify-center">
                        <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />
                      </div>
                      <p className="text-xs sm:text-sm">等待开始生成…</p>
                    </div>
                  )}
                </CardContent>
              </ScrollArea>
            </Card>
          </div>

          {/* 右侧：结果展示区域（移动端全宽，桌面端50%） */}
          <div className="flex md:flex-col bg-card min-h-[50vh] md:min-h-0 w-full min-w-0 overflow-hidden">
            <Card className="flex-1 flex flex-col m-0 rounded-none border-0 shadow-none w-full min-w-0">
              <CardHeader className="sticky top-0 z-10 flex-shrink-0 px-3 sm:px-5 py-3 h-[60px] sm:h-[68px]">
                <div className="flex items-center justify-between">
                  <CardTitle className="lead-title flex items-center gap-2 sm:gap-2.5">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-brand-subtle flex items-center justify-center shadow-soft">
                      <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand" />
                    </div>
                    <span className="">专利说明书</span>
                  </CardTitle>
                  <div className="flex gap-1 sm:gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleDownload()} className="text-xs sm:text-sm h-7 sm:h-8 transition-colors duration-300">
                      <Download className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" />
                      下载 Word
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportPdf} className="text-xs sm:text-sm h-7 sm:h-8 transition-colors duration-300">
                      <FileDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" />
                      导出 PDF
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {/* 标签栏 - 固定在顶部 */}
              <div className="sticky top-0 bg-card z-10 px-2 sm:px-4 py-2 sm:py-3 flex-shrink-0">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-5 bg-muted hover:bg-muted/80 transition-colors duration-300">
                    <TabsTrigger value="summary" className="text-xs data-[state=active]:text-brand data-[state=inactive]:text-muted-foreground">摘要</TabsTrigger>
                    <TabsTrigger value="description" className="text-xs data-[state=active]:text-brand data-[state=inactive]:text-muted-foreground">说明书</TabsTrigger>
                    <TabsTrigger value="drawings" className="text-xs data-[state=active]:text-brand data-[state=inactive]:text-muted-foreground">附图</TabsTrigger>
                    <TabsTrigger value="claims" className="text-xs data-[state=active]:text-brand data-[state=inactive]:text-muted-foreground">权利要求书</TabsTrigger>
                    <TabsTrigger value="references" className="text-xs data-[state=active]:text-brand data-[state=inactive]:text-muted-foreground">参考来源</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <ScrollArea className="flex-1 max-h-[60vh] md:max-h-none">
                <div className="p-2 sm:p-4">
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <div>
                      <TabsContent value="summary" className="mt-0 focus:outline-none">
                        <div className="prose max-w-none h-[calc(100vh-220px)] flex flex-col">
                          <div className="flex items-center justify-between mb-2 sm:mb-3 flex-shrink-0">
                            <h3 className="section-title">摘要</h3>
                            {patentData.summary?.content && (
                              <Button variant="ghost" size="sm" onClick={() => handleCopy(patentData.summary!.content)} className="text-xs sm:text-sm h-7 sm:h-8 hover:bg-muted hover:text-brand transition-colors duration-300">
                                <Copy className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                              </Button>
                            )}
                          </div>
                          <ScrollArea className="flex-1">
                            <div className="reading-body whitespace-pre-wrap rounded-xl bg-muted p-3 sm:p-5 transition-colors duration-300">
                              {patentData.summary?.content || '摘要内容将在这里显示…'}
                            </div>
                          </ScrollArea>
                        </div>
                      </TabsContent>

                      <TabsContent value="description" className="mt-0 focus:outline-none">
                        <div className="prose max-w-none h-[calc(100vh-220px)] flex flex-col">
                          <div className="flex items-center justify-between mb-2 sm:mb-3 flex-shrink-0">
                            <h3 className="section-title">说明书</h3>
                            {patentData.description?.content && (
                              <Button variant="ghost" size="sm" onClick={() => handleCopy(patentData.description!.content)} className="text-xs sm:text-sm h-7 sm:h-8 hover:bg-muted hover:text-brand transition-colors duration-300">
                                <Copy className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                              </Button>
                            )}
                          </div>
                          <ScrollArea className="flex-1">
                            <div className="reading-body whitespace-pre-wrap rounded-xl bg-muted p-3 sm:p-5 transition-colors duration-300">
                              {patentData.description?.content || '说明书内容将在这里显示…'}
                            </div>
                          </ScrollArea>
                        </div>
                      </TabsContent>

                      <TabsContent value="drawings" className="mt-0 focus:outline-none">
                        <div className="prose max-w-none h-[calc(100vh-220px)] flex flex-col">
                          <div className="mb-2 sm:mb-3 flex-shrink-0">
                            <h3 className="section-title">附图</h3>
                          </div>
                          <ScrollArea className="flex-1">
                            <div className="reading-body whitespace-pre-wrap mb-3 sm:mb-4 rounded-xl bg-muted p-3 sm:p-5 transition-colors duration-300">
                              {patentData.drawings?.content || '附图说明将在这里显示…'}
                            </div>
                            {patentData.drawings?.images && patentData.drawings.images.length > 0 && (
                              <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 sm:gap-3 mt-3 sm:mt-4">
                                {patentData.drawings.images.map((imageUrl, index) => (
                                  <div
                                    key={index}
                                    className=" rounded-xl overflow-hidden transition-colors duration-300 cursor-pointer"
                                    onClick={() => setEnlargedImage(imageUrl)}
                                  >
                                    <img
                                      src={imageUrl}
                                      alt={`附图${index + 1}`}
                                      className="w-full h-auto"
                                    />
                                    <div className="p-2 sm:p-2.5 text-center text-xs sm:text-sm text-muted-foreground">
                                      图{index + 1}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </ScrollArea>
                        </div>
                      </TabsContent>

                      <TabsContent value="claims" className="mt-0 focus:outline-none">
                        <div className="prose max-w-none h-[calc(100vh-220px)] flex flex-col">
                          <div className="flex items-center justify-between mb-2 sm:mb-3 flex-shrink-0">
                            <h3 className="section-title">权利要求书</h3>
                            {patentData.claims?.content && (
                              <Button variant="ghost" size="sm" onClick={() => handleCopy(patentData.claims!.content)} className="text-xs sm:text-sm h-7 sm:h-8 hover:bg-muted hover:text-brand transition-colors duration-300">
                                <Copy className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                              </Button>
                            )}
                          </div>
                          <ScrollArea className="flex-1">
                            <div className="reading-body whitespace-pre-wrap rounded-xl bg-muted p-3 sm:p-5 transition-colors duration-300">
                              {patentData.claims?.content || '权利要求书内容将在这里显示…'}
                            </div>
                          </ScrollArea>
                        </div>
                      </TabsContent>

                      <TabsContent value="references" className="mt-0 focus:outline-none">
                        <div className="prose max-w-none h-[calc(100vh-220px)] flex flex-col">
                          <div className="mb-2 sm:mb-3 flex-shrink-0">
                            <h3 className="section-title">参考来源</h3>
                            <p className="text-xs text-muted-foreground">相关文献和技术资料</p>
                          </div>
                          <ScrollArea className="flex-1">
                            {patentData.references && patentData.references.length > 0 ? (
                              <div className="space-y-2 sm:space-y-2.5 max-w-full w-full min-w-0">
                                {patentData.references.map((ref, index) => (
                                  <div key={index} className="p-2.5 sm:p-3.5 rounded-xl transition-colors duration-300 w-full min-w-0">
                                    <div className="flex items-start gap-2 sm:gap-3 w-full min-w-0">
                                      <span className="bg-brand-subtle font-bold min-w-[24px] sm:min-w-[28px] text-brand text-sm sm:text-base rounded-lg w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center flex-shrink-0">
                                        {index + 1}
                                      </span>
                                      <div className="flex-1 min-w-0 overflow-hidden">
                                        <p className="text-foreground text-xs sm:text-sm mb-1.5 sm:mb-2 leading-relaxed break-words w-full min-w-0">{ref.text}</p>
                                        {ref.url && (
                                          <a
                                            href={ref.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-brand hover:text-brand text-xs flex items-center gap-1 sm:gap-1.5 inline-flex transition-colors w-full min-w-0 break-all"
                                          >
                                            <BookOpen className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
                                            <span className="break-all flex-1 min-w-0">{ref.url}</span>
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center text-muted-foreground py-8 sm:py-10">
                                <div className="bg-brand-subtle rounded-full w-12 h-12 sm:w-14 sm:h-14 mx-auto mb-3 sm:mb-4 flex items-center justify-center">
                                  <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-brand" />
                                </div>
                                <p className="text-xs sm:text-sm">暂无参考来源</p>
                              </div>
                            )}
                          </ScrollArea>
                        </div>
                      </TabsContent>
                    </div>
                  </Tabs>
                </div>
              </ScrollArea>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
