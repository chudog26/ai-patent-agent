'use client';

import { useState } from 'react';
import { Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MobilePromptProps {
  isMobile: boolean;
}

const REASONS = [
  '更大的屏幕，更好的视觉体验',
  '完整显示专利内容，无需频繁滚动',
  '更快的输入和编辑体验',
  '支持键盘快捷键，提升工作效率',
];

export function MobilePrompt({ isMobile }: MobilePromptProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!isMobile || dismissed) return null;

  return (
    <div className="bg-background fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-md rounded-2xl p-7 text-center shadow-pop">
        <div className="bg-muted relative mx-auto mb-6 flex size-20 items-center justify-center rounded-full">
          <Monitor className="text-foreground size-9" />
          <div className="bg-card absolute -right-1 -bottom-1 flex size-9 items-center justify-center rounded-full">
            <Smartphone className="text-muted-foreground size-4.5" />
          </div>
        </div>

        <h1 className="page-title mb-2">
          建议使用电脑访问
        </h1>

        <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
          为获得最佳体验，请在电脑（PC）上访问本应用。
          <br />
          移动端可能无法完整显示所有功能。
        </p>

        <ul className="bg-muted mb-6 space-y-2 rounded-xl p-4 text-left text-sm">
          {REASONS.map((reason) => (
            <li key={reason} className="text-muted-foreground flex items-start gap-2">
              <span className="bg-brand mt-1.5 size-1.5 shrink-0 rounded-full" />
              <span>{reason}</span>
            </li>
          ))}
        </ul>

        <Button className="w-full" onClick={() => setDismissed(true)}>
          继续使用移动端访问
        </Button>

        <p className="text-muted-foreground mt-3 text-xs">
          部分功能可能无法正常使用
        </p>
      </div>
    </div>
  );
}
