/**
 * @file src/app/(main)/production/assembly/page.tsx
 * @description
 * 조립실적등록 페이지입니다. (HS900 대체)
 * 조립 작업지시를 조회하고 실적을 등록합니다.
 *
 * 초보자 가이드:
 * 1. **공정/라인 선택**: 작업할 공정과 라인 선택
 * 2. **작업지시 조회**: 조회 버튼으로 작업지시 확인
 * 3. **시리얼 스캔**: 조립 완료된 제품의 시리얼 바코드 스캔
 * 4. **결과 입력**: OK/NG 버튼으로 결과 입력
 * 5. **저장**: 조립 실적 저장
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Search, Save, Trash2, Wrench } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

import { BarcodeInput } from '@/components/forms/BarcodeInput';
import { ProcessSelect, LineSelect } from '@/components/forms/ProcessLineSelect';
import { useAuthStore } from '@/stores/auth-store';
import { formatNumber } from '@/lib/utils/string';
import {
  showSuccess,
  showError,
  showWarning,
  showInfo,
  showConfirm,
  showScanSuccess,
  showScanError,
  handleApiError,
} from '@/lib/utils/toast';

/** 조립 계획 타입 */
interface AssemblyPlan {
  orderNo: string;
  itemCode: string;
  itemName: string;
  planQty: number;
  assemblyQty: number;
}

/** 조립 항목 타입 */
interface AssemblyItem {
  no: number;
  serialNo: string;
  status: 'OK' | 'NG';
  assemblyTime: string;
}

