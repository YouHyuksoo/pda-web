/**
 * @file src/app/(main)/material/issue/page.tsx
 * @description
 * 자재불출 페이지입니다. (HM100 대체)
 * 창고간 자재 이동 처리를 합니다.
 *
 * 초보자 가이드:
 * 1. **FROM 창고**: 출고할 창고 선택
 * 2. **TO 창고**: 입고할 창고 선택
 * 3. **바코드 스캔**: 이동할 자재 바코드 스캔
 * 4. **저장**: 재고 이동 처리
 *
 * 주요 테이블:
 * - PMS100: 재고현황
 * - PMB300: 자재 이동 이력
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Save, Trash2, RefreshCw, ArrowRight } from 'lucide-react';

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
import { Separator } from '@/components/ui/separator';

import { BarcodeInput } from '@/components/forms/BarcodeInput';
import { WarehouseSelect } from '@/components/forms/WarehouseSelect';
import { useAuthStore } from '@/stores/auth-store';
import { formatNumber } from '@/lib/utils/string';
import {
  showSuccess,
  showError,
  showWarning,
  showConfirm,
  showScanSuccess,
  showScanError,
  handleApiError,
} from '@/lib/utils/toast';

// 자재 이동 항목 타입
interface TransferItem {
  no: number;
  boxNo: string;
  itemCode: string;
  itemName: string;
  qty: number;
  fromWhs: string;
  toWhs: string;
  flag: string;
}

/** API 응답 인터페이스 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export default function MaterialIssuePage() {
  const { location, saupj, userId, setForm } = useAuthStore();

  // 상태 관리
  const [fromWarehouse, setFromWarehouse] = useState(location || '');
  const [toWarehouse, setToWarehouse] = useState('');
  const [moveDate, setMoveDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isLoading, setIsLoading] = useState(false);

  // 이동 항목 목록
  const [transferList, setTransferList] = useState<TransferItem[]>([]);
  const [totalQty, setTotalQty] = useState(0);

  // 페이지 로드 시 화면 정보 설정
  useEffect(() => {
    setForm('HM100', '자재불출');
  }, [setForm]);

  // 총 수량 계산
  useEffect(() => {
    const sum = transferList.reduce((acc, item) => acc + item.qty, 0);
    setTotalQty(sum);
  }, [transferList]);

  // 바코드 스캔 처리
  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      if (!fromWarehouse) {
        showWarning('FROM 창고를 선택하세요.');
        return;
      }
      if (!toWarehouse) {
        showWarning('TO 창고를 선택하세요.');
        return;
      }
      if (fromWarehouse === toWarehouse) {
        showWarning('FROM과 TO 창고가 같을 수 없습니다.');
        return;
      }
      if (!barcode) {
        showWarning('바코드를 입력하세요.');
        return;
      }

      // 중복 체크
      const isDuplicate = transferList.some((item) => item.boxNo === barcode);
      if (isDuplicate) {
        showScanError('이미 등록된 BOX입니다.');
        return;
      }

      try {
        // 실제 API 연동 - 바코드로 재고 정보 조회
        const params = new URLSearchParams({
          boxNo: barcode,
          whsCode: fromWarehouse,
        });
        const response = await fetch(`/api/inventory/move/box?${params}`);
        const result: ApiResponse<{
          boxNo: string;
          itemCode: string;
          qty: number;
          whsCode: string;
        }[]> = await response.json();

        if (!result.success || !result.data || result.data.length === 0) {
          showScanError(result.error || '해당 바코드의 재고를 찾을 수 없습니다.');
          return;
        }

        // 조회된 모든 BOX 항목 추가
        const newItems = result.data.map((item, idx) => ({
          no: transferList.length + idx + 1,
          boxNo: item.boxNo,
          itemCode: item.itemCode,
          itemName: '', // API에서 품명 없음
          qty: item.qty,
          fromWhs: fromWarehouse,
          toWhs: toWarehouse,
          flag: 'N',
        }));

        setTransferList((prev) => [...prev, ...newItems]);

        // 스캔 성공 피드백
        showScanSuccess(`${newItems.length}건 추가`);
      } catch (error) {
        console.error('바코드 처리 오류:', error);
        showScanError('해당 바코드의 재고를 찾을 수 없습니다.');
      }
    },
    [fromWarehouse, toWarehouse, transferList]
  );

  // 항목 삭제
  const handleDeleteItem = (index: number) => {
    setTransferList((prev) => {
      const newList = prev.filter((_, i) => i !== index);
      return newList.map((item, i) => ({ ...item, no: i + 1 }));
    });
  };

  // 저장
  const handleSave = async () => {
    if (transferList.length === 0) {
      showWarning('이동할 자재가 없습니다.');
      return;
    }

    const confirmed = await showConfirm(
      `${transferList.length}건의 자재를 이동하시겠습니까?`
    );
    if (!confirmed) return;

    setIsLoading(true);

    try {
      // 실제 API 연동
      const response = await fetch('/api/inventory/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saupj: saupj || '10',
          moveDate: moveDate,
          fromWhsCode: fromWarehouse,
          toWhsCode: toWarehouse,
          items: transferList.map((item) => ({
            boxNo: item.boxNo,
            itemCode: item.itemCode,
            qty: item.qty,
            fromWhsCode: item.fromWhs,
            toWhsCode: item.toWhs,
          })),
          userId: userId || 'SYSTEM',
        }),
      });

      const result: ApiResponse<{ count: number }> = await response.json();

      if (!result.success) {
        showError(result.error || '저장 실패');
        return;
      }

      showSuccess(result.message || `${transferList.length}건 저장되었습니다.`);
      setTransferList([]);
    } catch (error) {
      console.error('저장 오류:', error);
      handleApiError(error, '저장 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 초기화
  const handleReset = async () => {
    if (transferList.length > 0) {
      const confirmed = await showConfirm('등록된 내용이 삭제됩니다. 계속하시겠습니까?');
      if (!confirmed) return;
    }
    setTransferList([]);
  };

  return (
    <div className="space-y-4">
      {/* 창고 선택 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">창고 선택</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-2">
            <WarehouseSelect
              value={fromWarehouse}
              onChange={setFromWarehouse}
              label="FROM (출고)"
              excludeValues={toWarehouse ? [toWarehouse] : []}
              className="flex-1"
            />
            <div className="flex h-10 items-center justify-center">
              <ArrowRight className="h-5 w-5 text-gray-400" />
            </div>
            <WarehouseSelect
              value={toWarehouse}
              onChange={setToWarehouse}
              label="TO (입고)"
              excludeValues={fromWarehouse ? [fromWarehouse] : []}
              className="flex-1"
            />
          </div>

          <div className="space-y-2">
            <Label>이동일자</Label>
            <Input
              type="date"
              value={moveDate}
              onChange={(e) => setMoveDate(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* 바코드 입력 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">자재 스캔</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <BarcodeInput
            label="BOX NO"
            placeholder="바코드를 스캔하세요"
            onScan={handleBarcodeScan}
            autoFocus
            disabled={!fromWarehouse || !toWarehouse}
          />

          {(!fromWarehouse || !toWarehouse) && (
            <p className="text-sm text-orange-500">
              * FROM과 TO 창고를 먼저 선택하세요.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 이동 목록 */}
      {transferList.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                이동 목록 ({transferList.length}건)
              </CardTitle>
              <Badge variant="outline" className="text-lg">
                합계: {formatNumber(totalQty)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-64 overflow-auto rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">No</TableHead>
                    <TableHead>BOX NO</TableHead>
                    <TableHead>품목</TableHead>
                    <TableHead className="text-right">수량</TableHead>
                    <TableHead className="w-12">삭제</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transferList.map((item, index) => (
                    <TableRow key={item.boxNo}>
                      <TableCell>{item.no}</TableCell>
                      <TableCell className="font-mono">{item.boxNo}</TableCell>
                      <TableCell>
                        <div className="text-sm">{item.itemCode}</div>
                        <div className="text-xs text-gray-500">{item.itemName}</div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatNumber(item.qty)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500"
                          onClick={() => handleDeleteItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Separator />

            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={isLoading}
                className="flex-1"
              >
                <Save className="mr-2 h-4 w-4" />
                저장 ({transferList.length}건)
              </Button>
              <Button variant="outline" onClick={handleReset}>
                <RefreshCw className="mr-2 h-4 w-4" />
                초기화
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
