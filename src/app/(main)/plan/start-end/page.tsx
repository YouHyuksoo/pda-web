/**
 * @file src/app/(main)/plan/start-end/page.tsx
 * @description
 * 시작/종료 페이지입니다. (HP120 대체)
 * 작업의 시작과 종료를 관리합니다.
 *
 * 초보자 가이드:
 * 1. **공정/라인 선택**: 작업할 공정과 라인 선택
 * 2. **조회**: 작업 계획 조회
 * 3. **시작**: 대기 중인 작업 시작
 * 4. **종료**: 진행 중인 작업 종료
 */

'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Search, Play, Square, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ProcessSelect, LineSelect } from '@/components/forms/ProcessLineSelect';
import { useAuthStore } from '@/stores/auth-store';
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

/** 작업 계획 타입 */
interface WorkPlan {
  orderNo: string;
  itemCode: string;
  itemName: string;
  planQty: number;
  status: 'ready' | 'working' | 'completed';
  startTime: string | null;
  endTime: string | null;
}

export default function StartEndPage() {
  const { opcode, linecode, userId, setForm } = useAuthStore();
  const [processCode, setProcessCode] = useState(opcode || '');
  const [lineCode, setLineCode] = useState(linecode || '');
  const [workDate, setWorkDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [planList, setPlanList] = useState<WorkPlan[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setForm('HP120', '시작/종료');
  }, [setForm]);

  // 작업 계획 조회
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
        workDate,
      });
      const response = await fetch(`/api/plan/work?${params}`);
      const result: ApiResponse<WorkPlan[]> = await response.json();

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
      console.error('작업 계획 조회 오류:', err);
      handleApiError(err, '작업 계획 조회 중 오류가 발생했습니다.');
      setPlanList([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 작업 시작
  const handleStart = async (orderNo: string) => {
    const working = planList.find((p) => p.status === 'working');
    if (working) {
      showWarning('진행중인 작업을 먼저 종료하세요.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/plan/work', {
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
        showSuccess(result.message || '작업이 시작되었습니다.');
        setPlanList((prev) =>
          prev.map((plan) =>
            plan.orderNo === orderNo
              ? { ...plan, status: 'working', startTime: format(new Date(), 'HH:mm') }
              : plan
          )
        );
      } else {
        showError(result.error || '시작 실패');
      }
    } catch (err) {
      console.error('작업 시작 오류:', err);
      handleApiError(err, '작업 시작 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 작업 종료
  const handleEnd = async (orderNo: string) => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/plan/work', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNo,
          action: 'end',
          userId: userId || 'SYSTEM',
        }),
      });

      const result: ApiResponse<{ orderNo: string }> = await response.json();

      if (result.success) {
        showSuccess(result.message || '작업이 종료되었습니다.');
        setPlanList((prev) =>
          prev.map((plan) =>
            plan.orderNo === orderNo
              ? { ...plan, status: 'completed', endTime: format(new Date(), 'HH:mm') }
              : plan
          )
        );
      } else {
        showError(result.error || '종료 실패');
      }
    } catch (err) {
      console.error('작업 종료 오류:', err);
      handleApiError(err, '작업 종료 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 상태별 배지
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready':
        return <Badge variant="secondary">대기</Badge>;
      case 'working':
        return (
          <Badge variant="default" className="bg-green-500">
            진행중
          </Badge>
        );
      case 'completed':
        return <Badge variant="outline">완료</Badge>;
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
            <Clock className="mr-2 h-5 w-5" />
            조회 조건
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <ProcessSelect
              value={processCode}
              onChange={setProcessCode}
              label="공정"
            />
            <LineSelect value={lineCode} onChange={setLineCode} label="라인" />
          </div>
          <div className="space-y-2">
            <Label>작업일자</Label>
            <Input
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
            />
          </div>
          <Button onClick={handleSearch} disabled={isLoading} className="w-full">
            <Search className="mr-2 h-4 w-4" />
            조회
          </Button>
        </CardContent>
      </Card>

      {/* 작업 목록 */}
      {planList.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">작업 목록</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {planList.map((plan) => (
                <div
                  key={plan.orderNo}
                  className={`rounded-lg border p-4 ${
                    plan.status === 'working' ? 'border-green-500 bg-green-50' : ''
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-mono text-sm">{plan.orderNo}</div>
                      <div className="font-medium">{plan.itemCode}</div>
                      <div className="text-xs text-gray-500">{plan.itemName}</div>
                    </div>
                    {getStatusBadge(plan.status)}
                  </div>
                  <div className="flex justify-between items-center text-sm text-gray-600 mb-3">
                    <span>계획: {plan.planQty}</span>
                    <span>
                      {plan.startTime || '--:--'} ~ {plan.endTime || '--:--'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {plan.status === 'ready' && (
                      <Button
                        onClick={() => handleStart(plan.orderNo)}
                        disabled={isLoading}
                        className="flex-1"
                        size="sm"
                      >
                        <Play className="mr-1 h-4 w-4" />
                        시작
                      </Button>
                    )}
                    {plan.status === 'working' && (
                      <Button
                        onClick={() => handleEnd(plan.orderNo)}
                        disabled={isLoading}
                        variant="destructive"
                        className="flex-1"
                        size="sm"
                      >
                        <Square className="mr-1 h-4 w-4" />
                        종료
                      </Button>
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
