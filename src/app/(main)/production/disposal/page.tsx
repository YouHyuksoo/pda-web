/**
 * @file src/app/(main)/production/disposal/page.tsx
 * @description
 * 폐기처리 페이지입니다. (HS606 대체)
 * 재고를 폐기 처리합니다.
 *
 * 초보자 가이드:
 * 1. **창고 선택**: 폐기할 재고가 있는 창고 선택
 * 2. **폐기사유 선택**: 폐기 사유 선택
 * 3. **바코드 스캔**: 폐기할 항목 바코드 스캔
 * 4. **폐기 처리**: 폐기 버튼으로 처리 (복구 불가)
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trash, Trash2, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

/** 폐기 항목 타입 */
interface DisposalItem {
  no: number;
  boxNo: string;
  itemCode: string;
  itemName: string;
  qty: number;
  reason: string;
}

/** API 응답 인터페이스 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

/** 폐기 사유 목록 */
const DISPOSAL_REASONS = [
  { code: 'EXPIRE', name: '유효기간 만료' },
  { code: 'DEFECT', name: '불량' },
  { code: 'DAMAGE', name: '파손' },
  { code: 'OTHER', name: '기타' },
];

export default function DisposalPage() {
  const { saupj, userId, setForm } = useAuthStore();

  // 상태 관리
  const [warehouse, setWarehouse] = useState('');
  const [reason, setReason] = useState('');
  const [remark, setRemark] = useState('');
  const [itemList, setItemList] = useState<DisposalItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 페이지 로드 시 화면 정보 설정
  useEffect(() => {
    setForm('HS606', '폐기처리');
  }, [setForm]);

  // 총 수량 계산
  const totalQty = itemList.reduce((acc, item) => acc + item.qty, 0);

  // 바코드 스캔 처리
  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      if (!warehouse) {
        showWarning('창고를 선택하세요.');
        return;
      }

      if (!reason) {
        showWarning('폐기사유를 선택하세요.');
        return;
      }

      if (!barcode) {
        showWarning('바코드를 입력하세요.');
        return;
      }

      // 중복 체크
      if (itemList.some((item) => item.boxNo === barcode)) {
        showScanError('이미 등록된 항목입니다.');
        return;
      }

      try {
        // API로 바코드 정보 조회
        const params = new URLSearchParams({
          boxNo: barcode,
          whsCode: warehouse,
        });
        const response = await fetch(`/api/material/stock/box?${params}`);
        const result: ApiResponse<{ boxNo: string; itemCode: string; itemName: string; qty: number }> = await response.json();

        let itemCode = '';
        let itemName = '자재';
        let qty = 1;

        if (result.success && result.data) {
          itemCode = result.data.itemCode || '';
          itemName = result.data.itemName || '자재';
          qty = result.data.qty || 1;
        }

        const reasonName = DISPOSAL_REASONS.find((r) => r.code === reason)?.name || '';

        // 폐기 항목 추가
        const newItem: DisposalItem = {
          no: itemList.length + 1,
          boxNo: barcode,
          itemCode,
          itemName,
          qty,
          reason: reasonName,
        };

        setItemList((prev) => [...prev, newItem]);
        showScanSuccess(`${barcode} 추가 (${qty}EA)`);
      } catch (err) {
        console.error('바코드 처리 오류:', err);
        // 오류가 나도 기본값으로 등록
        const reasonName = DISPOSAL_REASONS.find((r) => r.code === reason)?.name || '';
        const newItem: DisposalItem = {
          no: itemList.length + 1,
          boxNo: barcode,
          itemCode: '',
          itemName: '자재',
          qty: 1,
          reason: reasonName,
        };
        setItemList((prev) => [...prev, newItem]);
        showScanSuccess(`${barcode} 추가`);
      }
    },
    [warehouse, reason, itemList]
  );

  // 항목 삭제
  const handleDelete = (idx: number) => {
    setItemList((prev) => {
      const newList = prev.filter((_, i) => i !== idx);
      return newList.map((item, i) => ({ ...item, no: i + 1 }));
    });
  };

  // 폐기 처리
  const handleSave = async () => {
    if (itemList.length === 0) {
      showWarning('폐기할 항목이 없습니다.');
      return;
    }

    const confirmed = await showConfirm(
      `${itemList.length}건을 폐기 처리하시겠습니까?`,
      { description: `총 수량: ${formatNumber(totalQty)}\n이 작업은 되돌릴 수 없습니다.` }
    );
    if (!confirmed) return;

    setIsLoading(true);

    try {
      const response = await fetch('/api/production/disposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saupj: saupj || '10',
          whsCode: warehouse,
          reason,
          remark,
          items: itemList.map((item) => ({
            boxNo: item.boxNo,
            itemCode: item.itemCode,
            qty: item.qty,
          })),
          userId: userId || 'SYSTEM',
        }),
      });

      const result: ApiResponse<{ count: number; totalQty: number }> = await response.json();

      if (result.success) {
        showSuccess(result.message || `${itemList.length}건 폐기 처리되었습니다.`);
        setItemList([]);
        setRemark('');
      } else {
        showError(result.error || '폐기 처리 실패');
      }
    } catch (err) {
      console.error('폐기 처리 오류:', err);
      handleApiError(err, '폐기 처리 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 폐기 정보 */}
      <Card className="border-red-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base text-red-600">
            <Trash className="mr-2 h-5 w-5" />
            폐기 정보
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 p-2 bg-red-50 rounded text-sm text-red-600">
            <AlertTriangle className="h-4 w-4" />
            <span>폐기 처리된 항목은 복구할 수 없습니다.</span>
          </div>

          <WarehouseSelect value={warehouse} onChange={setWarehouse} label="창고" />

          <div className="space-y-2">
            <Label>폐기사유</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="폐기사유 선택" />
              </SelectTrigger>
              <SelectContent>
                {DISPOSAL_REASONS.map((r) => (
                  <SelectItem key={r.code} value={r.code}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>비고</Label>
            <Textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="추가 설명 (선택사항)"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* 바코드 스캔 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">바코드 스캔</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <BarcodeInput
            placeholder="폐기할 항목 바코드 스캔"
            onScan={handleBarcodeScan}
            autoFocus
            disabled={!warehouse || !reason}
          />

          {/* 폐기 목록 */}
          {itemList.length > 0 && (
            <>
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-red-600">폐기 목록 ({itemList.length}건)</Label>
                <span className="text-sm text-red-600">
                  합계: {formatNumber(totalQty)}
                </span>
              </div>
              <div className="max-h-48 overflow-auto rounded border border-red-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">No</TableHead>
                      <TableHead>BOX</TableHead>
                      <TableHead>품목</TableHead>
                      <TableHead className="text-right">수량</TableHead>
                      <TableHead>사유</TableHead>
                      <TableHead className="w-12">삭제</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemList.map((item, idx) => (
                      <TableRow key={item.boxNo} className="bg-red-50">
                        <TableCell>{item.no}</TableCell>
                        <TableCell className="font-mono text-xs">{item.boxNo}</TableCell>
                        <TableCell className="text-xs">{item.itemCode}</TableCell>
                        <TableCell className="text-right">
                          {formatNumber(item.qty)}
                        </TableCell>
                        <TableCell className="text-xs">{item.reason}</TableCell>
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

              {/* 폐기 버튼 */}
              <Button
                onClick={handleSave}
                variant="destructive"
                disabled={itemList.length === 0 || isLoading}
                className="w-full"
              >
                <Trash className="mr-2 h-4 w-4" />
                폐기 처리 ({itemList.length}건)
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
