/**
 * @file src/app/(main)/material/stocktaking/page.tsx
 * @description
 * 재고실사 페이지 (HS800 대체)
 * 실사 결과를 저장하고 재고를 조정합니다.
 *
 * 초보자 가이드:
 * 1. 창고 선택
 * 2. 바코드 스캔하여 실사 수량 입력
 * 3. 저장 버튼으로 재고 조정
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { ClipboardCheck, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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

/** 실사 항목 인터페이스 */
interface StocktakingItem {
  no: number;
  boxNo: string;
  itemCode: string;
  itemName: string;
  systemQty: number;
  actualQty: number;
  diff: number;
  isNew?: boolean;
}

/** API 응답 인터페이스 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export default function StocktakingPage() {
  const { saupj, userId, setForm } = useAuthStore();
  const [warehouse, setWarehouse] = useState('');
  const [itemList, setItemList] = useState<StocktakingItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => { setForm('HS800', '재고실사'); }, [setForm]);

  /** 바코드 스캔 처리 */
  const handleBarcodeScan = useCallback(async (barcode: string) => {
    if (!warehouse) {
      showWarning('창고를 선택하세요.');
      return;
    }

    const existingIdx = itemList.findIndex(i => i.boxNo === barcode);
    if (existingIdx >= 0) {
      // 이미 있으면 실사수량 +1
      setItemList(prev => prev.map((item, idx) =>
        idx === existingIdx
          ? { ...item, actualQty: item.actualQty + 1, diff: item.actualQty + 1 - item.systemQty }
          : item
      ));
      showScanSuccess(`실사수량 +1 (${itemList[existingIdx].actualQty + 1})`);
      return;
    }

    try {
      // API로 시스템 재고 조회
      const params = new URLSearchParams({ boxNo: barcode, whsCode: warehouse });
      const response = await fetch(`/api/material/stocktaking?${params}`);
      const result: ApiResponse<{
        boxNo: string;
        itemCode: string;
        itemName: string;
        systemQty: number;
        whsCode: string;
        isNew: boolean;
      }> = await response.json();

      if (!result.success) {
        showScanError(result.error || '재고 조회 실패');
        return;
      }

      const data = result.data!;
      const newItem: StocktakingItem = {
        no: itemList.length + 1,
        boxNo: data.boxNo,
        itemCode: data.itemCode || '',
        itemName: data.itemName || '',
        systemQty: data.systemQty || 0,
        actualQty: 1,
        diff: 1 - (data.systemQty || 0),
        isNew: data.isNew,
      };

      setItemList(prev => [...prev, newItem]);

      if (data.isNew) {
        showScanSuccess(`${barcode} 신규 추가 (시스템 재고 없음)`);
      } else {
        showScanSuccess(`${data.itemCode} (시스템: ${formatNumber(data.systemQty)})`);
      }
    } catch (err) {
      console.error('재고 조회 오류:', err);
      showScanError('재고 조회 중 오류가 발생했습니다.');
    }
  }, [warehouse, itemList]);

  /** 실사 수량 변경 */
  const handleQtyChange = (idx: number, qty: number) => {
    setItemList(prev => prev.map((item, i) =>
      i === idx
        ? { ...item, actualQty: qty, diff: qty - item.systemQty }
        : item
    ));
  };

  /** 항목 삭제 */
  const handleDelete = (idx: number) => {
    setItemList(prev => prev.filter((_, i) => i !== idx).map((item, i) => ({ ...item, no: i + 1 })));
  };

  /** 저장 */
  const handleSave = async () => {
    if (itemList.length === 0) {
      showWarning('실사할 항목이 없습니다.');
      return;
    }

    // 차이가 있는 항목 확인
    const diffItems = itemList.filter(i => i.diff !== 0);
    const description = diffItems.length > 0
      ? `차이 항목: ${diffItems.length}건 (재고가 조정됩니다)`
      : '모든 항목이 일치합니다';

    const confirmed = await showConfirm(
      `${itemList.length}건을 저장하시겠습니까?`,
      { description }
    );
    if (!confirmed) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/material/stocktaking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saupj: saupj || '10',
          whsCode: warehouse,
          items: itemList.map(item => ({
            boxNo: item.boxNo,
            itemCode: item.itemCode,
            systemQty: item.systemQty,
            actualQty: item.actualQty,
          })),
          userId: userId || 'SYSTEM',
        }),
      });

      const result: ApiResponse<{ count: number }> = await response.json();

      if (result.success) {
        showSuccess(result.message || `${itemList.length}건 실사 처리되었습니다.`);
        setItemList([]);
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

  // 통계
  const diffCount = itemList.filter(i => i.diff !== 0).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <ClipboardCheck className="mr-2 h-5 w-5" />
            실사 정보
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <WarehouseSelect
            value={warehouse}
            onChange={setWarehouse}
            label="창고"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">바코드 스캔</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <BarcodeInput
            label="BOX NO"
            placeholder="바코드를 스캔하세요"
            onScan={handleBarcodeScan}
            autoFocus
            disabled={!warehouse}
          />
          {!warehouse && (
            <p className="text-sm text-orange-500">* 창고를 먼저 선택하세요.</p>
          )}
        </CardContent>
      </Card>

      {itemList.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">실사 목록 ({itemList.length}건)</CardTitle>
              {diffCount > 0 && (
                <Badge variant="destructive">차이: {diffCount}건</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-64 overflow-auto rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>BOX NO</TableHead>
                    <TableHead>품목</TableHead>
                    <TableHead className="text-right w-16">시스템</TableHead>
                    <TableHead className="text-right w-20">실사</TableHead>
                    <TableHead className="text-right w-16">차이</TableHead>
                    <TableHead className="w-12">삭제</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemList.map((item, idx) => (
                    <TableRow
                      key={item.boxNo}
                      className={item.diff !== 0 ? 'bg-red-50' : ''}
                    >
                      <TableCell className="font-mono text-xs">{item.boxNo}</TableCell>
                      <TableCell className="text-xs">
                        {item.itemCode || '-'}
                        {item.isNew && (
                          <Badge variant="outline" className="ml-1 text-xs">신규</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(item.systemQty)}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          value={item.actualQty}
                          onChange={e => handleQtyChange(idx, parseInt(e.target.value) || 0)}
                          className="w-16 h-8 text-right"
                          min={0}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={item.diff === 0 ? 'default' : item.diff > 0 ? 'secondary' : 'destructive'}
                        >
                          {item.diff > 0 ? '+' : ''}{item.diff}
                        </Badge>
                      </TableCell>
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
            <Button
              onClick={handleSave}
              disabled={isLoading}
              className="w-full"
            >
              <Save className="mr-2 h-4 w-4" />
              저장 ({itemList.length}건)
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
