/**
 * @file src/components/layout/Sidebar.tsx
 * @description
 * 사이드바 네비게이션 컴포넌트입니다.
 * 메뉴 목록을 표시하고 페이지 이동을 처리합니다.
 *
 * 초보자 가이드:
 * 1. MENU_ITEMS 상수에서 메뉴 구조를 가져옴
 * 2. 아코디언 형태로 하위 메뉴 펼침/접기
 * 3. 현재 경로에 해당하는 메뉴 하이라이트
 */

'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Package,
  Factory,
  Calendar,
  CheckCircle,
  Truck,
  RotateCcw,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Home,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MENU_ITEMS, MenuItem } from '@/lib/constants/menu';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SidebarProps {
  /** 사이드바 열림 상태 (모바일) */
  isOpen?: boolean;
  /** 사이드바 닫기 함수 (모바일) */
  onClose?: () => void;
}

// 아이콘 매핑
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Package,
  Factory,
  Calendar,
  CheckCircle,
  Truck,
  RotateCcw,
  RefreshCw,
};

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  // 펼쳐진 메뉴 상태 관리
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

  // 메뉴 펼침/접기 토글
  const toggleMenu = (formId: string) => {
    setExpandedMenus((prev) =>
      prev.includes(formId)
        ? prev.filter((id) => id !== formId)
        : [...prev, formId]
    );
  };

  // 메뉴 클릭 처리
  const handleMenuClick = (item: MenuItem) => {
    if (item.children && item.children.length > 0) {
      toggleMenu(item.formId);
    } else {
      router.push(item.path);
      onClose?.();
    }
  };

  // 현재 경로가 메뉴에 해당하는지 확인
  const isActive = (path: string) => pathname === path;
  const isParentActive = (item: MenuItem) =>
    item.children?.some((child) => pathname === child.path);

  return (
    <>
      {/* 모바일 오버레이 */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      {/* 사이드바 */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-full w-64 transform border-r bg-white transition-transform duration-200 ease-in-out md:relative md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* 로고/타이틀 영역 */}
        <div className="flex h-14 items-center border-b px-4">
          <h2 className="text-lg font-bold text-blue-600">HSGMES PDA</h2>
        </div>

        {/* 메뉴 영역 */}
        <ScrollArea className="h-[calc(100vh-3.5rem)]">
          <nav className="p-2">
            {/* 대시보드 (홈) */}
            <Button
              variant={isActive('/dashboard') ? 'secondary' : 'ghost'}
              className="mb-1 w-full justify-start"
              onClick={() => {
                router.push('/dashboard');
                onClose?.();
              }}
            >
              <Home className="mr-2 h-4 w-4" />
              대시보드
            </Button>

            {/* 메뉴 목록 */}
            {MENU_ITEMS.map((menu) => {
              const Icon = menu.icon ? iconMap[menu.icon] : Package;
              const isExpanded = expandedMenus.includes(menu.formId);
              const hasActiveChild = isParentActive(menu);

              return (
                <div key={menu.formId} className="mb-1">
                  {/* 상위 메뉴 */}
                  <Button
                    variant={hasActiveChild ? 'secondary' : 'ghost'}
                    className="w-full justify-between"
                    onClick={() => handleMenuClick(menu)}
                  >
                    <span className="flex items-center">
                      <Icon className="mr-2 h-4 w-4" />
                      {menu.name}
                    </span>
                    {menu.children && menu.children.length > 0 && (
                      isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )
                    )}
                  </Button>

                  {/* 하위 메뉴 */}
                  {menu.children && isExpanded && (
                    <div className="ml-4 mt-1 space-y-1">
                      {menu.children.map((child) => (
                        <Button
                          key={child.formId}
                          variant={isActive(child.path) ? 'secondary' : 'ghost'}
                          size="sm"
                          className="w-full justify-start pl-6 text-sm"
                          onClick={() => handleMenuClick(child)}
                        >
                          {child.name}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </ScrollArea>
      </aside>
    </>
  );
}
