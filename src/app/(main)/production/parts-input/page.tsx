/**
 * @file src/app/(main)/production/parts-input/page.tsx
 * @description
 * 부품투입 페이지입니다. (HS601 대체)
 * 생산 공정에 부품을 투입하고 기록합니다.
 *
 * 초보자 가이드:
 * 1. **공정/라인 선택**: 작업할 공정과 라인 선택
 * 2. **작업지시 조회**: 조회 버튼으로 작업지시 확인
 * 3. **부품 스캔**: 바코드 스캔하여 부품 등록
 * 4. **저장**: 투입된 부품 정보 저장
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Search, Save, Trash2, Cpu } from 'lucide-react';

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

/** 작업지시 타입 */
interface WorkOrder {
  orderNo: string;
  itemCode: string;
  itemName: string;
  planQty: number;
  inputQty: number;
}

/** 부품 항목 타입 */
interface PartsItem {
  no: number;
  boxNo: string;
  partCode: string;
  partName: string;
  qty: number;
}

/** API 응답 인터페이스 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export default function PartsInputPage() {
  const { saupj, opcode, linecode, userId, setForm } = useAuthStore();

  // 상태 관리
  const [processCode, setProcessCode] = useState(opcode || '');
  const [lineCode, setLineCode] = useState(linecode || '');
  const [workDate, setWorkDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [partsList, setPartsList] = useState<PartsItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 페이지 로드 시 화면 정보 설정
  useEffect(() => {
    setForm('HS601', '부품투입');
  }, [setForm]);

  // 총 수량 계산
  const totalQty = partsList.reduce((acc, item) => acc + item.qty, 0);

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
      const response = await fetch(`/api/production/plan?${params}`);
      const result: ApiResponse<WorkOrder[]> = await response.json();

      if (result.success && result.data && result.data.length > 0) {
        // 첫 번째 작업지시 선택
        const plan = result.data[0];
        setWorkOrder({
          orderNo: plan.orderNo,
          itemCode: plan.itemCode,
          itemName: plan.itemName,
          planQty: plan.planQty,
          inputQty: plan.inputQty || 0,
        });
        setPartsList([]);
        showInfo('작업지시가 조회되었습니다.');
      } else if (result.success && (!result.data || result.data.length === 0)) {
        showInfo('조회 결과가 없습니다.');
        setWorkOrder(null);
      } else {
        showError(result.error || '조회 실패');
        setWorkOrder(null);
      }
    } catch (err) {
      console.error('조회 오류:', err);
      handleApiError(err, '조회 중 오류가 발생했습니다.');
      setWorkOrder(null);
    } finally {
      setIsLoading(false);
    }
  };

  // 바코드 스캔 처리
  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      if (!workOrder) {
        showWarning('작업지시를 먼저 조회하세요.');
        return;
      }

      if (!barcode) {
        showWarning('바코드를 입력하세요.');
        return;
      }

      // 중복 체크
      if (partsList.some((item) => item.boxNo === barcode)) {
        showScanError('이미 등록된 부품입니다.');
        return;
      }

      try {
        // API로 바코드 정보 조회
        const params = new URLSearchParams({
          boxNo: barcode,
          workOrder: workOrder.orderNo,
        });
        const response = await fetch(`/api/production/parts-input/box?${params}`);
        const result: ApiResponse<{ boxNo: string; partCode: string; partName: string; qty: number }> = await response.json();

        let partCode = 'PART';
        let partName = '부품';
        let qty = 1;

        if (result.success && result.data) {
          partCode = result.data.partCode || 'PART';
          partName = result.data.partName || '부품';
          qty = result.data.qty || 1;
        }

        // 부품 추가
        const newPart: PartsItem = {
          no: partsList.length + 1,
          boxNo: barcode,
          partCode,
          partName,
          qty,
        };

        setPartsList((prev) => [...prev, newPart]);
        showScanSuccess(`${barcode} 추가 (${qty}EA)`);
      } catch (err) {
        console.error('바코드 처리 오류:', err);
        // 오류가 나도 기본값으로 등록
        const newPart: PartsItem = {
          no: partsList.length + 1,
          boxNo: barcode,
          partCode: 'PART',
          partName: '부품',
          qty: 1,
        };
        setPartsList((prev) => [...prev, newPart]);
        showScanSuccess(`${barcode} 추가`);
      }
    },
    [workOrder, partsList]
  );

  // 부품 삭제
  const handleDelete = (index: number) => {
    setPartsList((prev) => {
      const newList = prev.filter((_, i) => i !== index);
      return newList.map((item, i) => ({ ...item, no: i + 1 }));
    });
  };

  // 저장
  const handleSave = async () => {
    if (partsList.length === 0) {
      showWarning('투입할 부품이 없습니다.');
      return;
    }

    const confirmed = await showConfirm(
      `${partsList.length}건의 부품을 투입하시겠습니까?`,
      { description: `총 수량: ${formatNumber(totalQty)}` }
    );
    if (!confirmed) return;

    setIsLoading(true);

    try {
      const response = await fetch('/api/production/parts-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saupj: saupj || '10',
          workOrder: workOrder?.orderNo,
          processCode,
          lineCode,
          workDate: workDate,
          items: partsList.map((item) => ({
            boxNo: item.boxNo,
            partCode: item.partCode,
            qty: item.qty,
          })),
          userId: userId || 'SYSTEM',
        }),
      });

      const result: ApiResponse<{ count: number }> = await response.json();

      if (result.success) {
        showSuccess(result.message || `${partsList.length}건 저장되었습니다.`);
        setPartsList([]);
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
            <Cpu className="mr-2 h-5 w-5" />
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
      {workOrder && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">작업지시 정보</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-blue-50 p-4 space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">지시번호</span>
                  <span className="font-mono">{workOrder.orderNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">품목</span>
                  <span>
                    {workOrder.itemCode} - {workOrder.itemName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">계획/투입</span>
                  <span>
                    {formatNumber(workOrder.inputQty)} / {formatNumber(workOrder.planQty)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 부품 스캔 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">부품 스캔</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <BarcodeInput
                label="부품 바코드"
                placeholder="부품 바코드를 스캔하세요"
                onScan={handleBarcodeScan}
                autoFocus
              />

              {/* 등록된 부품 목록 */}
              {partsList.length > 0 && (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <Label>등록 목록 ({partsList.length}건)</Label>
                    <span className="text-sm text-gray-500">
                      합계: {formatNumber(totalQty)}
                    </span>
                  </div>
                  <div className="max-h-48 overflow-auto rounded border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">No</TableHead>
                          <TableHead>부품</TableHead>
                          <TableHead className="text-right">수량</TableHead>
                          <TableHead className="w-12">삭제</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {partsList.map((item, index) => (
                          <TableRow key={item.boxNo}>
                            <TableCell>{item.no}</TableCell>
                            <TableCell>
                              <div className="font-medium">{item.partCode}</div>
                              <div className="text-xs text-gray-500">{item.boxNo}</div>
                            </TableCell>
                            <TableCell className="text-right">
                              {formatNumber(item.qty)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500"
                                onClick={() => handleDelete(index)}
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
                    disabled={partsList.length === 0 || isLoading}
                    className="w-full"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    저장 ({partsList.length}건)
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
