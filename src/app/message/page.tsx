'use client';

import { useEffect } from 'react';
import { MessageSquare, ExternalLink, Loader2 } from 'lucide-react';

const FEISHU_URL = 'https://xi6ihdbltx.feishu.cn/wiki/IoaxwF3tRi3BOskgneLc7k3LnVg?from=from_copylink';

export default function MessagePage() {
  useEffect(() => {
    // 自动跳转到飞书文档
    const timer = setTimeout(() => {
      window.location.href = FEISHU_URL;
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="p-4 rounded-2xl bg-brand shadow-soft w-20 h-20 mx-auto mb-6 flex items-center justify-center animate-bounce">
          <MessageSquare className="w-10 h-10 text-brand-foreground" />
        </div>
        <h1 className="page-title mb-3">
          寄语
        </h1>
        <p className="text-muted-foreground mb-6">正在跳转到寄语页面...</p>
        <div className="flex items-center justify-center gap-2 text-brand">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">跳转中</span>
        </div>
        <div className="mt-8">
          <a
            href={FEISHU_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-brand hover:text-brand text-sm font-medium"
          >
            <span>如果自动跳转失败，请点击这里</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
