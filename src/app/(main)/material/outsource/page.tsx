/**
 * @file src/app/(main)/material/outsource/page.tsx
 * @description
 * 외주출고 페이지 (HS100 대체)
 * 외주업체로 자재를 출고 처리합니다.
 *
 * 초보자 가이드:
 * 1. 출고창고 및 외주업체 선택
 * 2. 바코드 스캔하여 출고 항목 등록
 * 3. 저장 버튼으로 외주출고 완료
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Truck, Save, Trash2, Search } from 'lucide-react';
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
  showInfo,
  showConfirm,
  showScanSuccess,
  showScanError,
  handleApiError,
} from '@/lib/utils/toast';

/** 외주출고 항목 인터페이스 */
interface OutsourceItem {
  no: number;
  boxNo: string;
  itemCode: string;
  itemName: string;
  qty: number;
  vendor: string;
}

/** 업체 정보 인터페이스 */
interface Vendor {
  vendorCode: string;
  vendorName: string;
  telNo?: string;
  addr?: string;
}

/** API 응답 인터페이스 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export default function MaterialOutsourcePage() {
  const { saupj, userId, setForm } = useAuthStore();
  const [warehouse, setWarehouse] = useState('');
  const [vendorCode, setVendorCode] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [vendorKeyword, setVendorKeyword] = useState('');
  const [vendorList, setVendorList] = useState<Vendor[]>([]);
  const [showVendorSearch, setShowVendorSearch] = useState(false);
  const [itemList, setItemList] = useState<OutsourceItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => { setForm('HS100', '외주출고'); }, [setForm]);

  /** 업체 검색 */
  const handleVendorSearch = async () => {
    try {
      const params = new URLSearchParams({ keyword: vendorKeyword });
      const response = await fetch(`/api/material/outsource?${params}`);
      const result: ApiResponse<Vendor[]> = await response.json();

      if (result.success && result.data) {
        setVendorList(result.data);
        setShowVendorSearch(true);
        if (result.data.length === 0) {
          showInfo('검색 결과가 없습니다.');
        }
      } else {
        showError(result.error || '업체 조회 실패');
      }
    } catch (err) {
      console.error('업체 조회 오류:', err);
      handleApiError(err, '업체 조회 중 오류가 발생했습니다.');
    }
  };

  /** 업체 선택 */
  const handleVendorSelect = (vendor: Vendor) => {
    setVendorCode(vendor.vendorCode);
    setVendorName(vendor.vendorName);
    setShowVendorSearch(false);
    setVendorKeyword('');
  };

  /** 바코드 스캔 처리 */
  const handleBarcodeScan = useCallback(async (barcode: string) => {
    if (!warehouse) {
      showWarning('창고를 선택하세요.');
      return;
    }
    if (!vendorCode) {
      showWarning('업체를 선택하세요.');
      return;
    }
    if (itemList.some(i => i.boxNo === barcode)) {
      showScanError('이미 등록된 BOX입니다.');
      return;
    }

    try {
      // API로 바코드 재고 정보 조회
      const params = new URLSearchParams({ boxNo: barcode, whsCode: warehouse });
      const response = await fetch(`/api/material/barcode?${params}`);
      const result: ApiResponse<{
        boxNo: string;
        itemCode: string;
        itemName: string;
        qty: number;
      }> = await response.json();

      if (!result.success || !result.data) {
        showScanError(result.error || '해당 바코드의 재고를 찾을 수 없습니다.');
        return;
      }

      const newItem: OutsourceItem = {
        no: itemList.length + 1,
        boxNo: result.data.boxNo,
        itemCode: result.data.itemCode,
        itemName: result.data.itemName || '',
        qty: result.data.qty,
        vendor: vendorCode,
      };

      setItemList(prev => [...prev, newItem]);
      showScanSuccess(`${result.data.itemCode} (${formatNumber(result.data.qty)})`);
    } catch (err) {
      console.error('바코드 조회 오류:', err);
      showScanError('바코드 조회 중 오류가 발생했습니다.');
    }
  }, [warehouse, vendorCode, itemList]);

  /** 항목 삭제 */
  const handleDelete = (idx: number) => {
    setItemList(prev => prev.filter((_, i) => i !== idx).map((item, i) => ({ ...item, no: i + 1 })));
  };

  /** 저장 */
  const handleSave = async () => {
    if (itemList.length === 0) {
      showWarning('출고할 항목이 없습니다.');
      return;
    }

    const confirmed = await showConfirm(
      `${itemList.length}건을 외주출고 하시겠습니까?`,
      { description: `업체: ${vendorName}` }
    );
    if (!confirmed) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/material/outsource', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saupj: saupj || '10',
          whsCode: warehouse,
          vendorCode: vendorCode,
          items: itemList.map(item => ({
            boxNo: item.boxNo,
            itemCode: item.itemCode,
            qty: item.qty,
          })),
          userId: userId || 'SYSTEM',
        }),
      });

      const result: ApiResponse<{ count: number }> = await response.json();

      if (result.success) {
        showSuccess(result.message || `${itemList.length}건 외주출고 처리되었습니다.`);
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
            <Truck className="mr-2 h-5 w-5" />
            외주출고 정보
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <WarehouseSelect
            value={warehouse}
            onChange={setWarehouse}
            label="출고창고"
          />
          <div className="space-y-2">
            <Label>외주업체</Label>
            <div className="flex gap-2">
              <Input
                value={vendorName ? `[${vendorCode}] ${vendorName}` : ''}
                readOnly
                placeholder="업체 선택"
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowVendorSearch(!showVendorSearch)}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* 업체 검색 패널 */}
          {showVendorSearch && (
            <div className="rounded border p-3 space-y-3 bg-gray-50">
              <div className="flex gap-2">
                <Input
                  value={vendorKeyword}
                  onChange={e => setVendorKeyword(e.target.value)}
                  placeholder="업체코드/업체명 검색"
                  className="flex-1"
                  onKeyDown={e => e.key === 'Enter' && handleVendorSearch()}
                />
                <Button variant="outline" onClick={handleVendorSearch}>
                  검색
                </Button>
              </div>
              {vendorList.length > 0 && (
                <div className="max-h-32 overflow-auto rounded border bg-white">
                  {vendorList.map(vendor => (
                    <div
                      key={vendor.vendorCode}
                      className="p-2 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
                      onClick={() => handleVendorSelect(vendor)}
                    >
                      <div className="font-medium">[{vendor.vendorCode}] {vendor.vendorName}</div>
                      {vendor.telNo && (
                        <div className="text-xs text-gray-500">{vendor.telNo}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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
            disabled={!warehouse || !vendorCode}
          />
          {(!warehouse || !vendorCode) && (
            <p className="text-sm text-orange-500">* 창고와 업체를 먼저 선택하세요.</p>
          )}
        </CardContent>
      </Card>

      {itemList.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">외주출고 목록 ({itemList.length}건)</CardTitle>
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
                    <TableHead className="text-right">수량</TableHead>
                    <TableHead className="w-12">삭제</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemList.map((item, idx) => (
                    <TableRow key={item.boxNo}>
                      <TableCell>{item.no}</TableCell>
                      <TableCell className="font-mono text-sm">{item.boxNo}</TableCell>
                      <TableCell>
                        <div className="text-sm">{item.itemCode}</div>
                        <div className="text-xs text-gray-500">{item.itemName}</div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatNumber(item.qty)}
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
