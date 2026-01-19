/**
 * @file src/app/(main)/material/issue-slip/page.tsx
 * @description 자재불출(전표O) 페이지 (HSJ100 대체)
 *
 * 초보자 가이드:
 * 1. 전표번호 입력 후 조회 버튼 클릭
 * 2. 바코드 스캔하여 불출 항목 등록
 * 3. 저장 버튼으로 불출 완료
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Save, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BarcodeInput } from '@/components/forms/BarcodeInput';
import { WarehouseSelect } from '@/components/forms/WarehouseSelect';
import { useAuthStore } from '@/stores/auth-store';
import {
  showSuccess,
  showError,
  showWarning,
  showInfo,
  handleApiError,
} from '@/lib/utils/toast';

/**
 * 전표 품목 인터페이스
 */
interface SlipItem {
  no: number;
  slipNo: string;
  itemCode: string;
  itemName: string;
  reqQty: number;
  issueQty: number;
  boxNo: string;
}

/**
 * API 응답 인터페이스
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export default function MaterialIssueSlipPage() {
  const { setForm, userId } = useAuthStore();
  const [slipNo, setSlipNo] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [slipList, setSlipList] = useState<SlipItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => { setForm('HSJ100', '자재불출(전표O)'); }, [setForm]);

  /**
   * 전표 조회 (API 호출)
   */
  const handleSearch = async () => {
    if (!slipNo) { showWarning('전표번호를 입력하세요.'); return; }
    setIsLoading(true);

    try {
      // API 호출
      const response = await fetch(`/api/material/issue-slip?slipNo=${encodeURIComponent(slipNo)}`);
      const result: ApiResponse<SlipItem[]> = await response.json();

      if (result.success && result.data) {
        setSlipList(result.data);
        if (result.data.length === 0) {
          showInfo('조회 결과가 없습니다.');
        }
      } else {
        showError(result.error || '조회 실패');
        setSlipList([]);
      }
    } catch (err) {
      console.error('전표 조회 오류:', err);
      handleApiError(err, '전표 조회 중 오류가 발생했습니다.');
      setSlipList([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBarcodeScan = useCallback((barcode: string) => {
    setSlipList(prev => prev.map((item, idx) =>
      idx === prev.findIndex(i => !i.boxNo) ? { ...item, boxNo: barcode, issueQty: item.reqQty } : item
    ));
  }, []);

  /**
   * 불출 저장 (API 호출)
   */
  const handleSave = async () => {
    const issued = slipList.filter(i => i.boxNo);
    if (issued.length === 0) { showWarning('불출할 항목이 없습니다.'); return; }
    if (!warehouse) { showWarning('창고를 선택하세요.'); return; }

    setIsLoading(true);
    try {
      // API 호출
      const response = await fetch('/api/material/issue-slip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slipNo,
          warehouseCode: warehouse,
          items: issued.map(item => ({
            itemCode: item.itemCode,
            issueQty: item.issueQty,
            boxNo: item.boxNo,
          })),
          userId: userId || 'SYSTEM',
        }),
      });

      const result: ApiResponse<{ count: number }> = await response.json();

      if (result.success) {
        showSuccess(result.message || `${issued.length}건 저장되었습니다.`);
        setSlipList([]);
        setSlipNo('');
      } else {
        showError(result.error || '저장 실패');
      }
    } catch (err) {
      console.error('불출 저장 오류:', err);
      handleApiError(err, '저장 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base"><FileText className="mr-2 h-5 w-5" />전표 조회</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>전표번호</Label>
              <Input value={slipNo} onChange={e => setSlipNo(e.target.value)} placeholder="전표번호 입력" />
            </div>
            <WarehouseSelect value={warehouse} onChange={setWarehouse} label="창고" />
          </div>
          <Button onClick={handleSearch} disabled={isLoading} className="w-full">
            <Search className="mr-2 h-4 w-4" />조회
          </Button>
        </CardContent>
      </Card>

      {slipList.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">불출 목록</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <BarcodeInput label="바코드" onScan={handleBarcodeScan} autoFocus />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>품목</TableHead>
                  <TableHead className="text-right">요청</TableHead>
                  <TableHead className="text-right">불출</TableHead>
                  <TableHead>BOX</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slipList.map(item => (
                  <TableRow key={item.no} className={item.boxNo ? 'bg-green-50' : ''}>
                    <TableCell>{item.itemCode}<br/><span className="text-xs text-gray-500">{item.itemName}</span></TableCell>
                    <TableCell className="text-right">{item.reqQty}</TableCell>
                    <TableCell className="text-right"><Badge>{item.issueQty}</Badge></TableCell>
                    <TableCell className="font-mono text-sm">{item.boxNo || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button onClick={handleSave} className="w-full"><Save className="mr-2 h-4 w-4" />저장</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
