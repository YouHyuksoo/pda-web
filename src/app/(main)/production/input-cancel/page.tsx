/**
 * @file src/app/(main)/production/input-cancel/page.tsx
 * @description
 * 생산투입취소 페이지입니다. (HS609 대체)
 * 투입된 자재를 취소 처리합니다.
 *
 * 초보자 가이드:
 * 1. **공정/라인 선택**: 취소할 공정과 라인 선택
 * 2. **조회**: 투입 내역 조회
 * 3. **항목 선택**: 취소할 항목 체크박스 선택
 * 4. **취소**: 선택된 항목 취소 처리
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

import { ProcessSelect, LineSelect } from '@/components/forms/ProcessLineSelect';
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

/** 투입 항목 타입 */
interface InputItem {
  no: number;
  boxNo: string;
  itemCode: string;
  itemName: string;
  qty: number;
  inputTime: string;
  workOrder: string;
  selected: boolean;
}

/** API 응답 인터페이스 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export default function ProductionInputCancelPage() {
  const { opcode, linecode, userId, setForm } = useAuthStore();

  // 상태 관리
  const [processCode, setProcessCode] = useState(opcode || '');
  const [lineCode, setLineCode] = useState(linecode || '');
  const [workDate, setWorkDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [itemList, setItemList] = useState<InputItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 페이지 로드 시 화면 정보 설정
  useEffect(() => {
    setForm('HS609', '생산투입취소');
  }, [setForm]);

  // 선택된 항목 수
  const selectedCount = itemList.filter((item) => item.selected).length;
  const selectedQty = itemList
    .filter((item) => item.selected)
    .reduce((acc, item) => acc + item.qty, 0);

  // 투입 내역 조회
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
      const response = await fetch(`/api/production/input-cancel?${params}`);
      const result: ApiResponse<InputItem[]> = await response.json();

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
      console.error('조회 오류:', err);
      handleApiError(err, '조회 중 오류가 발생했습니다.');
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

  // 취소 처리
  const handleCancel = async () => {
    const selected = itemList.filter((item) => item.selected);
    if (selected.length === 0) {
      showWarning('취소할 항목을 선택하세요.');
      return;
    }

    const confirmed = await showConfirm(
      `${selected.length}건의 투입을 취소하시겠습니까?`,
      { description: `총 수량: ${formatNumber(selectedQty)}` }
    );
    if (!confirmed) return;

    setIsLoading(true);

    try {
      const response = await fetch('/api/production/input-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processCode,
          lineCode,
          items: selected.map((item) => ({
            boxNo: item.boxNo,
            qty: item.qty,
          })),
          userId: userId || 'SYSTEM',
        }),
      });

      const result: ApiResponse<{ count: number }> = await response.json();

      if (result.success) {
        showSuccess(result.message || `${selected.length}건 취소되었습니다.`);
        handleSearch(); // 새로고침
      } else {
        showError(result.error || '취소 실패');
      }
    } catch (err) {
      console.error('취소 오류:', err);
      handleApiError(err, '취소 중 오류가 발생했습니다.');
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
            <Undo2 className="mr-2 h-5 w-5" />
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

      {/* 투입 내역 */}
      {itemList.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              투입 내역 ({itemList.length}건)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-64 overflow-auto rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={itemList.length > 0 && itemList.every((i) => i.selected)}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>BOX</TableHead>
                    <TableHead>품목</TableHead>
                    <TableHead className="text-right">수량</TableHead>
                    <TableHead>시간</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemList.map((item, idx) => (
                    <TableRow
                      key={item.boxNo}
                      className={item.selected ? 'bg-red-50' : ''}
                    >
                      <TableCell>
                        <Checkbox
                          checked={item.selected}
                          onCheckedChange={(c) => handleSelect(idx, c as boolean)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{item.boxNo}</TableCell>
                      <TableCell>
                        <div className="text-xs">{item.itemCode}</div>
                        <div className="text-xs text-gray-500">{item.itemName}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(item.qty)}
                      </TableCell>
                      <TableCell className="text-xs">{item.inputTime}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* 취소 버튼 */}
            <Button
              onClick={handleCancel}
              variant="destructive"
              disabled={selectedCount === 0 || isLoading}
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
