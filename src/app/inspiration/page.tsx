'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Lightbulb,
  Sparkles,
  TrendingUp,
  Star,
  Heart,
  MessageCircle,
  Send,
  X,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface InspirationCard {
  id: string;
  title: string;
  description: string;
  rarity: number; // 1-10, 稀缺性值
  category: string;
  categoryId: string;
  image?: string;
  tags?: string[];
  favoritesCount: number;
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  description: string;
}

interface Comment {
  id: string;
  content: string;
  username: string;
  createdAt: string;
}

export default function InspirationPage() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [inspirations, setInspirations] = useState<InspirationCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedInspiration, setSelectedInspiration] = useState<InspirationCard | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isFavoriting, setIsFavoriting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const pageSize = 12;

  const categories: Category[] = [
    { id: 'all', name: '全部', icon: '🌟', description: '所有专利灵感' },
    { id: '家电类', name: '家电类', icon: '🏠', description: '智能家居、白色家电等' },
    { id: '医疗类', name: '医疗类', icon: '🏥', description: '医疗设备、健康监测等' },
    { id: '电子类', name: '电子类', icon: '📱', description: '消费电子、通讯设备等' },
    { id: '机械类', name: '机械类', icon: '⚙️', description: '工业机械、自动化设备等' },
    { id: '软件类', name: '软件类', icon: '💻', description: '计算机软件、AI应用等' },
    { id: '环保类', name: '环保类', icon: '🌱', description: '环保技术、新能源等' },
  ];

  const getRarityColor = (rarity: number) => {
    if (rarity >= 9) return 'bg-primary text-primary-foreground';
    if (rarity >= 7) return 'bg-primary/80 text-primary-foreground';
    if (rarity >= 5) return 'bg-secondary text-secondary-foreground';
    return 'bg-muted text-foreground';
  };

  const getRarityLabel = (rarity: number) => {
    if (rarity >= 9) return '极度稀缺';
    if (rarity >= 7) return '非常稀缺';
    if (rarity >= 5) return '比较稀缺';
    return '一般稀缺';
  };

  // 将稀缺性（1-10）转换为星星（1-5）
  const getStars = (rarity: number) => {
    const stars = Math.round(rarity / 2);
    return Array(5).fill(0).map((_, i) => i < stars);
  };

  // 加载灵感数据
  const loadInspirations = async (pageNum: number = 1, isLoadMore: boolean = false) => {
    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 创建新的 abort controller
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (!isLoadMore) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const params = new URLSearchParams({
        pagination: 'true',
        page: pageNum.toString(),
        pageSize: pageSize.toString(),
      });

      if (activeCategory !== 'all') {
        params.append('category', activeCategory);
      }

      const response = await fetch(`/api/inspirations?${params}`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // 确保返回的数据结构正确
      if (data.data && Array.isArray(data.data)) {
        if (isLoadMore) {
          setInspirations((prev) => [...prev, ...data.data]);
        } else {
          setInspirations(data.data);
        }

        setHasMore(data.hasMore || false);
        setTotal(data.total || 0);
        setPage(pageNum);
      } else {
        console.error('Invalid data format received:', data);
        if (!isLoadMore) {
          setInspirations([]);
        }
        setError('数据格式错误');
      }
    } catch (error: any) {
      // 如果是取消请求，不设置错误
      if (error.name === 'AbortError') {
        console.log('Request aborted');
        return;
      }

      console.error('Error loading inspirations:', error);
      if (!isLoadMore) {
        setInspirations([]);
      }
      setError(error.message || '加载失败，请重试');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      abortControllerRef.current = null;
    }
  };

  // 加载更多
  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    loadInspirations(page + 1, true);
  }, [loadingMore, hasMore, page]);

  // Intersection Observer 用于检测滚动到底部
  useEffect(() => {
    let observer: IntersectionObserver | null = null;
    let hasScrolled = false;

    // 监听滚动事件，确保用户主动滚动后才触发加载
    const handleScroll = () => {
      hasScrolled = true;
      window.removeEventListener('scroll', handleScroll);
    };

    window.addEventListener('scroll', handleScroll);

    // 延迟初始化 Observer，避免页面刚加载时就触发
    const initObserver = () => {
      observer = new IntersectionObserver(
        (entries) => {
          // 只有当用户已经滚动过，且元素在视口内时才加载更多
          if (entries[0].isIntersecting && hasMore && !loading && !loadingMore && hasScrolled) {
            handleLoadMore();
          }
        },
        { threshold: 0.1 }
      );

      if (loadMoreRef.current) {
        observer.observe(loadMoreRef.current);
      }
    };

    // 延迟 500ms 后初始化 Observer
    const timer = setTimeout(initObserver, 500);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', handleScroll);
      if (observer && loadMoreRef.current) {
        observer.unobserve(loadMoreRef.current);
      }
    };
  }, [handleLoadMore, hasMore, loading, loadingMore, inspirations.length]);

  // 监听分类变化
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    loadInspirations(1, false);
  }, [activeCategory]);

  // 组件卸载时取消未完成的请求
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // 加载评论
  const loadComments = async (inspirationId: string) => {
    try {
      const response = await fetch(`/api/inspirations/${inspirationId}/comments`);
      const data = await response.json();
      setComments(data || []);
    } catch (error) {
      console.error('Error loading comments:', error);
      setComments([]);
    }
  };

  // 提交评论
  const handleCommentSubmit = async () => {
    if (!selectedInspiration || !newComment.trim()) return;

    setIsSubmittingComment(true);
    try {
      const response = await fetch(`/api/inspirations/${selectedInspiration.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newComment,
          username: '匿名用户',
        }),
      });

      if (response.ok) {
        setNewComment('');
        await loadComments(selectedInspiration.id);
      } else {
        // 之前失败时静默无提示，用户会以为评论已发出
        const data = await response.json().catch(() => ({}));
        setError(data?.error || '评论提交失败，请重试');
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
      setError('评论提交失败，请重试');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // 收藏/取消收藏
  const handleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedInspiration || isFavoriting) return;

    setIsFavoriting(true);
    try {
      const response = await fetch(`/api/inspirations/${selectedInspiration.id}`, {
        method: 'POST',
      });

      if (response.ok) {
        const updatedInspiration = await response.json();
        setSelectedInspiration(updatedInspiration);

        // 更新列表中的收藏数
        setInspirations(prev =>
          prev.map(item =>
            item.id === updatedInspiration.id ? { ...item, favoritesCount: updatedInspiration.favoritesCount } : item
          )
        );
      }
    } catch (error) {
      console.error('Error favoriting:', error);
    } finally {
      setIsFavoriting(false);
    }
  };

  // 打开详情
  const openDetail = (inspiration: InspirationCard) => {
    setSelectedInspiration(inspiration);
    loadComments(inspiration.id);
  };

  // 重新加载
  const handleRetry = () => {
    setPage(1);
    setHasMore(true);
    loadInspirations(1, false);
  };

  const selectedStars = selectedInspiration ? getStars(selectedInspiration.rarity) : [];

  return (
    <div className="min-h-screen overflow-hidden">
      {/* 页面标题 */}
      <div className="page-header">
        <div className="container mx-auto">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 sm:p-3 rounded-xl bg-brand shadow-soft">
              <Lightbulb className="w-5 h-5 sm:w-6 sm:h-6 text-brand-foreground" />
            </div>
            <div>
              <h1 className="page-title">
                专利灵感库
              </h1>
              <p className="page-subtitle">
                发现创新方向，激发创作灵感
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 分类标签 */}
      <div className="border-b bg-card sticky top-[70px] z-40">
        <div className="container mx-auto px-2 sm:px-4">
          <ScrollArea className="w-full">
            <div className="flex gap-2 py-3 pb-3 min-w-max">
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  variant={activeCategory === cat.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-1.5 sm:gap-2 h-8 sm:h-9 px-3 sm:px-4 text-xs sm:text-sm transition-all duration-300 ${
                    activeCategory === cat.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted text-foreground hover:text-primary border-border'
                  }`}
                >
                  <span className="text-base">{cat.icon}</span>
                  <span>{cat.name}</span>
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* 瀑布流内容 */}
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 border-4 border-t-brand rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">加载灵感中...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="bg-brand-subtle rounded-full w-20 h-20 flex items-center justify-center mb-4">
              <X className="w-10 h-10 text-destructive" />
            </div>
            <h3 className="lead-title mb-2">
              加载失败
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mb-4">
              {error}
            </p>
            <Button onClick={handleRetry} className="bg-brand hover:bg-brand">
              重新加载
            </Button>
          </div>
        ) : inspirations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="bg-brand-subtle rounded-full w-20 h-20 flex items-center justify-center mb-4">
              <Sparkles className="w-10 h-10 text-brand" />
            </div>
            <h3 className="lead-title mb-2">
              暂无灵感内容
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              该分类下还没有专利灵感，快去管理后台生成一些吧！
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
              {inspirations.map((item) => {
                const stars = getStars(item.rarity);
                return (
                  <Card
                    key={item.id}
                    onClick={() => openDetail(item)}
                    className="group cursor-pointer overflow-hidden bg-card hover:shadow-soft hover:border-border transition-all duration-300 hover:-translate-y-1"
                  >
                    <CardContent className="p-4 sm:p-5">
                      {/* 稀缺性标签 */}
                      <div className="flex items-center justify-between mb-3">
                        <div
                          className={`${getRarityColor(
                            item.rarity
                          )} px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-medium`}
                        >
                          {getRarityLabel(item.rarity)}
                        </div>
                        <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
                          <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          <span className="font-medium">{item.rarity}.0</span>
                        </div>
                      </div>

                      {/* 标题 */}
                      <h3 className="section-title mb-2 line-clamp-2 group-hover:text-brand transition-colors">
                        {item.title}
                      </h3>

                      {/* 描述 */}
                      <p className="text-xs sm:text-sm text-muted-foreground mb-4 line-clamp-3 leading-relaxed">
                        {item.description}
                      </p>

                      {/* 底部信息 */}
                      <div className="flex items-center justify-between pt-3">
                        {/* 星星 */}
                        <div className="flex gap-0.5">
                          {stars.map((filled, i) => (
                            <Star
                              key={i}
                              className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${
                                filled ? 'fill-warning text-warning' : 'text-muted-foreground'
                              }`}
                            />
                          ))}
                        </div>
                        {/* 收藏数 */}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Heart className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          <span>{item.favoritesCount}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* 加载更多 */}
            {hasMore && (
              <div ref={loadMoreRef} className="flex flex-col items-center justify-center py-8">
                {loadingMore ? (
                  <div className="flex items-center gap-3 text-brand">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm font-medium">加载更多灵感...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <ChevronDown className="w-5 h-5" />
                    <span className="text-sm">向下滚动加载更多</span>
                  </div>
                )}
              </div>
            )}

            {/* 已全部加载 */}
            {!hasMore && inspirations.length > 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="bg-brand-subtle rounded-full w-16 h-16 flex items-center justify-center mb-3">
                  <Sparkles className="w-8 h-8 text-brand" />
                </div>
                <p className="text-sm text-muted-foreground">
                  已加载全部 {total} 条灵感
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* 详情弹框 */}
      <Dialog open={!!selectedInspiration} onOpenChange={() => setSelectedInspiration(null)}>
        <DialogContent className="bg-card max-w-3xl sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          {selectedInspiration && (
            <>
              <DialogHeader className="border-b pb-4">
                <DialogTitle className="lead-title">
                  {selectedInspiration.title}
                </DialogTitle>
              </DialogHeader>

              {/* Meta 信息 */}
              <div className="flex items-center gap-4 px-6 pt-4 pb-2">
                <span className="text-xs bg-brand-subtle text-brand px-2 py-1 rounded-full">
                  {selectedInspiration.category}
                </span>
                <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
                  {selectedStars.map((filled, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${filled ? 'fill-warning text-warning' : 'text-muted-foreground'}`}
                    />
                  ))}
                </div>
              </div>

              {/* 内容区 */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                <p className="text-sm text-foreground leading-relaxed mb-6">
                  {selectedInspiration.description}
                </p>

                {/* 收藏按钮 */}
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleFavorite}
                    disabled={isFavoriting}
                    className="flex items-center gap-2"
                  >
                    <Heart className={`w-4 h-4 ${isFavoriting ? 'animate-pulse' : ''}`} />
                    {isFavoriting ? '收藏中...' : '收藏'}
                    {selectedInspiration.favoritesCount > 0 && (
                      <span className="text-xs bg-brand-subtle text-brand px-2 py-0.5 rounded-full">
                        {selectedInspiration.favoritesCount}
                      </span>
                    )}
                  </Button>
                </div>

                {/* 评论区 */}
                <div className="mt-8">
                  <h3 className="section-title mb-4 flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-brand" />
                    评论 ({comments.length})
                  </h3>
                  <div className="space-y-3 mb-4">
                    {comments.map((comment) => (
                      <div key={comment.id} className="bg-muted rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-foreground">
                            {comment.username}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(comment.createdAt).toLocaleDateString('zh-CN')}
                          </span>
                        </div>
                        <p className="text-sm text-foreground">{comment.content}</p>
                      </div>
                    ))}
                    {comments.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        还没有评论，快来发表第一条吧！
                      </p>
                    )}
                  </div>

                  {/* 评论输入框 */}
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="写下你的评论..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="flex-1 resize-none text-sm"
                      rows={3}
                    />
                    <Button
                      onClick={handleCommentSubmit}
                      disabled={isSubmittingComment || !newComment.trim()}
                      className="self-end h-[76px]"
                    >
                      {isSubmittingComment ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
