/**
 * @file src/app/(main)/repack/basic/page.tsx
 * @description
 * 재포장 페이지입니다. (HS300 대체)
 * 기존 BOX를 분리하여 새 BOX로 재포장합니다.
 *
 * 초보자 가이드:
 * 1. **원본 BOX 스캔**: 재포장할 원본 BOX 바코드 스캔
 * 2. **새 BOX 등록**: 새 BOX NO와 수량 입력 후 추가
 * 3. **재포장 완료**: 모든 등록 후 저장
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Package2, Save, Trash2, ArrowRight } from 'lucide-react';
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

/** API 응답 인터페이스 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

/** 원본 BOX 타입 */
interface SourceBox {
  boxNo: string;
  itemCode: string;
  itemName: string;
  qty: number;
  whsCode: string;
}

/** 재포장 항목 타입 */
interface RepackItem {
  no: number;
  sourceBoxNo: string;
  newBoxNo: string;
  qty: number;
}

export default function RepackBasicPage() {
  const { saupj, userId, setForm } = useAuthStore();
  const [sourceBox, setSourceBox] = useState<SourceBox | null>(null);
  const [newBoxNo, setNewBoxNo] = useState('');
  const [repackQty, setRepackQty] = useState('');
  const [repackList, setRepackList] = useState<RepackItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setForm('HS300', '재포장');
  }, [setForm]);

  // 원본 BOX 스캔
  const handleSourceScan = useCallback(
    async (barcode: string) => {
      try {
        const params = new URLSearchParams({ boxNo: barcode });
        const response = await fetch(`/api/repack?${params}`);
        const result: ApiResponse<SourceBox> = await response.json();

        if (result.success && result.data) {
          setSourceBox(result.data);
          setRepackList([]);
          showScanSuccess(`${barcode} 조회 완료`);
        } else {
          showScanError(result.error || '해당 BOX를 찾을 수 없습니다.');
          setSourceBox(null);
        }
      } catch (err) {
        console.error('BOX 조회 오류:', err);
        showScanError('BOX 조회 중 오류가 발생했습니다.');
      }
    },
    []
  );

  // 재포장 추가
  const handleAddRepack = () => {
    if (!sourceBox) {
      showWarning('원본 BOX를 스캔하세요.');
      return;
    }
    if (!newBoxNo) {
      showWarning('새 BOX NO를 입력하세요.');
      return;
    }
    if (!repackQty) {
      showWarning('수량을 입력하세요.');
      return;
    }

    const qty = parseInt(repackQty);
    if (isNaN(qty) || qty <= 0) {
      showWarning('올바른 수량을 입력하세요.');
      return;
    }

    const usedQty = repackList
      .filter((r) => r.sourceBoxNo === sourceBox.boxNo)
      .reduce((acc, r) => acc + r.qty, 0);

    if (usedQty + qty > sourceBox.qty) {
      showWarning('원본 수량을 초과합니다.');
      return;
    }

    if (repackList.some((r) => r.newBoxNo === newBoxNo)) {
      showWarning('이미 등록된 BOX NO입니다.');
      return;
    }

    setRepackList((prev) => [
      ...prev,
      { no: prev.length + 1, sourceBoxNo: sourceBox.boxNo, newBoxNo, qty },
    ]);
    setNewBoxNo('');
    setRepackQty('');
  };

  // 항목 삭제
  const handleDelete = (idx: number) => {
    setRepackList((prev) =>
      prev.filter((_, i) => i !== idx).map((item, i) => ({ ...item, no: i + 1 }))
    );
  };

  // 저장
  const handleSave = async () => {
    if (repackList.length === 0) {
      showWarning('재포장할 항목이 없습니다.');
      return;
    }

    const confirmed = await showConfirm(
      `${repackList.length}건을 재포장 하시겠습니까?`
    );
    if (!confirmed) return;

    setIsLoading(true);

    try {
      const response = await fetch('/api/repack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saupj: saupj || '10',
          sourceBox,
          repackList,
          userId: userId || 'SYSTEM',
        }),
      });

      const result: ApiResponse<{ count: number }> = await response.json();

      if (result.success) {
        showSuccess(result.message || '재포장 처리되었습니다.');
        setRepackList([]);
        setSourceBox(null);
      } else {
        showError(result.error || '재포장 실패');
      }
    } catch (err) {
      console.error('재포장 저장 오류:', err);
      handleApiError(err, '재포장 저장 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const usedQty = sourceBox
    ? repackList
        .filter((r) => r.sourceBoxNo === sourceBox.boxNo)
        .reduce((acc, r) => acc + r.qty, 0)
    : 0;
  const remainQty = sourceBox ? sourceBox.qty - usedQty : 0;

  return (
    <div className="space-y-4">
      {/* 원본 BOX */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <Package2 className="mr-2 h-5 w-5" />
            원본 BOX
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <BarcodeInput
            label="원본 BOX 스캔"
            onScan={handleSourceScan}
            autoFocus
          />

          {sourceBox && (
            <div className="rounded-lg bg-blue-50 p-4 space-y-1">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">BOX NO</span>
                <span className="font-mono">{sourceBox.boxNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">품목</span>
                <span>
                  {sourceBox.itemCode} - {sourceBox.itemName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">총 수량</span>
                <span className="font-bold">{formatNumber(sourceBox.qty)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">잔여 수량</span>
                <span className="font-bold text-blue-600">
                  {formatNumber(remainQty)}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 재포장 등록 */}
      {sourceBox && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">재포장 등록</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>새 BOX NO</Label>
                <Input
                  value={newBoxNo}
                  onChange={(e) => setNewBoxNo(e.target.value)}
                  placeholder="새 BOX NO"
                />
              </div>
              <div className="space-y-2">
                <Label>수량</Label>
                <Input
                  type="number"
                  value={repackQty}
                  onChange={(e) => setRepackQty(e.target.value)}
                  placeholder="수량"
                  max={remainQty}
                />
              </div>
            </div>

            <Button
              onClick={handleAddRepack}
              variant="outline"
              className="w-full"
              disabled={remainQty <= 0}
            >
              추가
            </Button>

            {repackList.length > 0 && (
              <>
                <div className="max-h-48 overflow-auto rounded border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">No</TableHead>
                        <TableHead>원본</TableHead>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>새 BOX</TableHead>
                        <TableHead className="text-right">수량</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {repackList.map((item, idx) => (
                        <TableRow key={item.newBoxNo}>
                          <TableCell>{item.no}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {item.sourceBoxNo}
                          </TableCell>
                          <TableCell>
                            <ArrowRight className="h-4 w-4 text-gray-400" />
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {item.newBoxNo}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(item.qty)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(idx)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
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
                  재포장 완료 ({repackList.length}건)
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
