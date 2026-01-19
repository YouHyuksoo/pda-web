/**
 * @file src/app/(main)/shipment/cancel/page.tsx
 * @description
 * 출하취소 페이지입니다. (HS430 대체)
 * 출하된 내역을 조회하고 취소 처리합니다.
 *
 * 초보자 가이드:
 * 1. **기간 선택**: 조회 기간 설정
 * 2. **조회**: 출하 내역 조회
 * 3. **선택**: 취소할 항목 선택
 * 4. **출하 취소**: 선택한 항목 취소 처리
 */

'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Search, Undo2, Trash2 } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { useAuthStore } from '@/stores/auth-store';
import { formatNumber } from '@/lib/utils/string';
import {
  showSuccess,
  showError,
  showWarning,
  showConfirm,
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

/** 출하 항목 타입 */
interface ShippedItem {
  no: number;
  sno: string;
  shipNo: string;
  boxNo: string;
  itemCode: string;
  itemName: string;
  qty: number;
  shipDate: string;
  customer: string;
  selected: boolean;
}

export default function ShipmentCancelPage() {
  const { userId, setForm } = useAuthStore();
  const [fromDate, setFromDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [shipNo, setShipNo] = useState('');
  const [itemList, setItemList] = useState<ShippedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setForm('HS430', '출하취소');
  }, [setForm]);

  // 출하 내역 조회
  const handleSearch = async () => {
    setIsLoading(true);

    try {
      const params = new URLSearchParams({
        fromDate,
        toDate,
      });
      if (shipNo) {
        params.append('shipNo', shipNo);
      }

      const response = await fetch(`/api/shipment/cancel?${params}`);
      const result: ApiResponse<Omit<ShippedItem, 'selected'>[]> =
        await response.json();

      if (result.success && result.data) {
        setItemList(result.data.map((item) => ({ ...item, selected: false })));
        if (result.data.length === 0) {
          showInfo('조회 결과가 없습니다.');
        }
      } else {
        showError(result.error || '조회 실패');
        setItemList([]);
      }
    } catch (err) {
      console.error('출하 내역 조회 오류:', err);
      handleApiError(err, '출하 내역 조회 중 오류가 발생했습니다.');
      setItemList([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 전체 선택
  const handleSelectAll = (checked: boolean) => {
    setItemList((prev) => prev.map((item) => ({ ...item, selected: checked })));
  };

  // 개별 선택
  const handleSelect = (idx: number, checked: boolean) => {
    setItemList((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, selected: checked } : item))
    );
  };

  // 출하 취소
  const handleCancel = async () => {
    const selected = itemList.filter((i) => i.selected);
    if (selected.length === 0) {
      showWarning('취소할 항목을 선택하세요.');
      return;
    }

    const confirmed = await showConfirm(
      `${selected.length}건의 출하를 취소하시겠습니까?`,
      { description: '이 작업은 되돌릴 수 없습니다.' }
    );
    if (!confirmed) return;

    setIsLoading(true);

    try {
      const response = await fetch('/api/shipment/cancel', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: selected.map((item) => ({
            sno: item.sno,
            boxNo: item.boxNo,
            itemCode: item.itemCode,
            qty: item.qty,
          })),
          userId: userId || 'SYSTEM',
        }),
      });

      const result: ApiResponse<{ count: number }> = await response.json();

      if (result.success) {
        showSuccess(result.message || '출하가 취소되었습니다.');
        // 목록에서 취소된 항목 제거
        setItemList((prev) =>
          prev
            .filter((i) => !i.selected)
            .map((item, i) => ({ ...item, no: i + 1 }))
        );
      } else {
        showError(result.error || '출하 취소 실패');
      }
    } catch (err) {
      console.error('출하 취소 오류:', err);
      handleApiError(err, '출하 취소 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedCount = itemList.filter((i) => i.selected).length;

  return (
    <div className="space-y-4">
      {/* 조회 조건 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <Undo2 className="mr-2 h-5 w-5" />
            조회 조건
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
          <div className="space-y-2">
            <Label>출하번호</Label>
            <Input
              value={shipNo}
              onChange={(e) => setShipNo(e.target.value)}
              placeholder="출하번호 (선택)"
            />
          </div>
          <Button onClick={handleSearch} disabled={isLoading} className="w-full">
            <Search className="mr-2 h-4 w-4" />
            조회
          </Button>
        </CardContent>
      </Card>

      {/* 출하 내역 */}
      {itemList.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              출하 내역 ({itemList.length}건)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-64 overflow-auto rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={
                          itemList.length > 0 && itemList.every((i) => i.selected)
                        }
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>출하번호</TableHead>
                    <TableHead>BOX</TableHead>
                    <TableHead>품목</TableHead>
                    <TableHead className="text-right">수량</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemList.map((item, idx) => (
                    <TableRow
                      key={`${item.sno}-${item.boxNo}`}
                      className={item.selected ? 'bg-red-50' : ''}
                    >
                      <TableCell>
                        <Checkbox
                          checked={item.selected}
                          onCheckedChange={(c) => handleSelect(idx, c as boolean)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-xs">{item.shipNo}</div>
                        <div className="text-xs text-gray-500">{item.customer}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{item.boxNo}</TableCell>
                      <TableCell className="text-xs">{item.itemCode}</TableCell>
                      <TableCell className="text-right">
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
              className="w-full"
              disabled={isLoading || selectedCount === 0}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              출하 취소 ({selectedCount}건)
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
