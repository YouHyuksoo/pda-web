/**
 * @file src/app/(main)/dashboard/page.tsx
 * @description
 * 대시보드 (메인메뉴) 페이지입니다. (HS020 대체)
 * 주요 메뉴로 빠르게 이동할 수 있는 바로가기 카드를 표시합니다.
 *
 * 초보자 가이드:
 * 1. 자주 사용하는 메뉴를 카드 형태로 표시
 * 2. 클릭 시 해당 기능 페이지로 이동
 * 3. 사용자 정보 표시
 */

'use client';

import { useRouter } from 'next/navigation';
import {
  Package,
  Factory,
  Truck,
  ClipboardList,
  BarChart3,
  Settings,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth-store';

// 바로가기 메뉴 정의
const quickMenus = [
  {
    title: '생산투입',
    description: '자재를 생산라인에 투입',
    icon: Factory,
    path: '/production/input',
    color: 'bg-blue-500',
  },
  {
    title: '실적등록',
    description: '생산 실적 등록',
    icon: ClipboardList,
    path: '/production/result',
    color: 'bg-green-500',
  },
  {
    title: '자재불출',
    description: '창고간 자재 이동',
    icon: Package,
    path: '/material/issue',
    color: 'bg-orange-500',
  },
  {
    title: '출하처리',
    description: 'BOX 단위 출하',
    icon: Truck,
    path: '/shipment/process',
    color: 'bg-purple-500',
  },
  {
    title: '재고현황',
    description: '대차 재고 조회',
    icon: BarChart3,
    path: '/production/cart-stock',
    color: 'bg-cyan-500',
  },
  {
    title: '재고실사',
    description: '물리 재고 확인',
    icon: Settings,
    path: '/material/stocktaking',
    color: 'bg-gray-500',
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const { userName, saupj } = useAuthStore();

  // 사업장명 변환
  const getSaupjName = (code: string) => {
    const names: Record<string, string> = {
      '10': '행성',
      '20': '인도네시아',
    };
    return names[code] || code;
  };

  return (
    <div className="space-y-6">
      {/* 환영 메시지 */}
      <div className="rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
        <h1 className="text-2xl font-bold">
          안녕하세요, {userName || '사용자'}님!
        </h1>
        <p className="mt-1 text-blue-100">
          {getSaupjName(saupj)} 사업장에 오신 것을 환영합니다.
        </p>
      </div>

      {/* 바로가기 메뉴 */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-800">바로가기</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {quickMenus.map((menu) => (
            <Card
              key={menu.path}
              className="cursor-pointer transition-all hover:scale-105 hover:shadow-lg"
              onClick={() => router.push(menu.path)}
            >
              <CardHeader className="pb-2">
                <div
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${menu.color}`}
                >
                  <menu.icon className="h-5 w-5 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className="text-sm">{menu.title}</CardTitle>
                <p className="mt-1 text-xs text-gray-500">{menu.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 최근 작업 (추후 구현) */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-800">최근 작업</h2>
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            최근 작업 내역이 없습니다.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
