/**
 * @file src/components/layout/MainLayout.tsx
 * @description
 * 메인 레이아웃 컴포넌트입니다.
 * Header, Sidebar, 컨텐츠 영역을 조합합니다.
 *
 * 초보자 가이드:
 * 1. 모바일: 햄버거 메뉴로 사이드바 토글
 * 2. PC: 사이드바 항상 표시
 * 3. children으로 페이지 컨텐츠 렌더링
 */

'use client';

import { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface MainLayoutProps {
  /** 페이지 컨텐츠 */
  children: React.ReactNode;
  /** 페이지 제목 */
  title?: string;
}

export function MainLayout({ children, title }: MainLayoutProps) {
  // 모바일 사이드바 상태
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* 사이드바 */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* 메인 컨텐츠 영역 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 헤더 */}
        <Header
          title={title}
          onMenuClick={() => setSidebarOpen(true)}
        />

        {/* 페이지 컨텐츠 */}
        <main className="flex-1 overflow-auto p-4">
          {children}
        </main>
      </div>
    </div>
  );
}
