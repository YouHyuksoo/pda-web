/**
 * @file src/app/(main)/layout.tsx
 * @description
 * 메인 영역 레이아웃입니다.
 * 사이드바와 헤더가 포함된 레이아웃으로, 로그인 후 모든 페이지에서 사용됩니다.
 *
 * 초보자 가이드:
 * 1. MainLayout 컴포넌트로 Header + Sidebar + 컨텐츠 영역 구성
 * 2. 인증되지 않은 사용자는 로그인 페이지로 리다이렉트
 * 3. 세션 만료 시 자동 로그아웃 및 경고 표시
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout';
import { useAuthStore } from '@/stores/auth-store';
import { useSession, formatRemainingTime } from '@/hooks/use-session';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function MainAreaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, checkSession } = useAuthStore();
  const { isWarning, remainingTime, refreshSession } = useSession();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // 인증 상태 및 세션 만료 확인
    if (!isAuthenticated()) {
      // 로그인 페이지로 리다이렉트
      router.replace('/login');
      return;
    }

    // 세션 만료 체크
    const isSessionValid = checkSession();
    if (!isSessionValid) {
      alert('세션이 만료되었습니다. 다시 로그인해주세요.');
      router.replace('/login');
      return;
    }

    setIsChecking(false);
  }, [isAuthenticated, checkSession, router]);

  // 인증 확인 중 로딩 표시
  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-gray-500">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 세션 만료 임박 경고 배너 */}
      {isWarning && (
        <div className="fixed left-0 right-0 top-0 z-[100] flex items-center justify-center gap-4 bg-orange-500 px-4 py-2 text-white shadow-lg">
          <AlertTriangle className="h-5 w-5" />
          <span className="text-sm font-medium">
            세션이 {formatRemainingTime(remainingTime)} 후 만료됩니다.
          </span>
          <Button
            size="sm"
            variant="secondary"
            onClick={refreshSession}
            className="h-7 bg-white text-orange-600 hover:bg-orange-50"
          >
            세션 연장
          </Button>
        </div>
      )}

      {/* 경고 배너가 있을 때 여백 추가 */}
      <div className={isWarning ? 'pt-10' : ''}>
        <MainLayout>{children}</MainLayout>
      </div>
    </>
  );
}
