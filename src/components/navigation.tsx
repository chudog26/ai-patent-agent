'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileText,
  Lightbulb,
  FileCheck,
  Calculator,
  History,
  User,
  MessageSquare,
  Settings,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { useUser } from '@/contexts/UserContext';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: '专利生成', icon: FileText },
  { href: '/inspiration', label: '灵感', icon: Lightbulb },
  { href: '/review', label: '专利审查', icon: FileCheck },
  { href: '/fee-calculator', label: '费用计算', icon: Calculator },
  { href: '/history', label: '历史记录', icon: History },
  { href: '/profile', label: '个人中心', icon: User },
] as const;

/** 外部链接（飞书寄语墙） */
const EXTERNAL_LINK = {
  href: 'https://xi6ihdbltx.feishu.cn/wiki/IoaxwF3tRi3BOskgneLc7k3LnVg?from=from_copylink',
  label: '寄语',
  icon: MessageSquare,
};

const ITEM_BASE =
  'inline-flex h-8 shrink-0 items-center gap-2 rounded-lg px-2.5 text-sm font-medium transition-colors sm:h-9 sm:px-3';
const ITEM_IDLE = 'text-muted-foreground hover:bg-accent hover:text-foreground';
const ITEM_ACTIVE = 'bg-brand-subtle text-brand-subtle-foreground';

export function Navigation() {
  const pathname = usePathname();
  const { currentUser } = useUser();

  const items = currentUser?.role === 'admin'
    ? [...NAV_ITEMS, { href: '/admin', label: '管理后台', icon: Settings } as const]
    : NAV_ITEMS;

  return (
    <header className="sticky top-0 z-50 bg-card border-b border-border">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="flex h-14 items-center gap-3">
          {/* 品牌位：单色方块 + 纯文字，不做渐变字 */}
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <span className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-md">
              <FileText className="size-4" />
            </span>
            <span className="hidden text-sm font-semibold tracking-tight sm:block">
              AI 专利说明书生成器
            </span>
          </Link>

          <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto sm:justify-end sm:gap-1">
            {items.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(ITEM_BASE, isActive ? ITEM_ACTIVE : ITEM_IDLE)}
                >
                  <Icon className="size-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}

            <a
              href={EXTERNAL_LINK.href}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(ITEM_BASE, ITEM_IDLE)}
            >
              <MessageSquare className="size-4" />
              <span className="hidden sm:inline">{EXTERNAL_LINK.label}</span>
            </a>
          </nav>

          <div className="shrink-0">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
