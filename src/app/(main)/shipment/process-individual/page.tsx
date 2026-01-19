/**
 * @file src/app/(main)/shipment/process-individual/page.tsx
 * @description
 * 출하개별처리 페이지입니다. (HS420 대체)
 * 고객별 개별 출하 처리를 수행합니다.
 *
 * 초보자 가이드:
 * 1. **고객 선택**: 출하 대상 고객 선택
 * 2. **BOX 스캔**: 출하할 BOX 바코드 스캔
 * 3. **출하 처리**: 저장 버튼 클릭
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Save, Trash2, PackageCheck, Search } from 'lucide-react';
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

/** 출하 항목 타입 */
interface ShipItem {
  no: number;
  boxNo: string;
  itemCode: string;
  itemName: string;
  qty: number;
  customer: string;
}

/** 기본 출하 창고 코드 */
const DEFAULT_WHS_CODE = 'Z01';

export default function ShipmentProcessIndividualPage() {
  const { saupj, userId, setForm } = useAuthStore();
  const [customerCode, setCustomerCode] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [shipDate, setShipDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [itemList, setItemList] = useState<ShipItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setForm('HS420', '출하개별처리');
  }, [setForm]);

  // 고객 검색 (임시 - 실제로는 팝업 구현)
  const handleCustomerSearch = () => {
    // TODO: 고객 검색 팝업 구현
    setCustomerCode('C001');
    setCustomerName('고객사A');
  };

  // 바코드 스캔 처리
  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      if (!customerCode) {
        showWarning('고객을 선택하세요.');
        return;
      }

      if (itemList.some((i) => i.boxNo === barcode)) {
        showScanError('이미 등록된 BOX입니다.');
        return;
      }

      try {
        // BOX 정보 조회
        const params = new URLSearchParams({
          boxNo: barcode,
          whsCode: DEFAULT_WHS_CODE,
        });
        const response = await fetch(`/api/shipment/box?${params}`);
        const result: ApiResponse<
          { boxNo: string; itemCode: string; qty: number }[]
        > = await response.json();

        if (!result.success || !result.data || result.data.length === 0) {
          showScanError(result.error || '해당 BOX를 찾을 수 없습니다.');
          return;
        }

        // 조회된 BOX 추가
        const boxData = result.data[0];
        setItemList((prev) => [
          ...prev,
          {
            no: prev.length + 1,
            boxNo: boxData.boxNo,
            itemCode: boxData.itemCode,
            itemName: '',
            qty: boxData.qty,
            customer: customerCode,
          },
        ]);

        showScanSuccess(`${barcode} 추가`);
      } catch (err) {
        console.error('BOX 조회 오류:', err);
        showScanError('BOX 조회 중 오류가 발생했습니다.');
      }
    },
    [customerCode, itemList]
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
      showWarning('출하할 항목이 없습니다.');
      return;
    }

    const confirmed = await showConfirm(
      `${itemList.length}건을 출하 처리하시겠습니까?`,
      { description: `총 수량: ${formatNumber(totalQty)}` }
    );
    if (!confirmed) return;

    setIsLoading(true);

    try {
      const wkDate = shipDate.replace(/-/g, '');
      const response = await fetch('/api/shipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saupj: saupj || '10',
          wkDate,
          chasu: 1,
          custCode: customerCode,
          destCode: 'OUT',
          outType: 'S',
          carNo: '',
          items: itemList.map((item) => ({
            boxNo: item.boxNo,
            itemCode: item.itemCode,
            whsCode: DEFAULT_WHS_CODE,
            outQty: item.qty,
          })),
          userId: userId || 'SYSTEM',
        }),
      });

      const result: ApiResponse<{ count: number }> = await response.json();

      if (result.success) {
        showSuccess(result.message || '출하 처리되었습니다.');
        setItemList([]);
      } else {
        showError(result.error || '저장 실패');
      }
    } catch (err) {
      console.error('출하 저장 오류:', err);
      handleApiError(err, '출하 처리 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const totalQty = itemList.reduce((acc, i) => acc + i.qty, 0);

  return (
    <div className="space-y-4">
      {/* 출하 정보 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <PackageCheck className="mr-2 h-5 w-5" />
            출하 정보
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
            <Label>출하일자</Label>
            <Input
              type="date"
              value={shipDate}
              onChange={(e) => setShipDate(e.target.value)}
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
            disabled={!customerCode}
          />

          {itemList.length > 0 && (
            <>
              <div className="flex justify-between items-center text-sm">
                <span>총 {itemList.length}건</span>
                <span className="font-bold">합계: {formatNumber(totalQty)} EA</span>
              </div>

              <div className="max-h-64 overflow-auto rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">No</TableHead>
                      <TableHead>BOX</TableHead>
                      <TableHead>품목</TableHead>
                      <TableHead className="text-right">수량</TableHead>
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
                출하 처리 ({itemList.length}건)
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
