'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
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
import { useUser } from '@/contexts/UserContext';

/**
 * 首次部署引导。
 *
 * 新版不再像旧版那样硬编码创建 admin/admin（任何人都能猜到），
 * 而是由部署者在本页面自行设定第一个管理员账号与密码。
 * 一旦管理员存在，后端 /api/setup 就会拒绝再次调用。
 */
export function SetupDialog() {
  const { needsSetup, refreshSetupStatus, refreshUser } = useUser();

  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    setError('');

    if (form.username.trim().length < 3) {
      setError('管理员账号至少 3 个字符');
      return;
    }
    if (form.password.length < 8) {
      setError('密码至少 8 位，建议包含字母与数字');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.username.trim(),
          email: form.email.trim() || undefined,
          password: form.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '初始化失败');
      }

      // 初始化即登录：写入本地缓存并刷新用户态
      localStorage.setItem(
        'patent_generator_user',
        JSON.stringify({
          id: data.user.id,
          username: data.user.username,
          currentUsername: data.user.username,
          role: data.user.role,
        })
      );

      setDone(true);
      await refreshSetupStatus();
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : '初始化失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={needsSetup} onOpenChange={() => undefined}>
      <DialogContent
        className="sm:max-w-[440px]"
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
        showCloseButton={false}
      >
        <DialogHeader>
          <div className="bg-brand-subtle text-brand-subtle-foreground mb-1 flex size-10 items-center justify-center rounded-lg">
            <ShieldCheck className="size-5" />
          </div>
          <DialogTitle className="lead-title tracking-tight">
            {done ? '初始化完成' : '初始化你的部署'}
          </DialogTitle>
          <DialogDescription>
            {done
              ? '管理员账号已创建，正在进入系统…'
              : '这是第一次启动，请设定管理员账号。该账号用于管理全局 AI 服务配置与用户。'}
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <Alert variant="success">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              设置完成。你可以随时在「管理后台 → AI 服务配置」里填入模型 API Key。
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="setup-username">管理员账号 *</Label>
              <Input
                id="setup-username"
                autoComplete="username"
                placeholder="例如：admin"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="setup-email">邮箱（可选）</Label>
              <Input
                id="setup-email"
                type="email"
                autoComplete="email"
                placeholder="用于后续找回密码"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="setup-password">密码 *</Label>
              <Input
                id="setup-password"
                type="password"
                autoComplete="new-password"
                placeholder="至少 8 位"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="setup-password-confirm">确认密码 *</Label>
              <Input
                id="setup-password-confirm"
                type="password"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(e) =>
                  setForm({ ...form, confirmPassword: e.target.value })
                }
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              创建管理员并进入
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              该接口仅在系统中不存在管理员时可用，初始化后会自动失效。
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
