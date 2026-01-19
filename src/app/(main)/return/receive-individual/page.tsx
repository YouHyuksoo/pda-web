/**
 * @file src/app/(main)/return/receive-individual/page.tsx
 * @description
 * 반품개별입고 페이지입니다. (HS510 대체)
 * 시리얼 단위로 반품입고 처리를 합니다.
 *
 * 초보자 가이드:
 * 1. **입고창고 선택**: 반품 입고할 창고 선택
 * 2. **반품사유 선택**: 반품 사유 선택
 * 3. **상태 선택**: 제품 상태 선택 (양품/수리필요/폐기)
 * 4. **시리얼 스캔**: 반품할 시리얼 바코드 스캔
 * 5. **반품입고**: 저장 버튼 클릭
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Save, Trash2, RotateCcw } from 'lucide-react';
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

/** 반품 항목 타입 */
interface ReturnItem {
  no: number;
  serialNo: string;
  itemCode: string;
  itemName: string;
  reason: string;
  condition: string;
}

/** 반품 사유 목록 */
const RETURN_REASONS = [
  { code: 'DEFECT', name: '불량' },
  { code: 'DAMAGE', name: '파손' },
  { code: 'WRONG', name: '오배송' },
  { code: 'CANCEL', name: '주문취소' },
];

/** 상태 목록 */
const CONDITIONS = [
  { code: 'GOOD', name: '양품' },
  { code: 'REPAIR', name: '수리필요' },
  { code: 'SCRAP', name: '폐기' },
];

export default function ReturnReceiveIndividualPage() {
  const { saupj, userId, setForm } = useAuthStore();
  const [warehouse, setWarehouse] = useState('');
  const [reason, setReason] = useState('');
  const [condition, setCondition] = useState('');
  const [remark, setRemark] = useState('');
  const [itemList, setItemList] = useState<ReturnItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setForm('HS510', '반품개별입고');
  }, [setForm]);

  // 바코드 스캔 처리
  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      if (!warehouse) {
        showWarning('창고를 선택하세요.');
        return;
      }
      if (!reason) {
        showWarning('반품사유를 선택하세요.');
        return;
      }
      if (!condition) {
        showWarning('상태를 선택하세요.');
        return;
      }
      if (itemList.some((i) => i.serialNo === barcode)) {
        showScanError('이미 등록된 시리얼입니다.');
        return;
      }

      try {
        // 시리얼 정보 조회
        const params = new URLSearchParams({ serialNo: barcode });
        const response = await fetch(`/api/return/individual?${params}`);
        const result: ApiResponse<{
          serialNo: string;
          itemCode: string;
          itemName: string;
        }> = await response.json();

        if (result.success && result.data) {
          const reasonName =
            RETURN_REASONS.find((r) => r.code === reason)?.name || '';
          const conditionName =
            CONDITIONS.find((c) => c.code === condition)?.name || '';

          setItemList((prev) => [
            ...prev,
            {
              no: prev.length + 1,
              serialNo: result.data!.serialNo,
              itemCode: result.data!.itemCode,
              itemName: result.data!.itemName,
              reason: reasonName,
              condition: conditionName,
            },
          ]);
          showScanSuccess(`${barcode} 추가`);
        } else {
          showScanError(result.error || '해당 시리얼을 찾을 수 없습니다.');
        }
      } catch (err) {
        console.error('시리얼 조회 오류:', err);
        showScanError('시리얼 조회 중 오류가 발생했습니다.');
      }
    },
    [warehouse, reason, condition, itemList]
  );

  // 항목 삭제
  const handleDelete = (idx: number) => {
    setItemList((prev) =>
      prev.filter((_, i) => i !== idx).map((item, i) => ({ ...item, no: i + 1 }))
    );
  };

  // 저장
  const handleSave = async () => {
    if (itemList.length === 0) {
      showWarning('입고할 항목이 없습니다.');
      return;
    }

    const confirmed = await showConfirm(
      `${itemList.length}건을 반품입고 하시겠습니까?`
    );
    if (!confirmed) return;

    setIsLoading(true);

    try {
      const response = await fetch('/api/return/individual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saupj: saupj || '10',
          whsCode: warehouse,
          reason,
          condition,
          remark,
          items: itemList.map((item) => ({
            serialNo: item.serialNo,
            itemCode: item.itemCode,
          })),
          userId: userId || 'SYSTEM',
        }),
      });

      const result: ApiResponse<{ count: number }> = await response.json();

      if (result.success) {
        showSuccess(result.message || '반품입고 처리되었습니다.');
        setItemList([]);
        setRemark('');
      } else {
        showError(result.error || '저장 실패');
      }
    } catch (err) {
      console.error('반품입고 저장 오류:', err);
      handleApiError(err, '반품입고 저장 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 반품 정보 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <RotateCcw className="mr-2 h-5 w-5" />
            반품 정보
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <WarehouseSelect
            value={warehouse}
            onChange={setWarehouse}
            label="입고창고"
          />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>반품사유</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  {RETURN_REASONS.map((r) => (
                    <SelectItem key={r.code} value={r.code}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>상태</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger>
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>비고</Label>
            <Textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="추가 설명"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* 시리얼 스캔 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">시리얼 스캔</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <BarcodeInput
            label="시리얼 NO"
            onScan={handleBarcodeScan}
            autoFocus
            disabled={!warehouse || !reason || !condition}
          />

          {itemList.length > 0 && (
            <>
              <div className="text-sm">총 {itemList.length}건</div>

              <div className="max-h-48 overflow-auto rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">No</TableHead>
                      <TableHead>시리얼</TableHead>
                      <TableHead>품목</TableHead>
                      <TableHead>사유</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemList.map((item, idx) => (
                      <TableRow
                        key={item.serialNo}
                        className={
                          item.condition === '폐기'
                            ? 'bg-red-50'
                            : item.condition === '수리필요'
                            ? 'bg-yellow-50'
                            : ''
                        }
                      >
                        <TableCell>{item.no}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {item.serialNo}
                        </TableCell>
                        <TableCell className="text-xs">{item.itemCode}</TableCell>
                        <TableCell className="text-xs">{item.reason}</TableCell>
                        <TableCell className="text-xs">{item.condition}</TableCell>
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
                반품입고 ({itemList.length}건)
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
