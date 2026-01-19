/**
 * @file src/app/(main)/shipment/process-detail/page.tsx
 * @description
 * 출하처리상세 페이지입니다. (HS410 대체)
 * 출하번호 기준으로 출하 처리합니다.
 *
 * 초보자 가이드:
 * 1. **출하번호 입력**: 출하번호 입력 후 조회
 * 2. **BOX 스캔**: 각 품목별로 BOX 바코드 스캔
 * 3. **출하 완료**: 모든 스캔 후 저장
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Search, Save, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { BarcodeInput } from '@/components/forms/BarcodeInput';
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

/** 출하주문 타입 */
interface ShipOrder {
  shipNo: string;
  customer: string;
  orderDate: string;
  items: ShipItem[];
}

/** 출하품목 타입 */
interface ShipItem {
  no: number;
  itemCode: string;
  itemName: string;
  orderQty: number;
  scannedQty: number;
  boxList: string[];
}

export default function ShipmentProcessDetailPage() {
  const { saupj, userId, setForm } = useAuthStore();
  const [shipNo, setShipNo] = useState('');
  const [shipOrder, setShipOrder] = useState<ShipOrder | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setForm('HS410', '출하처리상세');
  }, [setForm]);

  // 출하주문 조회
  const handleSearch = async () => {
    if (!shipNo) {
      showWarning('출하번호를 입력하세요.');
      return;
    }

    setIsLoading(true);

    try {
      const params = new URLSearchParams({ shipNo });
      const response = await fetch(`/api/shipment/order?${params}`);
      const result: ApiResponse<ShipOrder> = await response.json();

      if (result.success && result.data) {
        setShipOrder(result.data);
      } else {
        showError(result.error || '출하주문 조회 실패');
        setShipOrder(null);
      }
    } catch (err) {
      console.error('출하주문 조회 오류:', err);
      handleApiError(err, '출하주문 조회 중 오류가 발생했습니다.');
      setShipOrder(null);
    } finally {
      setIsLoading(false);
    }
  };

  // 바코드 스캔 처리
  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      if (!shipOrder) return;

      // 이미 스캔된 BOX 확인
      const duplicateIdx = shipOrder.items.findIndex((item) =>
        item.boxList.includes(barcode)
      );
      if (duplicateIdx >= 0) {
        showScanError('이미 스캔된 BOX입니다.');
        return;
      }

      // 아직 수량이 남은 품목 찾기
      const itemIdx = shipOrder.items.findIndex(
        (item) => item.scannedQty < item.orderQty
      );
      if (itemIdx < 0) {
        showWarning('모든 품목의 수량이 완료되었습니다.');
        return;
      }

      // BOX 추가
      setShipOrder((prev) => {
        if (!prev) return null;
        const newItems = [...prev.items];
        newItems[itemIdx] = {
          ...newItems[itemIdx],
          scannedQty: newItems[itemIdx].scannedQty + 1,
          boxList: [...newItems[itemIdx].boxList, barcode],
        };
        return { ...prev, items: newItems };
      });

      showScanSuccess(`${barcode} 추가`);
    },
    [shipOrder]
  );

  // BOX 삭제
  const handleRemoveBox = (itemIdx: number, boxNo: string) => {
    setShipOrder((prev) => {
      if (!prev) return null;
      const newItems = [...prev.items];
      newItems[itemIdx] = {
        ...newItems[itemIdx],
        scannedQty: newItems[itemIdx].scannedQty - 1,
        boxList: newItems[itemIdx].boxList.filter((b) => b !== boxNo),
      };
      return { ...prev, items: newItems };
    });
  };

  // 저장
  const handleSave = async () => {
    if (!shipOrder) return;

    const totalScanned = shipOrder.items.reduce((acc, i) => acc + i.scannedQty, 0);
    if (totalScanned === 0) {
      showWarning('스캔된 BOX가 없습니다.');
      return;
    }

    const incomplete = shipOrder.items.filter((i) => i.scannedQty < i.orderQty);
    const confirmMsg =
      incomplete.length > 0
        ? `미완료 품목이 ${incomplete.length}건 있습니다. 저장하시겠습니까?`
        : `${totalScanned}건을 출하 처리하시겠습니까?`;

    const confirmed = await showConfirm(confirmMsg);
    if (!confirmed) return;

    setIsLoading(true);

    try {
      const response = await fetch('/api/shipment/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saupj: saupj || '10',
          shipNo: shipOrder.shipNo,
          items: shipOrder.items.map((item) => ({
            itemCode: item.itemCode,
            boxList: item.boxList,
          })),
          userId: userId || 'SYSTEM',
        }),
      });

      const result: ApiResponse<{ count: number }> = await response.json();

      if (result.success) {
        showSuccess(result.message || `${totalScanned}건 출하 처리되었습니다.`);
        setShipOrder(null);
        setShipNo('');
      } else {
        showError(result.error || '저장 실패');
      }
    } catch (err) {
      console.error('출하 저장 오류:', err);
      handleApiError(err, '출하 저장 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const totalOrder = shipOrder?.items.reduce((acc, i) => acc + i.orderQty, 0) || 0;
  const totalScanned = shipOrder?.items.reduce((acc, i) => acc + i.scannedQty, 0) || 0;

  return (
    <div className="space-y-4">
      {/* 출하 조회 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <Package className="mr-2 h-5 w-5" />
            출하 조회
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>출하번호</Label>
            <Input
              value={shipNo}
              onChange={(e) => setShipNo(e.target.value)}
              placeholder="출하번호 입력"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <Button onClick={handleSearch} disabled={isLoading} className="w-full">
            <Search className="mr-2 h-4 w-4" />
            조회
          </Button>
        </CardContent>
      </Card>

      {shipOrder && (
        <>
          {/* 출하 정보 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span>출하 정보</span>
                <Badge variant={totalScanned === totalOrder ? 'default' : 'secondary'}>
                  {totalScanned}/{totalOrder}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-blue-50 p-4 space-y-1 mb-4">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">출하번호</span>
                  <span className="font-mono">{shipOrder.shipNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">고객</span>
                  <span>{shipOrder.customer}</span>
                </div>
              </div>
              <BarcodeInput label="BOX 바코드" onScan={handleBarcodeScan} autoFocus />
            </CardContent>
          </Card>

          {/* 출하 품목 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">출하 품목</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {shipOrder.items.map((item, itemIdx) => (
                <div
                  key={item.no}
                  className={`rounded-lg border p-3 ${
                    item.scannedQty === item.orderQty
                      ? 'bg-green-50 border-green-300'
                      : ''
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-medium">{item.itemCode}</div>
                      <div className="text-xs text-gray-500">{item.itemName}</div>
                    </div>
                    <Badge
                      variant={
                        item.scannedQty === item.orderQty ? 'default' : 'secondary'
                      }
                    >
                      {item.scannedQty}/{item.orderQty}
                    </Badge>
                  </div>
                  {item.boxList.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.boxList.map((box) => (
                        <Badge
                          key={box}
                          variant="outline"
                          className="cursor-pointer"
                          onClick={() => handleRemoveBox(itemIdx, box)}
                        >
                          {box} ×
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <Button onClick={handleSave} disabled={isLoading} className="w-full">
                <Save className="mr-2 h-4 w-4" />
                출하 완료
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
