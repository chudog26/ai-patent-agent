'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Loader2,
  Pencil,
  Plug,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useUser } from '@/contexts/UserContext';

type Capability = 'chat' | 'search' | 'image';

interface ProviderPreset {
  key: string;
  label: string;
  capability: Capability;
  baseUrl: string;
  defaultModel?: string;
  models?: string[];
  apiKeyOptional?: boolean;
  note?: string;
}

interface ProviderConfigView {
  id: string;
  name: string;
  capability: Capability;
  provider: string;
  model: string;
  baseUrl: string;
  apiKeyMasked: string;
  hasApiKey: boolean;
  temperature: string;
  maxTokens: number | null;
  description: string;
  scope: 'global' | 'user';
  isActive: boolean;
  isDefault: boolean;
}

interface EffectiveStatus {
  configured: boolean;
  source?: 'user' | 'global' | 'env';
  name?: string;
  model?: string;
  provider?: string;
}

interface TestResult {
  success: boolean;
  message: string;
  sample?: string;
  elapsedMs?: number;
}

interface AiProviderConfigProps {
  /** global = 管理员维护的全局配置；user = 当前用户自带的配置 */
  scope: 'global' | 'user';
  title?: string;
  description?: string;
}

const CAPABILITY_ORDER: Capability[] = ['chat', 'search', 'image'];

const EMPTY_FORM = {
  name: '',
  capability: 'chat' as Capability,
  provider: 'openai',
  model: '',
  baseUrl: '',
  apiKey: '',
  temperature: '0.7',
  maxTokens: '',
  description: '',
  isActive: true,
  isDefault: false,
};

const SOURCE_LABELS: Record<string, string> = {
  user: '我的配置',
  global: '全局配置',
  env: '环境变量',
};

