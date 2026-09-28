'use client';

import { useState, useEffect } from 'react';
import { User, Mail, Calendar, Building, Briefcase, Phone, Lock, LogOut, Edit, Save, X, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AiProviderConfig } from '@/components/ai-provider-config';
import { useUser } from '@/contexts/UserContext';
import type { User as UserType } from '@/storage/database/shared/schema';

export default function ProfilePage() {
  const { currentUser, isLoading, refreshUser, logout, setNeedsAuth } = useUser();
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [editForm, setEditForm] = useState({
    currentUsername: '',
    email: '',
    phone: '',
    company: '',
    position: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [saving, setSaving] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // 调试：监听currentUser变化
  useEffect(() => {
    console.log('Profile: currentUser changed:', currentUser?.currentUsername);
  }, [currentUser]);

  // 当用户信息加载完成后，初始化表单
  useEffect(() => {
    if (currentUser) {
      setEditForm({
        currentUsername: currentUser.currentUsername,
        email: currentUser.email || '',
        phone: currentUser.phone || '',
        company: currentUser.company || '',
        position: currentUser.position || '',
      });
    }
  }, [currentUser]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // 使用currentUser.id而不是从localStorage读取
      if (!currentUser) return;

      const response = await fetch('/api/user', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify(editForm),
      });

      if (response.ok) {
        await refreshUser();
        setIsEditing(false);
      }
    } catch (error) {
      console.error('更新用户信息失败:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (currentUser) {
      setEditForm({
        currentUsername: currentUser.currentUsername,
        email: currentUser.email || '',
        phone: currentUser.phone || '',
        company: currentUser.company || '',
        position: currentUser.position || '',
      });
    }
    setIsEditing(false);
  };

  const handlePasswordChange = async () => {
    // 验证密码
    if (!passwordForm.newPassword) {
      setPasswordError('请输入新密码');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordError('新密码长度不能少于6位');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('两次输入的密码不一致');
      return;
    }

    setSaving(true);
    setPasswordError('');

    try {
      const response = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser!.id,
        },
        body: JSON.stringify({
          newPassword: passwordForm.newPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        await refreshUser();
        setPasswordSuccess('密码修改成功');
        setIsChangingPassword(false);
        setPasswordForm({ newPassword: '', confirmPassword: '' });
        setTimeout(() => setPasswordSuccess(''), 3000);
      } else {
        setPasswordError(data.error || '密码修改失败');
      }
    } catch (error) {
      console.error('修改密码失败:', error);
      setPasswordError('密码修改失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelPasswordChange = () => {
    setPasswordForm({ newPassword: '', confirmPassword: '' });
    setPasswordError('');
    setIsChangingPassword(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-t-brand rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">加载用户信息中...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md shadow-soft bg-card">
          <CardContent className="p-8 text-center">
            <User className="w-16 h-16 mx-auto text-brand mb-4" />
            <h3 className="lead-title mb-2">未登录</h3>
            <p className="text-sm text-muted-foreground mb-6">请先登录以查看和管理您的个人信息</p>
            <Button onClick={() => setNeedsAuth(true)} className="w-full">
              立即登录
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* 页面标题 */}
      <div className="page-header">
        <div className="container mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-3 rounded-xl bg-brand shadow-soft">
                <User className="w-5 h-5 sm:w-6 sm:h-6 text-brand-foreground" />
              </div>
              <div>
                <h1 className="page-title">
                  个人中心
                </h1>
                <p className="page-subtitle mt-1">
                  管理您的账户信息和设置
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="flex items-center gap-2 text-muted-foreground hover:text-destructive"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">退出登录</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 主体内容 */}
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6">
        <div className="grid gap-6 max-w-4xl mx-auto">
          {/* 用户信息卡片 */}
          <Card className="shadow-soft bg-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="lead-title flex items-center gap-2">
                  <User className="w-5 h-5 text-brand" />
                  基本信息
                </CardTitle>
                {!isEditing ? (
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                    <Edit className="w-4 h-4 mr-1" />
                    编辑
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={handleCancel}>
                      <X className="w-4 h-4 mr-1" />
                      取消
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={saving}>
                      <Save className="w-4 h-4 mr-1" />
                      {saving ? '保存中...' : '保存'}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <ScrollArea className="max-h-[900px]">
                <div className="space-y-6">
                  {/* 头像和用户名 */}
                  <div className="flex items-start gap-4">
                    <div className="w-20 h-20 rounded-full bg-brand flex items-center justify-center flex-shrink-0">
                      <User className="w-10 h-10 text-brand-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="space-y-2">
                          <Label htmlFor="currentUsername">用户名</Label>
                          <Input
                            id="currentUsername"
                            value={editForm.currentUsername}
                            onChange={(e) => setEditForm({ ...editForm, currentUsername: e.target.value })}
                            placeholder="请输入用户名"
                          />
                        </div>
                      ) : (
                        <h3 className="lead-title truncate">
                          {currentUser.currentUsername}
                        </h3>
                      )}
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="secondary" className="flex items-center gap-1">
                          {currentUser.role === 'admin' ? '管理员' : '普通用户'}
                        </Badge>
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(currentUser.createdAt).toLocaleDateString('zh-CN')}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* 详细信息表单 */}
                  <div className="space-y-4">
                    {/* 密码 */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <Lock className="w-4 h-4" />
                          密码
                        </Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsChangingPassword(true)}
                          className="h-7 text-xs"
                        >
                          <Key className="w-3.5 h-3.5 mr-1" />
                          修改密码
                        </Button>
                      </div>
                      {isChangingPassword ? (
                        <div className="space-y-3 bg-muted rounded-lg p-4">
                          <div className="space-y-2">
                            <Label htmlFor="newPassword" className="text-xs">新密码</Label>
                            <div className="relative">
                              <Input
                                id="newPassword"
                                type={showNewPassword ? 'text' : 'password'}
                                value={passwordForm.newPassword}
                                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                placeholder="请输入新密码（至少6位）"
                                className="text-sm"
                              />
                              <button
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                              >
                                {showNewPassword ? '隐藏' : '显示'}
                              </button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="confirmPassword" className="text-xs">确认新密码</Label>
                            <div className="relative">
                              <Input
                                id="confirmPassword"
                                type={showConfirmPassword ? 'text' : 'password'}
                                value={passwordForm.confirmPassword}
                                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                placeholder="请再次输入新密码"
                                className="text-sm"
                              />
                              <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                              >
                                {showConfirmPassword ? '隐藏' : '显示'}
                              </button>
                            </div>
                          </div>
                          {passwordError && (
                            <p className="text-xs text-destructive">{passwordError}</p>
                          )}
                          {passwordSuccess && (
                            <p className="text-xs text-success">{passwordSuccess}</p>
                          )}
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleCancelPasswordChange}
                              disabled={saving}
                              className="text-xs"
                            >
                              取消
                            </Button>
                            <Button
                              size="sm"
                              onClick={handlePasswordChange}
                              disabled={saving}
                              className="text-xs"
                            >
                              {saving ? '修改中...' : '确认修改'}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-muted rounded-lg px-3 py-2">
                          <p className="text-sm text-muted-foreground">
                            {currentUser?.hasPassword
                              ? '密码已加密存储，服务端无法查看或找回'
                              : '暂未设置'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* 邮箱 */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Mail className="w-4 h-4" />
                        邮箱地址
                      </Label>
                      {isEditing ? (
                        <Input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          placeholder="请输入邮箱地址"
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {currentUser.email || '暂未设置'}
                        </p>
                      )}
                    </div>

                    {/* 电话 */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Phone className="w-4 h-4" />
                        联系电话
                      </Label>
                      {isEditing ? (
                        <Input
                          type="tel"
                          value={editForm.phone}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                          placeholder="请输入联系电话"
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {currentUser.phone || '暂未设置'}
                        </p>
                      )}
                    </div>

                    {/* 公司 */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Building className="w-4 h-4" />
                        所属公司
                      </Label>
                      {isEditing ? (
                        <Input
                          value={editForm.company}
                          onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                          placeholder="请输入所属公司"
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {currentUser.company || '暂未设置'}
                        </p>
                      )}
                    </div>

                    {/* 职位 */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Briefcase className="w-4 h-4" />
                        职位
                      </Label>
                      {isEditing ? (
                        <Input
                          value={editForm.position}
                          onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                          placeholder="请输入职位"
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {currentUser.position || '暂未设置'}
                        </p>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* 账户信息 */}
                  <div className="space-y-3">
                    <h4 className="row-title">
                      账户信息
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">用户ID</div>
                        <div className="text-sm text-foreground font-mono">
                          {currentUser.id}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">注册时间</div>
                        <div className="text-sm text-foreground">
                          {new Date(currentUser.createdAt).toLocaleString('zh-CN')}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <AiProviderConfig
            scope="user"
            title="我的模型 API"
            description="填入你自己的模型 API Key，将优先于管理员配置的全局服务生效；不填则直接使用全局配置。"
          />

          {/* 提示卡片 */}
          <Card className="shadow-soft">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-brand-subtle rounded-lg flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-brand" />
                </div>
                <div>
                  <h4 className="row-title mb-1">
                    完善个人资料
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    完善您的个人资料信息，有助于为您提供更精准的专利服务和建议。这些信息将用于后续的用户记录实录功能。
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
