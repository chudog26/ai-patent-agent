'use client';

import { useState, useEffect } from 'react';
import { Settings, Sparkles, Wand2, Plus, Trash2, RefreshCw, CheckCircle2, AlertCircle, Users, Calendar, UserCircle, Search, Mail, Phone, Building, Briefcase, Lock, Shield, FileText, Eye, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AiProviderConfig } from '@/components/ai-provider-config';
import { useUser } from '@/contexts/UserContext';

interface Category {
  id: string;
  name: string;
  icon: string;
  description: string;
}

interface Inspiration {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  rarity: number;
  image?: string;
  status: string;
  createdAt: string;
}

interface User {
  id: string;
  username: string;
  hasPassword: boolean;
  email: string | null;
  phone: string | null;
  company: string | null;
  position: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
  patentCount: number;
  reviewCount: number;
}

export default function AdminPage() {
  const { currentUser } = useUser();
  const [categories, setCategories] = useState<Category[]>([]);
  const [inspirations, setInspirations] = useState<Inspiration[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [generateCount, setGenerateCount] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number; message: string } | null>(null);

  // 用户搜索和筛选
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');

  // 用户编辑
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserForm, setEditUserForm] = useState({
    username: '',
    email: '',
    phone: '',
    company: '',
    position: '',
    role: 'user',
    password: '',
  });
  const [savingUser, setSavingUser] = useState(false);

  // 加载分类
  const loadCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      const data = await response.json();
      setCategories(data);
      if (data.length > 0 && !selectedCategory) {
        setSelectedCategory(data[0].id);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  // 加载灵感列表
  const loadInspirations = async () => {
    try {
      const response = await fetch('/api/admin/inspirations');
      const data = await response.json();
      setInspirations(data);
    } catch (error) {
      console.error('Error loading inspirations:', error);
    }
  };

  // 加载用户列表
  const loadUsers = async () => {
    try {
      const response = await fetch('/api/admin/users');
      const data = await response.json();
      if (data.success) {
        setUsers(data.users);
        // 同时更新筛选后的列表
        setFilteredUsers(data.users);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  useEffect(() => {
    loadCategories();
    loadInspirations();
    loadUsers();
  }, []);

  // 用户筛选逻辑
  useEffect(() => {
    let filtered = users;

    // 按搜索词筛选
    if (userSearchTerm) {
      const term = userSearchTerm.toLowerCase();
      filtered = filtered.filter(user =>
        user.username.toLowerCase().includes(term) ||
        user.email?.toLowerCase().includes(term) ||
        user.phone?.toLowerCase().includes(term) ||
        user.company?.toLowerCase().includes(term) ||
        user.position?.toLowerCase().includes(term) ||
        user.id.toLowerCase().includes(term)
      );
    }

    // 按角色筛选
    if (userRoleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === userRoleFilter);
    }

    setFilteredUsers(filtered);
  }, [users, userSearchTerm, userRoleFilter]);

  // 生成专利灵感
  const handleGenerate = async () => {
    if (!selectedCategory) {
      alert('请选择分类');
      return;
    }

    setIsGenerating(true);
    setGenerationProgress({ current: 0, total: generateCount, message: '正在初始化...' });

    try {
      const response = await fetch('/api/generate-inspirations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: selectedCategory,
          count: generateCount,
        }),
      });

      if (!response.ok) {
        throw new Error('生成失败');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.type === 'progress') {
                setGenerationProgress({
                  current: data.current,
                  total: data.total,
                  message: data.message,
                });
              } else if (data.type === 'complete') {
                setGenerationProgress({
                  current: data.current,
                  total: data.total,
                  message: '生成完成！',
                });
              }
            } catch (e) {
              // Ignore JSON parse errors
            }
          }
        }
      }

      // 刷新灵感列表
      await loadInspirations();
    } catch (error) {
      console.error('Error generating inspirations:', error);
      alert('生成失败，请重试');
    } finally {
      setIsGenerating(false);
      setGenerationProgress(null);
    }
  };

  // 打开编辑用户对话框
  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditUserForm({
      username: user.username,
      email: user.email || '',
      phone: user.phone || '',
      company: user.company || '',
      position: user.position || '',
      role: user.role,
      password: '',
    });
  };

  // 关闭编辑用户对话框
  const handleCloseEditUser = () => {
    setEditingUser(null);
    setEditUserForm({
      username: '',
      email: '',
      phone: '',
      company: '',
      position: '',
      role: 'user',
      password: '',
    });
  };

  // 保存用户编辑
  const handleSaveUser = async () => {
    if (!editingUser) return;

    setSavingUser(true);

    try {
      const updateData: any = {
        username: editUserForm.username,
        email: editUserForm.email || null,
        phone: editUserForm.phone || null,
        company: editUserForm.company || null,
        position: editUserForm.position || null,
        role: editUserForm.role,
      };

      // 如果填写了新密码，则更新密码
      if (editUserForm.password) {
        updateData.password = editUserForm.password;
      }

      const response = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        await loadUsers();
        handleCloseEditUser();
        alert('用户信息更新成功');
      } else {
        const data = await response.json();
        alert(data.error || '更新失败');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      alert('更新失败');
    } finally {
      setSavingUser(false);
    }
  };

  // 删除灵感
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个灵感吗？')) return;

    try {
      const response = await fetch(`/api/admin/inspirations/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadInspirations();
      }
    } catch (error) {
      console.error('Error deleting inspiration:', error);
      alert('删除失败');
    }
  };

  // 删除用户
  const handleDeleteUser = async (id: string) => {
    if (!confirm('确定要删除这个用户吗？此操作不可恢复！')) return;

    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadUsers();
        alert('用户已删除');
      } else {
        alert('删除失败');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('删除失败');
    }
  };

  const selectedCategoryName = categories.find(c => c.id === selectedCategory)?.name || '';

  // 权限检查：只允许管理员访问
  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md shadow-soft bg-card">
          <CardContent className="p-8 text-center">
            <Shield className="w-16 h-16 mx-auto text-brand mb-4" />
            <h3 className="lead-title mb-2">访问受限</h3>
            <p className="text-sm text-muted-foreground mb-6">管理后台仅限管理员访问，请使用管理员账号登录</p>
            <Button onClick={() => window.location.href = '/'} className="w-full">
              返回首页
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-hidden">
      {/* 页面标题 */}
      <div className="page-header">
        <div className="container mx-auto">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 sm:p-3 rounded-xl bg-brand shadow-soft">
              <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-brand-foreground" />
            </div>
            <div>
              <h1 className="page-title">
                管理后台
              </h1>
              <p className="page-subtitle mt-1">
                一键生成并管理专利灵感和用户
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6">
        <Tabs defaultValue="inspirations" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="inspirations" className="gap-2">
              <Sparkles className="w-4 h-4" />
              灵感管理
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" />
              用户管理
            </TabsTrigger>
            <TabsTrigger value="ai-providers" className="gap-2">
              <Settings className="w-4 h-4" />
              AI 服务配置
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inspirations">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* 左侧：生成设置 */}
              <Card className="bg-card">
                <CardHeader>
                  <CardTitle className="lead-title flex items-center gap-2">
                    <Wand2 className="w-5 h-5 sm:w-6 sm:h-6 text-brand" />
                    生成专利灵感
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    选择分类和数量，AI将为您生成多个专利灵感方向
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 sm:space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="category">选择分类</Label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory} disabled={isGenerating}>
                      <SelectTrigger>
                        <SelectValue placeholder="请选择分类" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            <span className="mr-2">{cat.icon}</span>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="count">生成数量</Label>
                    <Input
                      id="count"
                      type="number"
                      min={1}
                      max={20}
                      value={generateCount}
                      onChange={(e) => setGenerateCount(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                      disabled={isGenerating}
                    />
                    <p className="text-xs text-muted-foreground">建议生成 3-10 个灵感</p>
                  </div>

                  {isGenerating && generationProgress && (
                    <div className="bg-brand-subtle rounded-lg p-3 sm:p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <RefreshCw className="w-4 h-4 text-brand animate-spin" />
                        <span className="text-sm font-medium text-brand">
                          正在生成 ({generationProgress.current}/{generationProgress.total})
                        </span>
                      </div>
                      <div className="w-full bg-brand-subtle rounded-full h-2 mb-2">
                        <div
                          className="h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${(generationProgress.current / generationProgress.total) * 100}%`,
                          }}
                        />
                      </div>
                      <p className="text-xs text-brand">{generationProgress.message}</p>
                    </div>
                  )}

                  <Button
                    onClick={handleGenerate}
                    disabled={isGenerating || !selectedCategory}
                    className="w-full h-10 sm:h-11 shadow-soft hover:shadow-soft transition-all duration-300 text-xs sm:text-sm font-medium"
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        开始生成
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* 右侧：灵感列表 */}
              <Card className="bg-card">
                <CardHeader>
                  <CardTitle className="lead-title flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-brand" />
                      已生成的灵感
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadInspirations}
                      className="h-8 sm:h-9 text-xs sm:text-sm"
                    >
                      <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                      刷新
                    </Button>
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    共 {inspirations.length} 个灵感
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px] sm:h-[500px]">
                    {inspirations.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="bg-brand-subtle rounded-full w-16 h-16 flex items-center justify-center mb-3">
                          <Plus className="w-8 h-8 text-brand" />
                        </div>
                        <p className="text-sm text-muted-foreground">暂无灵感，快去生成一些吧！</p>
                      </div>
                    ) : (
                      <div className="space-y-3 p-1">
                        {inspirations.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-lg p-3 sm:p-4 transition-all"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-medium">
                                    稀缺度: {item.rarity}
                                  </span>
                                  {item.status === 'published' && (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                                  )}
                                </div>
                                <h4 className="row-title mb-1 line-clamp-1">
                                  {item.title}
                                </h4>
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {item.description}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(item.id)}
                                className="h-8 w-8 p-0 text-destructive hover:bg-destructive-subtle flex-shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users">
            <Card className="bg-card">
              <CardHeader>
                <CardTitle className="lead-title flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 sm:w-6 sm:h-6 text-brand" />
                    用户列表
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadUsers}
                    className="h-8 sm:h-9 text-xs sm:text-sm"
                  >
                    <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                    刷新
                  </Button>
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  共 {filteredUsers.length} 个用户（总计 {users.length} 个）
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 搜索和筛选栏 */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="搜索用户名、邮箱、电话、公司、职位..."
                      value={userSearchTerm}
                      onChange={(e) => setUserSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="sm:w-40">
                    <select
                      value={userRoleFilter}
                      onChange={(e) => setUserRoleFilter(e.target.value)}
                      className="field w-full h-10 px-3 rounded-md text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
                    >
                      <option value="all">所有角色</option>
                      <option value="user">普通用户</option>
                      <option value="admin">管理员</option>
                    </select>
                  </div>
                </div>

                {/* 用户列表 */}
                <ScrollArea className="h-[600px]">
                  {filteredUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="bg-brand-subtle rounded-full w-16 h-16 flex items-center justify-center mb-3">
                        <UserCircle className="w-8 h-8 text-brand" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {userSearchTerm || userRoleFilter !== 'all' ? '未找到匹配的用户' : '暂无用户'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredUsers.map((user) => (
                        <div
                          key={user.id}
                          className="rounded-lg p-4 transition-all"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              {/* 用户基本信息 */}
                              <div className="flex items-start gap-3 mb-3">
                                <div className="w-12 h-12 rounded-full bg-brand flex items-center justify-center flex-shrink-0">
                                  <UserCircle className="w-6 h-6 text-brand-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="row-title truncate">
                                      {user.username}
                                    </h4>
                                    {user.role === 'admin' && (
                                      <Badge variant="secondary" className="flex items-center gap-1">
                                        <Shield className="w-3 h-3" />
                                        管理员
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {new Date(user.createdAt).toLocaleDateString('zh-CN')}
                                    </span>
                                    <span>•</span>
                                    <span className="font-mono text-xs">
                                      ID: {user.id}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* 用户详细信息 */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                                {/* 密码 */}
                                <div className="flex items-center gap-2 text-xs">
                                  <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                  <span className="text-muted-foreground">密码:</span>
                                  <span className="text-muted-foreground">
                                    {user.hasPassword ? '已加密存储' : '未设置'}
                                  </span>
                                </div>

                                {/* 邮箱 */}
                                <div className="flex items-center gap-2 text-xs">
                                  <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                  <span className="text-muted-foreground">邮箱:</span>
                                  <span className="truncate">
                                    {user.email || <span className="text-muted-foreground">未设置</span>}
                                  </span>
                                </div>

                                {/* 电话 */}
                                <div className="flex items-center gap-2 text-xs">
                                  <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                  <span className="text-muted-foreground">电话:</span>
                                  <span className="truncate">
                                    {user.phone || <span className="text-muted-foreground">未设置</span>}
                                  </span>
                                </div>

                                {/* 公司 */}
                                <div className="flex items-center gap-2 text-xs">
                                  <Building className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                  <span className="text-muted-foreground">公司:</span>
                                  <span className="truncate">
                                    {user.company || <span className="text-muted-foreground">未设置</span>}
                                  </span>
                                </div>

                                {/* 职位 */}
                                <div className="flex items-center gap-2 text-xs sm:col-span-2">
                                  <Briefcase className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                  <span className="text-muted-foreground">职位:</span>
                                  <span className="truncate">
                                    {user.position || <span className="text-muted-foreground">未设置</span>}
                                  </span>
                                </div>
                              </div>

                              {/* 统计信息 */}
                              <div className="grid grid-cols-2 gap-2 mb-3">
                                <div className="flex items-center gap-2 text-xs bg-brand-subtle px-3 py-2 rounded-lg">
                                  <FileText className="w-4 h-4 text-brand flex-shrink-0" />
                                  <span className="text-muted-foreground">专利编写:</span>
                                  <span className="font-semibold text-brand">{user.patentCount}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs bg-brand-subtle px-3 py-2 rounded-lg">
                                  <Eye className="w-4 h-4 text-brand flex-shrink-0" />
                                  <span className="text-muted-foreground">专利审查:</span>
                                  <span className="font-semibold text-brand">{user.reviewCount}</span>
                                </div>
                              </div>

                              {/* 更新时间 */}
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <span>更新于:</span>
                                <span>{new Date(user.updatedAt).toLocaleString('zh-CN')}</span>
                              </div>
                            </div>

                            {/* 操作按钮 */}
                            <div className="flex flex-col gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditUser(user)}
                                className="h-9 w-9 p-0 text-brand hover:text-brand hover:bg-brand-subtle flex-shrink-0"
                                title="编辑用户"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteUser(user.id)}
                                className="h-9 w-9 p-0 text-destructive hover:bg-destructive-subtle flex-shrink-0"
                                title="删除用户"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai-providers" className="space-y-4 mt-4">
            <AiProviderConfig scope="global" />
          </TabsContent>
        </Tabs>
      </div>

      {/* 编辑用户对话框 */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && handleCloseEditUser()}>
        <DialogContent className="bg-card sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑用户信息</DialogTitle>
            <DialogDescription>修改用户的账号信息和权限</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 用户名 */}
            <div className="space-y-2">
              <Label htmlFor="edit-username">用户名</Label>
              <Input
                id="edit-username"
                value={editUserForm.username}
                onChange={(e) => setEditUserForm({ ...editUserForm, username: e.target.value })}
                placeholder="请输入用户名"
              />
            </div>

            {/* 邮箱 */}
            <div className="space-y-2">
              <Label htmlFor="edit-email">邮箱</Label>
              <Input
                id="edit-email"
                type="email"
                value={editUserForm.email}
                onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
                placeholder="请输入邮箱"
              />
            </div>

            {/* 电话 */}
            <div className="space-y-2">
              <Label htmlFor="edit-phone">电话</Label>
              <Input
                id="edit-phone"
                type="tel"
                value={editUserForm.phone}
                onChange={(e) => setEditUserForm({ ...editUserForm, phone: e.target.value })}
                placeholder="请输入电话"
              />
            </div>

            {/* 公司 */}
            <div className="space-y-2">
              <Label htmlFor="edit-company">公司</Label>
              <Input
                id="edit-company"
                value={editUserForm.company}
                onChange={(e) => setEditUserForm({ ...editUserForm, company: e.target.value })}
                placeholder="请输入公司"
              />
            </div>

            {/* 职位 */}
            <div className="space-y-2">
              <Label htmlFor="edit-position">职位</Label>
              <Input
                id="edit-position"
                value={editUserForm.position}
                onChange={(e) => setEditUserForm({ ...editUserForm, position: e.target.value })}
                placeholder="请输入职位"
              />
            </div>

            {/* 用户角色 */}
            <div className="space-y-2">
              <Label htmlFor="edit-role">用户权限</Label>
              <Select
                value={editUserForm.role}
                onValueChange={(value) => setEditUserForm({ ...editUserForm, role: value })}
              >
                <SelectTrigger id="edit-role">
                  <SelectValue placeholder="选择用户权限" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">普通用户</SelectItem>
                  <SelectItem value="admin">管理员</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 密码 */}
            <div className="space-y-2">
              <Label htmlFor="edit-password">重置密码</Label>
              <Input
                id="edit-password"
                type="password"
                value={editUserForm.password}
                onChange={(e) => setEditUserForm({ ...editUserForm, password: e.target.value })}
                placeholder="留空则不修改密码"
              />
              <p className="text-xs text-muted-foreground">
                密码以加密方式存储、无法查看，只能在此设置新密码；留空则保持原密码不变。
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseEditUser}>
              取消
            </Button>
            <Button onClick={handleSaveUser} disabled={savingUser}>
              {savingUser ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
