/**
 * @file src/components/layout/Header.tsx
 * @description
 * 상단 헤더 컴포넌트입니다.
 * 사용자 정보, 현재 화면명, 로그아웃 버튼을 표시합니다.
 *
 * 초보자 가이드:
 * 1. 모바일에서는 햄버거 메뉴 버튼 표시
 * 2. PC에서는 사용자 정보와 로그아웃 버튼 표시
 */

'use client';

import { Menu, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';

interface HeaderProps {
  /** 사이드바 토글 함수 */
  onMenuClick?: () => void;
  /** 현재 화면 제목 */
  title?: string;
}

export function Header({ onMenuClick, title }: HeaderProps) {
  const { userName, formName, logout } = useAuthStore();

  // 로그아웃 처리
  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white">
      <div className="flex h-14 items-center px-4">
        {/* 모바일 메뉴 버튼 */}
        <Button
          variant="ghost"
          size="icon"
          className="mr-2 md:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">메뉴 열기</span>
        </Button>

        {/* 화면 제목 */}
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-gray-900">
            {title || formName || 'HSGMES PDA'}
          </h1>
        </div>

        {/* 사용자 정보 및 로그아웃 */}
        <div className="flex items-center gap-2">
          {userName && (
            <div className="hidden items-center gap-2 sm:flex">
              <User className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">{userName}</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            title="로그아웃"
          >
            <LogOut className="h-5 w-5 text-gray-500" />
            <span className="sr-only">로그아웃</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
