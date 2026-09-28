'use client';

import { useUser } from '@/contexts/UserContext';
import { AuthDialog } from '@/components/auth-dialog';
import { SetupDialog } from '@/components/setup-dialog';

export function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { needsAuth, setNeedsAuth, needsSetup } = useUser();

  return (
    <>
      {children}
      {/* 首次部署优先引导初始化，完成前不弹登录框 */}
      {needsSetup ? (
        <SetupDialog />
      ) : (
        <AuthDialog open={needsAuth} onOpenChange={setNeedsAuth} />
      )}
    </>
  );
}
