/**
 * @file src/app/(main)/shipment/process/page.tsx
 * @description
 * 출하처리 페이지입니다. (HS400 대체)
 * BOX 단위로 출하 처리를 합니다.
 *
 * 초보자 가이드:
 * 1. **출하일자 선택**: 출하 처리할 날짜 선택
 * 2. **바코드 스캔**: 출하할 BOX 바코드 스캔
 * 3. **저장**: 출하 처리 (SP_PMB215_PER_BOX 프로시저 호출)
 *
 * 주요 테이블:
 * - PMB215: 출하 BOX 정보
 * - PMC100: 출하 상세 정보
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Save, Trash2, RefreshCw, Truck, Package } from 'lucide-react';

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
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

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

// 출하 BOX 타입
interface ShipmentBox {
  no: number;
  boxNo: string;
  itemCode: string;
  itemName: string;
  qty: number;
  custCode: string;
  custName: string;
  status: 'pending' | 'shipped';
}

/** 기본 출하 창고 코드 */
const DEFAULT_WHS_CODE = 'Z01';

export default function ShipmentProcessPage() {
  const { saupj, userId, setForm } = useAuthStore();

  // 상태 관리
  const [shipDate, setShipDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isLoading, setIsLoading] = useState(false);

  // 출하 목록
  const [shipmentList, setShipmentList] = useState<ShipmentBox[]>([]);
  const [totalQty, setTotalQty] = useState(0);
  const [totalBoxes, setTotalBoxes] = useState(0);

  // 페이지 로드 시 화면 정보 설정
  useEffect(() => {
    setForm('HS400', '출하처리');
  }, [setForm]);

  // 통계 계산
  useEffect(() => {
    const qty = shipmentList.reduce((acc, item) => acc + item.qty, 0);
    setTotalQty(qty);
    setTotalBoxes(shipmentList.length);
  }, [shipmentList]);

  // 바코드 스캔 처리
  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      if (!barcode) {
        showWarning('바코드를 입력하세요.');
        return;
      }

      // 중복 체크
      const isDuplicate = shipmentList.some((item) => item.boxNo === barcode);
      if (isDuplicate) {
        showScanError('이미 등록된 BOX입니다.');
        return;
      }

      try {
        // 실제 API 연동 - BOX 정보 조회
        const params = new URLSearchParams({
          boxNo: barcode,
          whsCode: DEFAULT_WHS_CODE,
        });
        const response = await fetch(`/api/shipment/box?${params}`);
        const result: ApiResponse<{
          boxNo: string;
          itemCode: string;
          qty: number;
          whsCode: string;
        }[]> = await response.json();

        if (!result.success || !result.data || result.data.length === 0) {
          showScanError(result.error || '해당 BOX를 찾을 수 없습니다.');
          return;
        }

        // 조회된 BOX 항목 추가
        const newItems = result.data.map((item, idx) => ({
          no: shipmentList.length + idx + 1,
          boxNo: item.boxNo,
          itemCode: item.itemCode,
          itemName: '', // API에서 품명 없음
          qty: item.qty,
          custCode: '',
          custName: '',
          status: 'pending' as const,
        }));

        setShipmentList((prev) => [...prev, ...newItems]);

        // 스캔 성공 피드백
        showScanSuccess(`${newItems.length}건 추가`);
      } catch (error) {
        console.error('바코드 처리 오류:', error);
        showScanError('해당 BOX를 찾을 수 없습니다.');
      }
    },
    [shipmentList]
  );

  // 항목 삭제
  const handleDeleteItem = (index: number) => {
    setShipmentList((prev) => {
      const newList = prev.filter((_, i) => i !== index);
      return newList.map((item, i) => ({ ...item, no: i + 1 }));
    });
  };

  // 저장 (출하 처리)
  const handleSave = async () => {
    if (shipmentList.length === 0) {
      showWarning('출하할 BOX가 없습니다.');
      return;
    }

    const confirmed = await showConfirm(
      `${shipmentList.length}개의 BOX를 출하 처리하시겠습니까?`,
      { description: `총 수량: ${formatNumber(totalQty)}` }
    );
    if (!confirmed) return;

    setIsLoading(true);

    try {
      // 실제 API 연동
      const wkDate = shipDate.replace(/-/g, '');
      const response = await fetch('/api/shipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saupj: saupj || '10',
          wkDate: wkDate,
          chasu: 1, // 차수는 기본 1로 설정
          custCode: '',
          destCode: 'OUT', // 기본 출고처
          outType: 'S', // 일반 출고
          carNo: '',
          items: shipmentList
            .filter((item) => item.status === 'pending')
            .map((item) => ({
              boxNo: item.boxNo,
              itemCode: item.itemCode,
              whsCode: DEFAULT_WHS_CODE,
              outQty: item.qty,
            })),
          userId: userId || 'SYSTEM',
        }),
      });

      const result: ApiResponse<{ count: number }> = await response.json();

      if (!result.success) {
        showError(result.error || '출하 처리 실패');
        return;
      }

      // 성공 처리
      setShipmentList((prev) =>
        prev.map((item) => ({ ...item, status: 'shipped' as const }))
      );

      showSuccess(
        result.message || `출하 처리 완료! (BOX: ${totalBoxes}개, 수량: ${formatNumber(totalQty)})`
      );

      // 목록 초기화
      setShipmentList([]);
    } catch (error) {
      console.error('출하 처리 오류:', error);
      handleApiError(error, '출하 처리 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 초기화
  const handleReset = async () => {
    if (shipmentList.length > 0) {
      const confirmed = await showConfirm('등록된 내용이 삭제됩니다. 계속하시겠습니까?');
      if (!confirmed) return;
    }
    setShipmentList([]);
  };

  return (
    <div className="space-y-4">
      {/* 출하 정보 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <Truck className="mr-2 h-5 w-5" />
            출하 정보
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>출하일자</Label>
            <Input
              type="date"
              value={shipDate}
              onChange={(e) => setShipDate(e.target.value)}
            />
          </div>

          {/* 요약 정보 */}
          <div className="grid grid-cols-2 gap-4 rounded bg-blue-50 p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{totalBoxes}</div>
              <div className="text-sm text-gray-500">BOX</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {formatNumber(totalQty)}
              </div>
              <div className="text-sm text-gray-500">총 수량</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 바코드 입력 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <Package className="mr-2 h-5 w-5" />
            BOX 스캔
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BarcodeInput
            label="BOX NO"
            placeholder="출하할 BOX 바코드를 스캔하세요"
            onScan={handleBarcodeScan}
            autoFocus
          />
        </CardContent>
      </Card>

      {/* 출하 목록 */}
      {shipmentList.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              출하 목록 ({shipmentList.length}건)
            </CardTitle>
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
                  {shipmentList.map((item, index) => (
                    <TableRow
                      key={item.boxNo}
                      className={item.status === 'shipped' ? 'bg-green-50' : ''}
                    >
                      <TableCell>{item.no}</TableCell>
                      <TableCell className="font-mono">{item.boxNo}</TableCell>
                      <TableCell>
                        <div className="text-sm">{item.itemCode}</div>
                        <div className="text-xs text-gray-500">{item.custName}</div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatNumber(item.qty)}
                      </TableCell>
                      <TableCell>
                        {item.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500"
                            onClick={() => handleDeleteItem(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                        {item.status === 'shipped' && (
                          <Badge variant="default" className="text-xs">
                            완료
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Separator />

            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={isLoading || shipmentList.every((i) => i.status === 'shipped')}
                className="flex-1"
              >
                <Save className="mr-2 h-4 w-4" />
                출하처리 ({shipmentList.filter((i) => i.status === 'pending').length}건)
              </Button>
              <Button variant="outline" onClick={handleReset}>
                <RefreshCw className="mr-2 h-4 w-4" />
                초기화
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
