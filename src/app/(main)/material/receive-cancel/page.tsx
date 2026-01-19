/**
 * @file src/app/(main)/material/receive-cancel/page.tsx
 * @description
 * 자재입고취소 페이지 (HSJ210 대체)
 * 입고된 자재를 취소 처리합니다.
 *
 * 초보자 가이드:
 * 1. 창고 및 기간 선택 후 조회
 * 2. 취소할 항목 선택
 * 3. 선택 취소 버튼으로 입고 취소
 */
'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Search, Undo2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { WarehouseSelect } from '@/components/forms/WarehouseSelect';
import { useAuthStore } from '@/stores/auth-store';
import { formatNumber } from '@/lib/utils/string';
import {
  showSuccess,
  showError,
  showWarning,
  showInfo,
  showConfirm,
  handleApiError,
} from '@/lib/utils/toast';

/** 입고 항목 인터페이스 */
interface ReceiveItem {
  no: number;
  boxNo: string;
  itemCode: string;
  itemName: string;
  qty: number;
  receiveDate: string;
  selected: boolean;
}

/** API 응답 인터페이스 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export default function MaterialReceiveCancelPage() {
  const { saupj, userId, setForm } = useAuthStore();
  const [warehouse, setWarehouse] = useState('');
  const [fromDate, setFromDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [itemList, setItemList] = useState<ReceiveItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => { setForm('HSJ210', '자재입고취소'); }, [setForm]);

  /** 입고 내역 조회 */
  const handleSearch = async () => {
    if (!warehouse) {
      showWarning('창고를 선택하세요.');
      return;
    }

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        whsCode: warehouse,
        fromDate: fromDate,
        toDate: toDate,
      });
      const response = await fetch(`/api/material/receive?${params}`);
      const result: ApiResponse<ReceiveItem[]> = await response.json();

      if (result.success && result.data) {
        setItemList(result.data.map((item, idx) => ({ ...item, no: idx + 1, selected: false })));
        if (result.data.length === 0) {
          showInfo('조회 결과가 없습니다.');
        }
      } else {
        showError(result.error || '조회 실패');
        setItemList([]);
      }
    } catch (err) {
      console.error('조회 오류:', err);
      handleApiError(err, '조회 중 오류가 발생했습니다.');
      setItemList([]);
    } finally {
      setIsLoading(false);
    }
  };

  /** 전체 선택/해제 */
  const handleSelectAll = (checked: boolean) => {
    setItemList(prev => prev.map(item => ({ ...item, selected: checked })));
  };

  /** 항목 선택 */
  const handleSelect = (idx: number, checked: boolean) => {
    setItemList(prev => prev.map((item, i) => i === idx ? { ...item, selected: checked } : item));
  };

  /** 입고 취소 */
  const handleCancel = async () => {
    const selected = itemList.filter(i => i.selected);
    if (selected.length === 0) {
      showWarning('취소할 항목을 선택하세요.');
      return;
    }

    const confirmed = await showConfirm(`${selected.length}건을 취소하시겠습니까?`);
    if (!confirmed) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/material/receive-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saupj: saupj || '10',
          whsCode: warehouse,
          items: selected.map(item => ({
            boxNo: item.boxNo,
            itemCode: item.itemCode,
            qty: item.qty,
            receiveDate: item.receiveDate,
          })),
          userId: userId || 'SYSTEM',
        }),
      });

      const result: ApiResponse<{ count: number }> = await response.json();

      if (result.success) {
        showSuccess(result.message || `${selected.length}건 취소 처리되었습니다.`);
        // 취소된 항목 제거 및 번호 재정렬
        setItemList(prev => prev.filter(i => !i.selected).map((item, i) => ({ ...item, no: i + 1 })));
      } else {
        showError(result.error || '취소 실패');
      }
    } catch (err) {
      console.error('취소 오류:', err);
      handleApiError(err, '취소 처리 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 선택된 항목 수
  const selectedCount = itemList.filter(i => i.selected).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <Undo2 className="mr-2 h-5 w-5" />
            조회 조건
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <WarehouseSelect
            value={warehouse}
            onChange={setWarehouse}
            label="창고"
          />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>시작일</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>종료일</Label>
              <Input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
              />
            </div>
          </div>
          <Button
            onClick={handleSearch}
            disabled={isLoading}
            className="w-full"
          >
            <Search className="mr-2 h-4 w-4" />
            조회
          </Button>
        </CardContent>
      </Card>

      {itemList.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">입고 내역 ({itemList.length}건)</CardTitle>
              {selectedCount > 0 && (
                <span className="text-sm text-blue-600">선택: {selectedCount}건</span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-64 overflow-auto rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={itemList.length > 0 && itemList.every(i => i.selected)}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>BOX NO</TableHead>
                    <TableHead>품목</TableHead>
                    <TableHead className="text-right">수량</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemList.map((item, idx) => (
                    <TableRow
                      key={`${item.boxNo}-${item.receiveDate}`}
                      className={item.selected ? 'bg-blue-50' : ''}
                    >
                      <TableCell>
                        <Checkbox
                          checked={item.selected}
                          onCheckedChange={(c) => handleSelect(idx, c as boolean)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">{item.boxNo}</TableCell>
                      <TableCell>
                        <div className="text-sm">{item.itemCode}</div>
                        <div className="text-xs text-gray-500">{item.itemName}</div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatNumber(item.qty)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Button
              onClick={handleCancel}
              variant="destructive"
              disabled={isLoading || selectedCount === 0}
              className="w-full"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              선택 취소 ({selectedCount}건)
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
