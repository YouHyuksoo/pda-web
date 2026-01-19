/**
 * @file src/app/(main)/material/receive/page.tsx
 * @description
 * 자재입고 페이지 (HSJ200 대체)
 * 창고에 자재를 입고 처리합니다.
 *
 * 초보자 가이드:
 * 1. 입고창고 선택
 * 2. 바코드 스캔하여 입고 항목 등록
 * 3. 저장 버튼으로 입고 완료
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Save, Trash2, PackagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

/** 입고 항목 인터페이스 */
interface ReceiveItem {
  no: number;
  boxNo: string;
  itemCode: string;
  itemName: string;
  qty: number;
  lotNo?: string;
}

/** API 응답 인터페이스 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export default function MaterialReceivePage() {
  const { saupj, userId, setForm } = useAuthStore();
  const [warehouse, setWarehouse] = useState('');
  const [receiveDate, setReceiveDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [itemList, setItemList] = useState<ReceiveItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => { setForm('HSJ200', '자재입고'); }, [setForm]);

  /** 바코드 스캔 처리 */
  const handleBarcodeScan = useCallback(async (barcode: string) => {
    if (!warehouse) {
      showWarning('창고를 선택하세요.');
      return;
    }
    if (itemList.some(i => i.boxNo === barcode)) {
      showScanError('이미 등록된 BOX입니다.');
      return;
    }

    try {
      // API로 바코드 정보 조회 (재고 없어도 됨 - 신규 입고)
      const params = new URLSearchParams({ boxNo: barcode });
      const response = await fetch(`/api/material/barcode?${params}`);
      const result: ApiResponse<{
        boxNo: string;
        itemCode: string;
        itemName: string;
        qty: number;
        lotNo?: string;
      }> = await response.json();

      let newItem: ReceiveItem;

      if (result.success && result.data) {
        // 기존 재고 정보가 있는 경우
        newItem = {
          no: itemList.length + 1,
          boxNo: result.data.boxNo,
          itemCode: result.data.itemCode,
          itemName: result.data.itemName || '',
          qty: result.data.qty,
          lotNo: result.data.lotNo || '',
        };
      } else {
        // 신규 바코드 (수량 입력 필요)
        newItem = {
          no: itemList.length + 1,
          boxNo: barcode,
          itemCode: '',
          itemName: '',
          qty: 1,
          lotNo: '',
        };
      }

      setItemList(prev => [...prev, newItem]);
      showScanSuccess(`${barcode} 추가`);
    } catch (err) {
      console.error('바코드 조회 오류:', err);
      // 오류 발생해도 신규로 등록 가능
      const newItem: ReceiveItem = {
        no: itemList.length + 1,
        boxNo: barcode,
        itemCode: '',
        itemName: '',
        qty: 1,
      };
      setItemList(prev => [...prev, newItem]);
      showScanSuccess(`${barcode} 신규 추가`);
    }
  }, [warehouse, itemList]);

  /** 항목 삭제 */
  const handleDelete = (idx: number) => {
    setItemList(prev => prev.filter((_, i) => i !== idx).map((item, i) => ({ ...item, no: i + 1 })));
  };

  /** 수량 변경 */
  const handleQtyChange = (idx: number, qty: number) => {
    setItemList(prev => prev.map((item, i) => i === idx ? { ...item, qty } : item));
  };

  /** 저장 */
  const handleSave = async () => {
    if (itemList.length === 0) {
      showWarning('입고할 항목이 없습니다.');
      return;
    }

    const confirmed = await showConfirm(`${itemList.length}건을 입고 처리하시겠습니까?`);
    if (!confirmed) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/material/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saupj: saupj || '10',
          receiveDate: receiveDate,
          whsCode: warehouse,
          items: itemList.map(item => ({
            boxNo: item.boxNo,
            itemCode: item.itemCode,
            qty: item.qty,
            lotNo: item.lotNo || '',
          })),
          userId: userId || 'SYSTEM',
        }),
      });

      const result: ApiResponse<{ count: number }> = await response.json();

      if (result.success) {
        showSuccess(result.message || `${itemList.length}건 입고 처리되었습니다.`);
        setItemList([]);
      } else {
        showError(result.error || '저장 실패');
      }
    } catch (err) {
      console.error('저장 오류:', err);
      handleApiError(err, '저장 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 총 수량 계산
  const totalQty = itemList.reduce((acc, item) => acc + item.qty, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <PackagePlus className="mr-2 h-5 w-5" />
            입고 정보
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <WarehouseSelect
            value={warehouse}
            onChange={setWarehouse}
            label="입고창고"
          />
          <div className="space-y-2">
            <Label>입고일자</Label>
            <Input
              type="date"
              value={receiveDate}
              onChange={e => setReceiveDate(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">바코드 스캔</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <BarcodeInput
            label="BOX NO"
            placeholder="바코드를 스캔하세요"
            onScan={handleBarcodeScan}
            autoFocus
            disabled={!warehouse}
          />
          {!warehouse && (
            <p className="text-sm text-orange-500">* 창고를 먼저 선택하세요.</p>
          )}
        </CardContent>
      </Card>

      {itemList.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">입고 목록 ({itemList.length}건)</CardTitle>
              <span className="text-sm text-gray-500">합계: {formatNumber(totalQty)}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-64 overflow-auto rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">No</TableHead>
                    <TableHead>BOX NO</TableHead>
                    <TableHead>품목</TableHead>
                    <TableHead className="text-right w-20">수량</TableHead>
                    <TableHead className="w-12">삭제</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemList.map((item, idx) => (
                    <TableRow key={item.boxNo}>
                      <TableCell>{item.no}</TableCell>
                      <TableCell className="font-mono text-sm">{item.boxNo}</TableCell>
                      <TableCell>
                        <div className="text-sm">{item.itemCode || '-'}</div>
                        <div className="text-xs text-gray-500">{item.itemName}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          value={item.qty}
                          onChange={e => handleQtyChange(idx, parseInt(e.target.value) || 0)}
                          className="w-16 h-8 text-right"
                          min={1}
                        />
                      </TableCell>
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
            <Button
              onClick={handleSave}
              disabled={isLoading}
              className="w-full"
            >
              <Save className="mr-2 h-4 w-4" />
              저장 ({itemList.length}건)
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
