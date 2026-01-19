/**
 * @file src/app/(main)/return/receive/page.tsx
 * @description
 * 반품입고 페이지입니다. (HS500 대체)
 * BOX 단위로 반품입고 처리를 합니다.
 *
 * 초보자 가이드:
 * 1. **입고창고 선택**: 반품 입고할 창고 선택
 * 2. **반품사유 선택**: 반품 사유 선택
 * 3. **BOX 스캔**: 반품할 BOX 바코드 스캔
 * 4. **반품입고**: 저장 버튼 클릭
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Save, Trash2, RotateCcw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
  boxNo: string;
  itemCode: string;
  itemName: string;
  qty: number;
  reason: string;
}

/** 반품 사유 목록 */
const RETURN_REASONS = [
  { code: 'DEFECT', name: '불량' },
  { code: 'DAMAGE', name: '파손' },
  { code: 'WRONG', name: '오배송' },
  { code: 'CANCEL', name: '주문취소' },
  { code: 'OTHER', name: '기타' },
];

export default function ReturnReceivePage() {
  const { saupj, userId, setForm } = useAuthStore();
  const [warehouse, setWarehouse] = useState('');
  const [customerCode, setCustomerCode] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [reason, setReason] = useState('');
  const [remark, setRemark] = useState('');
  const [itemList, setItemList] = useState<ReturnItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setForm('HS500', '반품입고');
  }, [setForm]);

  // 고객 검색 (임시)
  const handleCustomerSearch = () => {
    // TODO: 고객 검색 팝업 구현
    setCustomerCode('C001');
    setCustomerName('고객사A');
  };

  // 바코드 스캔 처리
  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      if (!warehouse) {
        showWarning('창고를 선택하세요.');
        return;
      }
      if (!customerCode) {
        showWarning('고객을 선택하세요.');
        return;
      }
      if (!reason) {
        showWarning('반품사유를 선택하세요.');
        return;
      }
      if (itemList.some((i) => i.boxNo === barcode)) {
        showScanError('이미 등록된 BOX입니다.');
        return;
      }

      try {
        // BOX 정보 조회
        const params = new URLSearchParams({ boxNo: barcode });
        const response = await fetch(`/api/return?${params}`);
        const result: ApiResponse<{
          boxNo: string;
          itemCode: string;
          itemName: string;
          qty: number;
        }> = await response.json();

        if (result.success && result.data) {
          const reasonName =
            RETURN_REASONS.find((r) => r.code === reason)?.name || '';
          setItemList((prev) => [
            ...prev,
            {
              no: prev.length + 1,
              boxNo: result.data!.boxNo,
              itemCode: result.data!.itemCode,
              itemName: result.data!.itemName,
              qty: result.data!.qty,
              reason: reasonName,
            },
          ]);
          showScanSuccess(`${barcode} 추가`);
        } else {
          showScanError(result.error || '해당 BOX를 찾을 수 없습니다.');
        }
      } catch (err) {
        console.error('BOX 조회 오류:', err);
        showScanError('BOX 조회 중 오류가 발생했습니다.');
      }
    },
    [warehouse, customerCode, reason, itemList]
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

    const totalQty = itemList.reduce((acc, i) => acc + i.qty, 0);
    const confirmed = await showConfirm(
      `${itemList.length}건을 반품입고 하시겠습니까?`,
      { description: `총 수량: ${formatNumber(totalQty)}` }
    );
    if (!confirmed) return;

    setIsLoading(true);

    try {
      const response = await fetch('/api/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saupj: saupj || '10',
          returnDate: new Date().toISOString().slice(0, 10),
          returnWhsCode: warehouse,
          destCode: 'OUT',
          custCode: customerCode,
          items: itemList.map((item) => ({
            boxNo: item.boxNo,
            itemCode: item.itemCode,
            qty: item.qty,
            gubun: reason === 'DEFECT' || reason === 'DAMAGE' ? 'N' : 'Y',
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

  const totalQty = itemList.reduce((acc, i) => acc + i.qty, 0);

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
          <div className="space-y-2">
            <Label>고객</Label>
            <div className="flex gap-2">
              <Input
                value={customerName ? `[${customerCode}] ${customerName}` : ''}
                readOnly
                placeholder="고객 선택"
              />
              <Button variant="outline" size="icon" onClick={handleCustomerSearch}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>반품사유</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="반품사유 선택" />
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

      {/* BOX 스캔 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">BOX 스캔</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <BarcodeInput
            onScan={handleBarcodeScan}
            autoFocus
            disabled={!warehouse || !customerCode || !reason}
          />

          {itemList.length > 0 && (
            <>
              <div className="flex justify-between items-center text-sm">
                <span>총 {itemList.length}건</span>
                <span className="font-bold">합계: {formatNumber(totalQty)} EA</span>
              </div>

              <div className="max-h-48 overflow-auto rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">No</TableHead>
                      <TableHead>BOX</TableHead>
                      <TableHead>품목</TableHead>
                      <TableHead className="text-right">수량</TableHead>
                      <TableHead>사유</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemList.map((item, idx) => (
                      <TableRow key={item.boxNo}>
                        <TableCell>{item.no}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {item.boxNo}
                        </TableCell>
                        <TableCell className="text-xs">{item.itemCode}</TableCell>
                        <TableCell className="text-right">
                          {formatNumber(item.qty)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{item.reason}</Badge>
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
                반품입고 ({itemList.length}건)
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
