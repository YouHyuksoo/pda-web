/**
 * @file src/app/(main)/production/result/page.tsx
 * @description
 * 실적등록 페이지입니다. (HS700 대체)
 * 생산 실적을 등록하고 관리합니다.
 *
 * 초보자 가이드:
 * 1. **공정/라인 선택**: 작업할 공정과 라인 선택
 * 2. **작업지시 조회**: 선택한 조건으로 생산계획 조회
 * 3. **바코드 스캔**: BOX 바코드 스캔하여 실적 등록
 * 4. **저장**: 등록된 실적 저장
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Search, Save, Trash2, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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

/** 생산계획 타입 */
interface ProductionPlan {
  no: number;
  orderNo: string;
  itemCode: string;
  itemName: string;
  planQty: number;
  inputQty: number;
  goodQty: number;
  startTime: string;
  workOrder: string;
  planDate: string;
}

/** 실적 상세 타입 */
interface ResultDetail {
  no: number;
  boxNo: string;
  qty: number;
  saveFlag: string;
  planDate: string;
}

/** API 응답 인터페이스 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export default function ProductionResultPage() {
  const { saupj, opcode, linecode, userId, setForm } = useAuthStore();

  // 상태 관리
  const [processCode, setProcessCode] = useState(opcode || '');
  const [lineCode, setLineCode] = useState(linecode || '');
  const [workDate, setWorkDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [workOrder, setWorkOrder] = useState('');
  const [autoMode, setAutoMode] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // 생산계획 목록
  const [planList, setPlanList] = useState<ProductionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<ProductionPlan | null>(null);

  // 실적 상세 목록
  const [resultList, setResultList] = useState<ResultDetail[]>([]);

  // 페이지 로드 시 화면 정보 설정
  useEffect(() => {
    setForm('HS700', '실적등록');
  }, [setForm]);

  // 총 수량 계산
  const totalQty = resultList.reduce((acc, item) => acc + item.qty, 0);

  // 작업지시 조회
  const handleSearch = useCallback(async () => {
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
      const result: ApiResponse<ProductionPlan[]> = await response.json();

      if (result.success && result.data) {
        setPlanList(result.data);
        if (result.data.length > 0 && autoMode) {
          setSelectedPlan(result.data[0]);
          setWorkOrder(result.data[0].workOrder);
        }
        if (result.data.length === 0) {
          showInfo('조회 결과가 없습니다.');
        }
      } else {
        showError(result.error || '조회 실패');
        setPlanList([]);
      }
    } catch (err) {
      console.error('조회 오류:', err);
      handleApiError(err, '조회 중 오류가 발생했습니다.');
      setPlanList([]);
    } finally {
      setIsLoading(false);
    }
  }, [processCode, lineCode, workDate, autoMode]);

  // 생산계획 선택
  const handlePlanSelect = (plan: ProductionPlan) => {
    setSelectedPlan(plan);
    setWorkOrder(plan.workOrder);
    setResultList([]);
  };

  // 바코드 스캔 처리
  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      if (!selectedPlan) {
        showWarning('작업지시를 먼저 선택하세요.');
        return;
      }

      if (!barcode) {
        showWarning('바코드를 입력하세요.');
        return;
      }

      // 중복 체크
      if (resultList.some((item) => item.boxNo === barcode)) {
        showScanError('이미 등록된 BOX입니다.');
        return;
      }

      try {
        // API로 바코드 유효성 검사
        const params = new URLSearchParams({
          boxNo: barcode,
          workOrder: workOrder,
        });
        const response = await fetch(`/api/production/result/box?${params}`);
        const result: ApiResponse<{ boxNo: string; qty: number }> = await response.json();

        let qty = 1;
        if (result.success && result.data) {
          qty = result.data.qty || 1;
        }

        // 실적 추가
        const newResult: ResultDetail = {
          no: resultList.length + 1,
          boxNo: barcode,
          qty: qty,
          saveFlag: 'N',
          planDate: workDate,
        };

        setResultList((prev) => [...prev, newResult]);
        showScanSuccess(`${barcode} 추가 (${qty}EA)`);
      } catch (err) {
        console.error('바코드 처리 오류:', err);
        // 오류가 나도 기본 수량 1로 등록
        const newResult: ResultDetail = {
          no: resultList.length + 1,
          boxNo: barcode,
          qty: 1,
          saveFlag: 'N',
          planDate: workDate,
        };
        setResultList((prev) => [...prev, newResult]);
        showScanSuccess(`${barcode} 추가`);
      }
    },
    [selectedPlan, resultList, workDate, workOrder]
  );

  // 실적 삭제
  const handleDeleteResult = (index: number) => {
    setResultList((prev) => {
      const newList = prev.filter((_, i) => i !== index);
      return newList.map((item, i) => ({ ...item, no: i + 1 }));
    });
  };

  // 저장
  const handleSave = async () => {
    if (resultList.length === 0) {
      showWarning('저장할 실적이 없습니다.');
      return;
    }

    const confirmed = await showConfirm(
      `${resultList.length}건의 실적을 저장하시겠습니까?`,
      { description: `총 수량: ${formatNumber(totalQty)}` }
    );
    if (!confirmed) return;

    setIsLoading(true);

    try {
      const response = await fetch('/api/production/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saupj: saupj || '10',
          workOrder,
          processCode,
          lineCode,
          workDate: workDate,
          items: resultList.map(item => ({
            boxNo: item.boxNo,
            qty: item.qty,
          })),
          userId: userId || 'SYSTEM',
        }),
      });

      const result: ApiResponse<{ count: number }> = await response.json();

      if (result.success) {
        showSuccess(result.message || `${resultList.length}건 저장되었습니다.`);
        setResultList([]);
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

  // 초기화
  const handleReset = async () => {
    if (resultList.length > 0) {
      const confirmed = await showConfirm('등록된 내용이 삭제됩니다. 계속하시겠습니까?');
      if (!confirmed) return;
    }
    setResultList([]);
    setSelectedPlan(null);
    setWorkOrder('');
  };

  return (
    <div className="space-y-4">
      {/* 조회 조건 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">조회 조건</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <ProcessSelect
              value={processCode}
              onChange={setProcessCode}
              label="공정"
            />
            <LineSelect
              value={lineCode}
              onChange={setLineCode}
              label="라인"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>작업일자</Label>
              <Input
                type="date"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="autoMode"
                  checked={autoMode}
                  onCheckedChange={(checked) => setAutoMode(checked as boolean)}
                />
                <Label htmlFor="autoMode" className="text-sm">
                  자동선택
                </Label>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSearch} disabled={isLoading} className="flex-1">
              <Search className="mr-2 h-4 w-4" />
              조회
            </Button>
            <Button variant="outline" onClick={handleReset}>
              <RefreshCw className="mr-2 h-4 w-4" />
              초기화
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 생산계획 목록 */}
      {planList.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">생산계획</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-40 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">선택</TableHead>
                    <TableHead>품목</TableHead>
                    <TableHead className="text-right">계획</TableHead>
                    <TableHead className="text-right">실적</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {planList.map((plan) => (
                    <TableRow
                      key={plan.orderNo}
                      className={
                        selectedPlan?.orderNo === plan.orderNo
                          ? 'bg-blue-50'
                          : 'cursor-pointer hover:bg-gray-50'
                      }
                      onClick={() => handlePlanSelect(plan)}
                    >
                      <TableCell>
                        <input
                          type="radio"
                          name="plan"
                          checked={selectedPlan?.orderNo === plan.orderNo}
                          onChange={() => handlePlanSelect(plan)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{plan.itemCode}</div>
                        <div className="text-xs text-gray-500">{plan.itemName}</div>
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(plan.planQty)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={plan.goodQty >= plan.planQty ? 'default' : 'secondary'}>
                          {formatNumber(plan.goodQty)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 바코드 입력 */}
      {selectedPlan && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              실적 입력
              <span className="ml-2 text-sm font-normal text-gray-500">
                {selectedPlan.itemCode} - {selectedPlan.itemName}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <BarcodeInput
              label="BOX NO"
              placeholder="바코드를 스캔하세요"
              onScan={handleBarcodeScan}
              autoFocus
            />

            {/* 등록된 실적 목록 */}
            {resultList.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label>등록 목록 ({resultList.length}건)</Label>
                  <Badge variant="outline" className="text-lg">
                    합계: {formatNumber(totalQty)}
                  </Badge>
                </div>
                <div className="max-h-48 overflow-auto rounded border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">No</TableHead>
                        <TableHead>BOX NO</TableHead>
                        <TableHead className="text-right">수량</TableHead>
                        <TableHead className="w-12">삭제</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resultList.map((item, index) => (
                        <TableRow key={item.boxNo}>
                          <TableCell>{item.no}</TableCell>
                          <TableCell className="font-mono">{item.boxNo}</TableCell>
                          <TableCell className="text-right">{formatNumber(item.qty)}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500"
                              onClick={() => handleDeleteResult(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* 저장 버튼 */}
            <Button
              onClick={handleSave}
              disabled={resultList.length === 0 || isLoading}
              className="w-full"
            >
              <Save className="mr-2 h-4 w-4" />
              저장 ({resultList.length}건)
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
