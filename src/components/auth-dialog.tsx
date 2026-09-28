'use client';

import { useState } from 'react';
import { User, Lock, UserPlus, LogIn, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser } from '@/contexts/UserContext';

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const { refreshUser } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 登录表单
  const [loginForm, setLoginForm] = useState({
    username: '',
    password: '',
  });

  // 注册表单（自注册模式，不需要输入）
  const [registeredUser, setRegisteredUser] = useState<{
    username: string;
    password: string;
  } | null>(null);

  // 处理弹窗关闭，清理状态
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSuccess('');
      setRegisteredUser(null);
      setError('');
    }
    onOpenChange(open);
  };

  const handleLogin = async () => {
    if (!loginForm.username || !loginForm.password) {
      setError('请输入用户名和密码');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });

      const data = await response.json();

      if (response.ok) {
        // 将用户信息保存到缓存中
        localStorage.setItem('patent_generator_user', JSON.stringify(data.user));
        await refreshUser();
        setSuccess('登录成功');
        setTimeout(() => {
          onOpenChange(false);
          setSuccess('');
        }, 1000);
      } else {
        setError(data.error || '登录失败，请检查用户名和密码');
      }
    } catch {
      setError('登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (response.ok) {
        // 构建完整的用户信息对象
        // 注意：不回写密码。服务端只保存散列，这里拿到的是「一次性明文」，
        // 仅用于下方结果面板展示一次，不应落进 localStorage。
        const userWithFields = {
          id: data.id,
          username: data.username,
          currentUsername: data.username,
          hasPassword: true,
          email: null,
          phone: null,
          company: null,
          position: null,
          role: 'user',
          createdAt: new Date().toISOString(),
        };
        // 保存到缓存
        localStorage.setItem('patent_generator_user', JSON.stringify(userWithFields));
        setRegisteredUser({
          username: data.username,
          password: data.password,
        });
        await refreshUser();
        setSuccess('注册成功');
      } else {
        setError(data.error || '注册失败，请稍后重试');
      }
    } catch {
      setError('注册失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="lead-title tracking-tight">欢迎使用</DialogTitle>
          <DialogDescription>登录或注册以使用专利生成系统</DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center justify-center gap-4 py-6">
            <div className="bg-success-subtle flex size-14 items-center justify-center rounded-full">
              <Check className="text-success size-7" />
            </div>
            <div className="space-y-3 text-center">
              <h3 className="section-title">{success}</h3>
              {registeredUser && (
                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground">您的账号信息</p>
                  <div className="bg-muted space-y-1.5 rounded-lg p-3 text-left">
                    <p className="flex items-center gap-2">
                      <User className="text-muted-foreground size-4" />
                      <span>用户名：{registeredUser.username}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Lock className="text-muted-foreground size-4" />
                      <span>密码：{registeredUser.password}</span>
                    </p>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    请妥善保存您的账号信息
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <Tabs defaultValue="register" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">
                <LogIn className="size-4" />
                登录
              </TabsTrigger>
              <TabsTrigger value="register">
                <UserPlus className="size-4" />
                自注册
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-username">用户名</Label>
                <div className="relative">
                  <User className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                  <Input
                    id="login-username"
                    placeholder="请输入用户名"
                    className="pl-9"
                    value={loginForm.username}
                    onChange={(e) =>
                      setLoginForm({ ...loginForm, username: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">密码</Label>
                <div className="relative">
                  <Lock className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="请输入密码"
                    className="pl-9"
                    value={loginForm.password}
                    onChange={(e) =>
                      setLoginForm({ ...loginForm, password: e.target.value })
                    }
                  />
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button onClick={handleLogin} disabled={loading} className="w-full">
                {loading ? '登录中…' : '登录'}
              </Button>
            </TabsContent>

            <TabsContent value="register" className="mt-5 space-y-4">
              <div className="space-y-1.5 py-2 text-center">
                <div className="bg-muted mx-auto mb-4 flex size-12 items-center justify-center rounded-full">
                  <UserPlus className="text-foreground size-5" />
                </div>
                <h3 className="text-base font-semibold">快速自注册</h3>
                <p className="text-muted-foreground text-sm">
                  系统将自动为您创建账号，包括中文用户名和随机密码
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleRegister}
                disabled={loading}
                className="w-full"
              >
                {loading ? '注册中…' : '立即注册'}
              </Button>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
