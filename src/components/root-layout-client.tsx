'use client';

import { useIsMobile } from '@/hooks/use-mobile';
import { MobilePrompt } from '@/components/mobile-prompt';

interface RootLayoutClientProps {
  children: React.ReactNode;
}

export function RootLayoutClient({ children }: RootLayoutClientProps) {
  const isMobile = useIsMobile();

  return (
    <>
      {children}
      <MobilePrompt isMobile={isMobile} />
    </>
  );
}
