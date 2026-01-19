/**
 * @file src/app/(main)/plan/next-start-end/page.tsx
 * @description
 * 차기시작/종료 페이지입니다. (HP200 대체)
 * 차기 작업 목록을 조회하고 준비완료/시작 처리합니다.
 *
 * 초보자 가이드:
 * 1. **공정/라인 선택**: 작업할 공정과 라인 선택
 * 2. **기간 설정**: 조회할 기간 설정
 * 3. **조회**: 차기 작업 목록 조회
 * 4. **준비완료**: 예정된 작업을 준비완료 처리
 * 5. **시작**: 준비완료된 작업 시작
 */

'use client';

import { useState, useEffect } from 'react';
import { format, addDays } from 'date-fns';
import { Search, Play, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ProcessSelect, LineSelect } from '@/components/forms/ProcessLineSelect';
import { useAuthStore } from '@/stores/auth-store';
import { formatNumber } from '@/lib/utils/string';
import {
  showSuccess,
  showError,
  showWarning,
  showInfo,
  handleApiError,
} from '@/lib/utils/toast';

/** API 응답 인터페이스 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

/** 차기 작업 계획 타입 */
interface NextWorkPlan {
  orderNo: string;
  itemCode: string;
  itemName: string;
  planQty: number;
  planDate: string;
  status: 'scheduled' | 'ready' | 'started';
  startTime: string | null;
}

export default function NextStartEndPage() {
  const { opcode, linecode, userId, setForm } = useAuthStore();
  const [processCode, setProcessCode] = useState(opcode || '');
  const [lineCode, setLineCode] = useState(linecode || '');
  const [fromDate, setFromDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
  const [planList, setPlanList] = useState<NextWorkPlan[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setForm('HP200', '차기시작/종료');
  }, [setForm]);

  // 차기 작업 조회
  const handleSearch = async () => {
    if (!processCode || !lineCode) {
      showWarning('공정/라인을 선택하세요.');
      return;
    }

    setIsLoading(true);

    try {
      const params = new URLSearchParams({
        processCode,
        lineCode,
        fromDate: fromDate.replace(/-/g, ''),
        toDate: toDate.replace(/-/g, ''),
      });
      const response = await fetch(`/api/plan/next-work?${params}`);
      const result: ApiResponse<NextWorkPlan[]> = await response.json();

      if (result.success && result.data) {
        setPlanList(result.data);
        if (result.data.length === 0) {
          showInfo('조회 결과가 없습니다.');
        }
      } else {
        showError(result.error || '조회 실패');
        setPlanList([]);
      }
    } catch (err) {
      console.error('차기작업 조회 오류:', err);
      handleApiError(err, '차기작업 조회 중 오류가 발생했습니다.');
      setPlanList([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 준비완료 처리
  const handlePrepare = async (orderNo: string) => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/plan/next-work', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNo,
          action: 'ready',
          userId: userId || 'SYSTEM',
        }),
      });

      const result: ApiResponse<{ orderNo: string }> = await response.json();

      if (result.success) {
        showSuccess(result.message || '준비완료 처리되었습니다.');
        setPlanList((prev) =>
          prev.map((plan) =>
            plan.orderNo === orderNo ? { ...plan, status: 'ready' } : plan
          )
        );
      } else {
        showError(result.error || '준비완료 처리 실패');
      }
    } catch (err) {
      console.error('준비완료 처리 오류:', err);
      handleApiError(err, '준비완료 처리 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 작업 시작
  const handleStart = async (orderNo: string) => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/plan/next-work', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNo,
          action: 'start',
          userId: userId || 'SYSTEM',
        }),
      });

      const result: ApiResponse<{ orderNo: string }> = await response.json();

      if (result.success) {
        showSuccess(result.message || '차기 작업이 시작되었습니다.');
        setPlanList((prev) =>
          prev.map((plan) =>
            plan.orderNo === orderNo
              ? { ...plan, status: 'started', startTime: format(new Date(), 'HH:mm') }
              : plan
          )
        );
      } else {
        showError(result.error || '작업 시작 실패');
      }
    } catch (err) {
      console.error('작업 시작 오류:', err);
      handleApiError(err, '작업 시작 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 상태별 배지
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge variant="secondary">예정</Badge>;
      case 'ready':
        return (
          <Badge variant="default" className="bg-blue-500">
            준비완료
          </Badge>
        );
      case 'started':
        return (
          <Badge variant="default" className="bg-green-500">
            시작
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* 조회 조건 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <CalendarClock className="mr-2 h-5 w-5" />
            조회 조건
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <ProcessSelect value={processCode} onChange={setProcessCode} label="공정" />
            <LineSelect value={lineCode} onChange={setLineCode} label="라인" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>시작일</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>종료일</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={handleSearch} disabled={isLoading} className="w-full">
            <Search className="mr-2 h-4 w-4" />
            조회
          </Button>
        </CardContent>
      </Card>

      {/* 차기 작업 목록 */}
      {planList.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">차기 작업 목록</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {planList.map((plan) => (
                <div
                  key={plan.orderNo}
                  className={`rounded-lg border p-4 ${
                    plan.status === 'started'
                      ? 'border-green-500 bg-green-50'
                      : plan.status === 'ready'
                      ? 'border-blue-500 bg-blue-50'
                      : ''
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <div className="text-xs text-gray-500">{plan.planDate}</div>
                      <div className="font-mono text-sm">{plan.orderNo}</div>
                      <div className="font-medium">{plan.itemCode}</div>
                      <div className="text-xs text-gray-500">{plan.itemName}</div>
                    </div>
                    {getStatusBadge(plan.status)}
                  </div>
                  <div className="mb-3 text-sm text-gray-600">
                    계획수량: {formatNumber(plan.planQty)}
                  </div>
                  <div className="flex gap-2">
                    {plan.status === 'scheduled' && (
                      <Button
                        onClick={() => handlePrepare(plan.orderNo)}
                        variant="outline"
                        className="flex-1"
                        size="sm"
                        disabled={isLoading}
                      >
                        준비완료
                      </Button>
                    )}
                    {plan.status === 'ready' && (
                      <Button
                        onClick={() => handleStart(plan.orderNo)}
                        className="flex-1"
                        size="sm"
                        disabled={isLoading}
                      >
                        <Play className="mr-1 h-4 w-4" />
                        시작
                      </Button>
                    )}
                    {plan.status === 'started' && (
                      <div className="flex-1 text-center text-sm text-green-600">
                        시작시간: {plan.startTime}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