export function AiProviderConfig({
  scope,
  title,
  description,
}: AiProviderConfigProps) {
  const { currentUser } = useUser();
  const [configs, setConfigs] = useState<ProviderConfigView[]>([]);
  const [presets, setPresets] = useState<ProviderPreset[]>([]);
  const [status, setStatus] = useState<Record<string, EffectiveStatus>>({});
  const [capabilityLabels, setCapabilityLabels] = useState<Record<string, string>>({});
  const [activeCapability, setActiveCapability] = useState<Capability>('chat');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProviderConfigView | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const [pendingDelete, setPendingDelete] = useState<ProviderConfigView | null>(null);

  const headers = useMemo(
    () => ({
      'Content-Type': 'application/json',
      ...(currentUser?.id ? { 'x-user-id': currentUser.id } : {}),
    }),
    [currentUser?.id]
  );

  const load = useCallback(async () => {
    if (!currentUser) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/ai-providers?scope=${scope}`, { headers });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '加载配置失败');
      }

      setConfigs(data.configs ?? []);
      setPresets(data.presets ?? []);
      setStatus(data.status ?? {});
      setCapabilityLabels(data.capabilityLabels ?? {});
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载配置失败');
    } finally {
      setLoading(false);
    }
  }, [currentUser, headers, scope]);

  useEffect(() => {
    load();
  }, [load]);

  const presetsForCapability = useMemo(
    () => presets.filter((preset) => preset.capability === form.capability),
    [presets, form.capability]
  );

  const currentPreset = useMemo(
    () => presetsForCapability.find((preset) => preset.key === form.provider),
    [presetsForCapability, form.provider]
  );

  const visibleConfigs = configs.filter(
    (config) => config.capability === activeCapability
  );

  function openCreate() {
    const preset = presets.find((item) => item.capability === activeCapability);
    setEditing(null);
    setTestResult(null);
    setForm({
      ...EMPTY_FORM,
      capability: activeCapability,
      provider: preset?.key ?? 'openai',
      baseUrl: preset?.baseUrl ?? '',
      model: preset?.defaultModel ?? '',
      name: '',
      isDefault: !configs.some((config) => config.capability === activeCapability),
    });
    setDialogOpen(true);
  }

  function openEdit(config: ProviderConfigView) {
    const preset = presets.find(
      (item) => item.capability === config.capability && item.key === config.provider
    );
    setEditing(config);
    setTestResult(null);
    setForm({
      name: config.name,
      capability: config.capability,
      provider: config.provider,
      model: config.model,
      baseUrl: config.baseUrl || preset?.baseUrl || '',
      apiKey: '',
      temperature: config.temperature || '0.7',
      maxTokens: config.maxTokens ? String(config.maxTokens) : '',
      description: config.description || '',
      isActive: config.isActive,
      isDefault: config.isDefault,
    });
    setDialogOpen(true);
  }

  function handleProviderChange(providerKey: string) {
    const preset = presets.find(
      (item) => item.capability === form.capability && item.key === providerKey
    );
    setForm((prev) => ({
      ...prev,
      provider: providerKey,
      baseUrl: preset?.baseUrl ?? prev.baseUrl,
      model: preset?.defaultModel ?? '',
    }));
  }

  function handleCapabilityChange(capability: Capability) {
    const preset = presets.find((item) => item.capability === capability);
    setForm((prev) => ({
      ...prev,
      capability,
      provider: preset?.key ?? 'openai',
      baseUrl: preset?.baseUrl ?? '',
      model: preset?.defaultModel ?? '',
    }));
  }

  async function handleSave() {
    setSaving(true);
    setError('');

    try {
      const payload = {
        name: form.name.trim(),
        capability: form.capability,
        provider: form.provider,
        model: form.model.trim(),
        baseUrl: form.baseUrl.trim(),
        temperature: form.temperature,
        maxTokens: form.maxTokens ? Number(form.maxTokens) : null,
        description: form.description,
        isActive: form.isActive,
        isDefault: form.isDefault,
        scope,
        // 编辑时留空表示保持原密钥
        ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
      };

      const response = await fetch(
        editing ? `/api/ai-providers/${editing.id}` : '/api/ai-providers',
        {
          method: editing ? 'PUT' : 'POST',
          headers,
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '保存失败');
      }

      setDialogOpen(false);
      setNotice(editing ? '配置已更新' : '配置已创建');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);

    try {
      const body: Record<string, unknown> = {
        capability: form.capability,
        provider: form.provider,
        model: form.model.trim(),
        baseUrl: form.baseUrl.trim(),
        temperature: Number(form.temperature) || 0.7,
      };
      if (form.apiKey.trim()) {
        body.apiKey = form.apiKey.trim();
      } else if (editing) {
        body.id = editing.id;
      }

      const response = await fetch('/api/ai-providers/test', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const data: TestResult = await response.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : '测试请求失败',
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;

    try {
      const response = await fetch(`/api/ai-providers/${pendingDelete.id}`, {
        method: 'DELETE',
        headers,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '删除失败');
      setNotice('配置已删除');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setPendingDelete(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="w-5 h-5" />
          {title ??
            (scope === 'global' ? '全局 AI 服务配置' : '我的模型 API')}
        </CardTitle>
        <CardDescription>
          {description ??
            (scope === 'global'
              ? '这里配置的服务商将作为所有用户的默认能力来源。只需选择服务商、粘贴 API Key，即可开箱使用。'
              : '填入你自己的模型 API Key，将优先于全局配置生效。留空则使用全局配置。')}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {notice && (
          <Alert variant="success">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* 当前生效状态 */}
        <div className="grid gap-2 sm:grid-cols-3">
          {CAPABILITY_ORDER.map((capability) => {
            const info = status[capability];
            return (
              <div
                key={capability}
                className="bg-muted rounded-xl p-3.5 text-sm space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {capabilityLabels[capability] ?? capability}
                  </span>
                  {info?.configured ? (
                    <Badge variant="secondary" className="text-xs">
                      {SOURCE_LABELS[info.source ?? ''] ?? info.source}
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs">
                      未配置
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {info?.configured
                    ? `${info.model || info.provider || ''}`
                    : '该能力暂不可用'}
                </div>
              </div>
            );
          })}
        </div>

        <Separator />

        {/* 能力切换 */}
        <div className="flex flex-wrap items-center gap-2">
          {CAPABILITY_ORDER.map((capability) => (
            <Button
              key={capability}
              size="sm"
              variant={activeCapability === capability ? 'default' : 'outline'}
              onClick={() => setActiveCapability(capability)}
            >
              {capabilityLabels[capability] ?? capability}
              <span className="ml-1 text-xs opacity-70">
                {configs.filter((item) => item.capability === capability).length}
              </span>
            </Button>
          ))}

          <Button size="sm" className="ml-auto" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" />
            添加配置
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            加载中...
          </div>
        ) : visibleConfigs.length === 0 ? (
          <div className="bg-muted rounded-xl p-8 text-center text-sm text-muted-foreground">
            该能力还没有配置。点击「添加配置」接入你的模型服务。
          </div>
        ) : (
          <div className="space-y-2">
            {visibleConfigs.map((config) => (
              <div
                key={config.id}
                className="bg-muted rounded-xl p-3.5 flex flex-wrap items-center gap-3"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium truncate">{config.name}</span>
                    {config.isDefault && <Badge>默认</Badge>}
                    {!config.isActive && (
                      <Badge variant="outline">已停用</Badge>
                    )}
                    {config.provider === 'env' && (
                      <Badge variant="secondary">环境变量</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground space-x-3">
                    <span>服务商：{config.provider}</span>
                    {config.model && <span>模型：{config.model}</span>}
                    {config.baseUrl && (
                      <span className="break-all">地址：{config.baseUrl}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <KeyRound className="w-3 h-3" />
                    {config.hasApiKey ? config.apiKeyMasked : '未填写密钥'}
                    {config.capability === 'search' && !config.hasApiKey && (
                      <span>（自建 SearXNG / 本地 Ollama 可留空）</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEdit(config)}
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1" />
                    编辑
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPendingDelete(config)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* 新增 / 编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑配置' : '添加配置'}</DialogTitle>
            <DialogDescription>
              选择一个服务商，填入 API Key 即可。接口地址和模型名会自动带出，通常无需修改。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>能力类型</Label>
                <Select
                  value={form.capability}
                  onValueChange={(value) =>
                    handleCapabilityChange(value as Capability)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CAPABILITY_ORDER.map((capability) => (
                      <SelectItem key={capability} value={capability}>
                        {capabilityLabels[capability] ?? capability}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>服务商</Label>
                <Select value={form.provider} onValueChange={handleProviderChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {presetsForCapability.map((preset) => (
                      <SelectItem key={preset.key} value={preset.key}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {currentPreset?.note && (
              <p className="text-xs text-muted-foreground">{currentPreset.note}</p>
            )}

            <div className="space-y-2">
              <Label htmlFor="provider-name">配置名称 *</Label>
              <Input
                id="provider-name"
                placeholder="例如：公司统一 Key"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="provider-baseurl">接口地址（baseURL）*</Label>
              <Input
                id="provider-baseurl"
                placeholder="https://api.example.com/v1"
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                填写到版本号为止，不要带 /chat/completions。
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="provider-key">API Key</Label>
              <Input
                id="provider-key"
                type="password"
                autoComplete="off"
                placeholder={
                  editing
                    ? `留空表示保持原密钥（${editing.apiKeyMasked || '当前未设置'}）`
                    : currentPreset?.apiKeyOptional
                      ? '该服务商可留空'
                      : '粘贴你的 API Key'
                }
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                密钥会加密后存储，页面与接口只返回脱敏值。
              </p>
            </div>

            {form.capability !== 'search' && (
              <div className="space-y-2">
                <Label htmlFor="provider-model">模型名称 *</Label>
                <Input
                  id="provider-model"
                  list="provider-model-options"
                  placeholder="例如：deepseek-chat"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                />
                <datalist id="provider-model-options">
                  {(currentPreset?.models ?? []).map((model) => (
                    <option key={model} value={model} />
                  ))}
                </datalist>
              </div>
            )}

            {form.capability === 'chat' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="provider-temp">温度</Label>
                  <Input
                    id="provider-temp"
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={form.temperature}
                    onChange={(e) =>
                      setForm({ ...form, temperature: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="provider-maxtokens">最大 Token（可空）</Label>
                  <Input
                    id="provider-maxtokens"
                    type="number"
                    placeholder="不填则由服务商决定"
                    value={form.maxTokens}
                    onChange={(e) =>
                      setForm({ ...form, maxTokens: e.target.value })
                    }
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="provider-desc">备注</Label>
              <Input
                id="provider-desc"
                placeholder="可选"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="bg-muted flex items-center justify-between rounded-xl p-3.5">
              <div className="space-y-0.5">
                <Label>设为该能力的默认配置</Label>
                <p className="text-xs text-muted-foreground">
                  {scope === 'global'
                    ? '所有未自带 Key 的用户都会用它。'
                    : '优先于全局配置生效。'}
                </p>
              </div>
              <Switch
                checked={form.isDefault}
                onCheckedChange={(checked) =>
                  setForm({ ...form, isDefault: checked })
                }
              />
            </div>

            <div className="bg-muted flex items-center justify-between rounded-xl p-3.5">
              <div className="space-y-0.5">
                <Label>启用</Label>
                <p className="text-xs text-muted-foreground">
                  停用后不会参与解析，但配置会保留。
                </p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) =>
                  setForm({ ...form, isActive: checked })
                }
              />
            </div>

            {testResult && (
              <Alert variant={testResult.success ? 'success' : 'destructive'}>
                {testResult.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertTitle>
                  {testResult.success ? '连接成功' : '连接失败'}
                  {testResult.elapsedMs ? `（${testResult.elapsedMs}ms）` : ''}
                </AlertTitle>
                <AlertDescription className="space-y-1">
                  <p className="break-all">{testResult.message}</p>
                  {testResult.sample && (
                    <p className="text-xs opacity-80 break-all">
                      返回示例：{testResult.sample}
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" onClick={handleTest} disabled={testing}>
              {testing ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Plug className="w-4 h-4 mr-1" />
              )}
              测试连接
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !form.name.trim() || !form.baseUrl.trim()}
              >
                {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                保存
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除该配置？</AlertDialogTitle>
            <AlertDialogDescription>
              将删除「{pendingDelete?.name}」。删除后若该能力没有其他可用配置，
              相关功能会不可用。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
