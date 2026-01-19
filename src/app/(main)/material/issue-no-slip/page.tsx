/**
 * @file src/app/(main)/material/issue-no-slip/page.tsx
 * @description
 * 자재불출(전표X) 페이지 (HSJ110 대체)
 * 전표 없이 창고 간 자재 불출 처리를 합니다.
 *
 * 초보자 가이드:
 * 1. FROM/TO 창고 선택
 * 2. 바코드 스캔하여 불출 항목 등록
 * 3. 저장 버튼으로 불출 완료
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Save, Trash2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

/** 불출 항목 인터페이스 */
interface IssueItem {
  no: number;
  boxNo: string;
  itemCode: string;
  itemName: string;
  qty: number;
}

/** API 응답 인터페이스 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export default function MaterialIssueNoSlipPage() {
  const { saupj, userId, setForm } = useAuthStore();
  const [fromWhs, setFromWhs] = useState('');
  const [toWhs, setToWhs] = useState('');
  const [issueDate, setIssueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [itemList, setItemList] = useState<IssueItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => { setForm('HSJ110', '자재불출(전표X)'); }, [setForm]);

  /** 바코드 스캔 처리 */
  const handleBarcodeScan = useCallback(async (barcode: string) => {
    if (!fromWhs || !toWhs) {
      showWarning('FROM/TO 창고를 선택하세요.');
      return;
    }
    if (fromWhs === toWhs) {
      showWarning('FROM과 TO 창고가 동일합니다.');
      return;
    }
    if (itemList.some(i => i.boxNo === barcode)) {
      showScanError('이미 등록된 BOX입니다.');
      return;
    }

    try {
      // API로 바코드 재고 정보 조회
      const params = new URLSearchParams({ boxNo: barcode, whsCode: fromWhs });
      const response = await fetch(`/api/material/barcode?${params}`);
      const result: ApiResponse<{
        boxNo: string;
        itemCode: string;
        itemName: string;
        qty: number;
      }> = await response.json();

      if (!result.success || !result.data) {
        showScanError(result.error || '해당 바코드의 재고를 찾을 수 없습니다.');
        return;
      }

      const newItem: IssueItem = {
        no: itemList.length + 1,
        boxNo: result.data.boxNo,
        itemCode: result.data.itemCode,
        itemName: result.data.itemName || '',
        qty: result.data.qty,
      };

      setItemList(prev => [...prev, newItem]);
      showScanSuccess(`${result.data.itemCode} 추가`);
    } catch (err) {
      console.error('바코드 조회 오류:', err);
      showScanError('바코드 조회 중 오류가 발생했습니다.');
    }
  }, [fromWhs, toWhs, itemList]);

  /** 항목 삭제 */
  const handleDelete = (idx: number) => {
    setItemList(prev => prev.filter((_, i) => i !== idx).map((item, i) => ({ ...item, no: i + 1 })));
  };

  /** 저장 */
  const handleSave = async () => {
    if (itemList.length === 0) {
      showWarning('불출할 항목이 없습니다.');
      return;
    }

    const confirmed = await showConfirm(
      `${itemList.length}건을 불출 처리하시겠습니까?`,
      { description: `FROM: ${fromWhs} → TO: ${toWhs}` }
    );
    if (!confirmed) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/material/issue-no-slip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saupj: saupj || '10',
          issueDate: issueDate,
          fromWhsCode: fromWhs,
          toWhsCode: toWhs,
          items: itemList.map(item => ({
            boxNo: item.boxNo,
            itemCode: item.itemCode,
            qty: item.qty,
          })),
          userId: userId || 'SYSTEM',
        }),
      });

      const result: ApiResponse<{ count: number }> = await response.json();

      if (result.success) {
        showSuccess(result.message || `${itemList.length}건 불출 처리되었습니다.`);
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

  // 총 수량 계산
  const totalQty = itemList.reduce((acc, item) => acc + item.qty, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">창고 선택</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-2">
            <WarehouseSelect
              value={fromWhs}
              onChange={setFromWhs}
              label="FROM (출고)"
              excludeValues={toWhs ? [toWhs] : []}
              className="flex-1"
            />
            <div className="flex h-10 items-center justify-center">
              <ArrowRight className="h-5 w-5 text-gray-400" />
            </div>
            <WarehouseSelect
              value={toWhs}
              onChange={setToWhs}
              label="TO (입고)"
              excludeValues={fromWhs ? [fromWhs] : []}
              className="flex-1"
            />
          </div>
          <div className="space-y-2">
            <Label>불출일자</Label>
            <Input
              type="date"
              value={issueDate}
              onChange={e => setIssueDate(e.target.value)}
            />
          </div>
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
            disabled={!fromWhs || !toWhs}
          />
          {(!fromWhs || !toWhs) && (
            <p className="text-sm text-orange-500">
              * FROM과 TO 창고를 먼저 선택하세요.
            </p>
          )}
        </CardContent>
      </Card>

      {itemList.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">불출 목록 ({itemList.length}건)</CardTitle>
              <span className="text-sm text-gray-500">합계: {formatNumber(totalQty)}</span>
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
                  {itemList.map((item, idx) => (
                    <TableRow key={item.boxNo}>
                      <TableCell>{item.no}</TableCell>
                      <TableCell className="font-mono text-sm">{item.boxNo}</TableCell>
                      <TableCell>
                        <div className="text-sm">{item.itemCode}</div>
                        <div className="text-xs text-gray-500">{item.itemName}</div>
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(item.qty)}</TableCell>
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