/** API 응답 인터페이스 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export default function AssemblyResultPage() {
  const { saupj, opcode, linecode, userId, setForm } = useAuthStore();

  // 상태 관리
  const [processCode, setProcessCode] = useState(opcode || '');
  const [lineCode, setLineCode] = useState(linecode || '');
  const [workDate, setWorkDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [plan, setPlan] = useState<AssemblyPlan | null>(null);
  const [assemblyList, setAssemblyList] = useState<AssemblyItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 페이지 로드 시 화면 정보 설정
  useEffect(() => {
    setForm('HS900', '조립실적등록');
  }, [setForm]);

  // OK/NG 카운트
  const okCount = assemblyList.filter((i) => i.status === 'OK').length;
  const ngCount = assemblyList.filter((i) => i.status === 'NG').length;

  // 작업지시 조회
  const handleSearch = async () => {
    if (!processCode || !lineCode) {
      showWarning('공정과 라인을 선택하세요.');
      return;
    }

    setIsLoading(true);

    try {
      const params = new URLSearchParams({
        processCode,
        lineCode,
        workDate: workDate,
      });
      const response = await fetch(`/api/production/assembly?${params}`);
      const result: ApiResponse<AssemblyPlan[]> = await response.json();

      if (result.success && result.data && result.data.length > 0) {
        // 첫 번째 작업지시 선택
        setPlan(result.data[0]);
        setAssemblyList([]);
        showInfo('작업지시가 조회되었습니다.');
      } else if (result.success && (!result.data || result.data.length === 0)) {
        showInfo('조회 결과가 없습니다.');
        setPlan(null);
      } else {
        showError(result.error || '조회 실패');
        setPlan(null);
      }
    } catch (err) {
      console.error('조회 오류:', err);
      handleApiError(err, '조회 중 오류가 발생했습니다.');
      setPlan(null);
    } finally {
      setIsLoading(false);
    }
  };

  // 바코드 스캔 처리
  const handleBarcodeScan = useCallback(
    (barcode: string) => {
      if (!plan) {
        showWarning('작업지시를 먼저 조회하세요.');
        return;
      }

      if (!barcode) {
        showWarning('바코드를 입력하세요.');
        return;
      }

      // 중복 체크
      if (assemblyList.some((item) => item.serialNo === barcode)) {
        showScanError('이미 등록된 시리얼입니다.');
        return;
      }

      // 조립 항목 추가 (기본 OK)
      const newItem: AssemblyItem = {
        no: assemblyList.length + 1,
        serialNo: barcode,
        status: 'OK',
        assemblyTime: format(new Date(), 'HH:mm:ss'),
      };

      setAssemblyList((prev) => [...prev, newItem]);
      showScanSuccess(`${barcode} 추가`);
    },
    [plan, assemblyList]
  );

  // 결과 변경
  const handleStatusChange = (idx: number, status: 'OK' | 'NG') => {
    setAssemblyList((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, status } : item))
    );
  };

  // 항목 삭제
  const handleDelete = (idx: number) => {
    setAssemblyList((prev) => {
      const newList = prev.filter((_, i) => i !== idx);
      return newList.map((item, i) => ({ ...item, no: i + 1 }));
    });
  };

  // 저장
  const handleSave = async () => {
    if (assemblyList.length === 0) {
      showWarning('저장할 실적이 없습니다.');
      return;
    }

    const confirmed = await showConfirm(
      `${assemblyList.length}건의 조립 실적을 저장하시겠습니까?`,
      { description: `OK: ${okCount}건, NG: ${ngCount}건` }
    );
    if (!confirmed) return;

    setIsLoading(true);

    try {
      const response = await fetch('/api/production/assembly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saupj: saupj || '10',
          orderNo: plan?.orderNo,
          processCode,
          lineCode,
          workDate: workDate,
          items: assemblyList.map((item) => ({
            serialNo: item.serialNo,
            status: item.status,
            assemblyTime: item.assemblyTime,
          })),
          userId: userId || 'SYSTEM',
        }),
      });

      const result: ApiResponse<{ count: number; ok: number; ng: number }> =
        await response.json();

      if (result.success) {
        showSuccess(result.message || `저장 완료 (OK: ${okCount}건, NG: ${ngCount}건)`);
        setAssemblyList([]);
        handleSearch(); // 새로고침
      } else {
        showError(result.error || '저장 실패');
      }
    } catch (err) {
      console.error('저장 오류:', err);
      handleApiError(err, '저장 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 조회 조건 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <Wrench className="mr-2 h-5 w-5" />
            조회 조건
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <ProcessSelect value={processCode} onChange={setProcessCode} label="공정" />
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

      {/* 작업지시 정보 */}
      {plan && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">작업지시 정보</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-blue-50 p-4 space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">지시번호</span>
                  <span className="font-mono">{plan.orderNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">품목</span>
                  <span>
                    {plan.itemCode} - {plan.itemName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">계획/실적</span>
                  <span className="font-bold">
                    {formatNumber(plan.assemblyQty)} / {formatNumber(plan.planQty)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 시리얼 스캔 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">시리얼 스캔</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <BarcodeInput
                label="시리얼 NO"
                placeholder="시리얼 바코드를 스캔하세요"
                onScan={handleBarcodeScan}
                autoFocus
              />

              {/* 조립 목록 */}
              {assemblyList.length > 0 && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">등록: {assemblyList.length}건</span>
                    <div className="flex gap-2">
                      <Badge variant="default">OK: {okCount}</Badge>
                      <Badge variant="destructive">NG: {ngCount}</Badge>
                    </div>
                  </div>

                  <div className="max-h-48 overflow-auto rounded border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">No</TableHead>
                          <TableHead>시리얼</TableHead>
                          <TableHead>결과</TableHead>
                          <TableHead>시간</TableHead>
                          <TableHead className="w-12">삭제</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {assemblyList.map((item, idx) => (
                          <TableRow
                            key={item.serialNo}
                            className={item.status === 'NG' ? 'bg-red-50' : ''}
                          >
                            <TableCell>{item.no}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {item.serialNo}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant={item.status === 'OK' ? 'default' : 'outline'}
                                  onClick={() => handleStatusChange(idx, 'OK')}
                                  className="h-6 px-2 text-xs"
                                >
                                  OK
                                </Button>
                                <Button
                                  size="sm"
                                  variant={item.status === 'NG' ? 'destructive' : 'outline'}
                                  onClick={() => handleStatusChange(idx, 'NG')}
                                  className="h-6 px-2 text-xs"
                                >
                                  NG
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">{item.assemblyTime}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500"
                                onClick={() => handleDelete(idx)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* 저장 버튼 */}
                  <Button
                    onClick={handleSave}
                    disabled={assemblyList.length === 0 || isLoading}
                    className="w-full"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    저장 ({assemblyList.length}건)
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
