import type { Metadata } from 'next';
import './globals.css';
import { Navigation } from '@/components/navigation';
import { ThemeProvider } from '@/components/theme-provider';
import { UserProvider } from '@/contexts/UserContext';
import { AuthWrapper } from '@/components/auth-wrapper';
import { RootLayoutClient } from '@/components/root-layout-client';

export const metadata: Metadata = {
  title: {
    default: 'AI 专利编写平台',
    template: '%s | AI 专利编写平台',
  },
  description:
    '基于大模型的专利说明书生成与审查平台，支持接入自有的模型 API，一键生成摘要、说明书、附图与权利要求书。',
  keywords: [
    'AI 专利',
    '专利说明书生成',
    '专利审查',
    '权利要求书',
    '专利代理',
    '大模型应用',
  ],
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={`antialiased`}
      >
        <UserProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <RootLayoutClient>
              <Navigation />
              <AuthWrapper>{children}</AuthWrapper>
            </RootLayoutClient>
          </ThemeProvider>
        </UserProvider>
      </body>
    </html>
  );
}
