/**
 * @file src/app/(main)/repack/individual/page.tsx
 * @description
 * 개별재포장 페이지입니다. (HS310 대체)
 * 시리얼 단위로 재포장 처리합니다.
 *
 * 초보자 가이드:
 * 1. **기존 시리얼 스캔**: 재포장할 기존 시리얼 바코드 스캔
 * 2. **새 시리얼 스캔**: 새 시리얼 바코드 스캔
 * 3. **저장**: 재포장 완료
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { PackageOpen, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

/** 재포장 항목 타입 */
interface RepackItem {
  no: number;
  oldSerialNo: string;
  newSerialNo: string;
  itemCode: string;
  status: 'scanned' | 'complete';
}

export default function RepackIndividualPage() {
  const { saupj, userId, setForm } = useAuthStore();
  const [scanMode, setScanMode] = useState<'old' | 'new'>('old');
  const [currentOldSerial, setCurrentOldSerial] = useState('');
  const [currentItemCode, setCurrentItemCode] = useState('');
  const [repackList, setRepackList] = useState<RepackItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setForm('HS310', '개별재포장');
  }, [setForm]);

  // 바코드 스캔 처리
  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      if (scanMode === 'old') {
        // 기존 시리얼 스캔
        if (repackList.some((r) => r.oldSerialNo === barcode)) {
          showWarning('이미 등록된 시리얼입니다.');
          return;
        }

        try {
          const params = new URLSearchParams({ serialNo: barcode });
          const response = await fetch(`/api/repack/individual?${params}`);
          const result: ApiResponse<{
            serialNo: string;
            itemCode: string;
            itemName: string;
          }> = await response.json();

          if (result.success && result.data) {
            setCurrentOldSerial(result.data.serialNo);
            setCurrentItemCode(result.data.itemCode);
            setScanMode('new');
            showScanSuccess(`${barcode} 조회 완료`);
          } else {
            showScanError(result.error || '시리얼 조회 실패');
          }
        } catch (err) {
          console.error('시리얼 조회 오류:', err);
          showScanError('시리얼 조회 중 오류가 발생했습니다.');
        }
      } else {
        // 새 시리얼 스캔
        if (repackList.some((r) => r.newSerialNo === barcode)) {
          showWarning('이미 사용된 새 시리얼입니다.');
          return;
        }
        if (barcode === currentOldSerial) {
          showWarning('기존 시리얼과 동일합니다.');
          return;
        }

        setRepackList((prev) => [
          ...prev,
          {
            no: prev.length + 1,
            oldSerialNo: currentOldSerial,
            newSerialNo: barcode,
            itemCode: currentItemCode,
            status: 'complete',
          },
        ]);
        setCurrentOldSerial('');
        setCurrentItemCode('');
        setScanMode('old');
        showScanSuccess('재포장 항목 등록 완료');
      }
    },
    [scanMode, currentOldSerial, currentItemCode, repackList]
  );

  // 취소 (새 시리얼 스캔 취소)
  const handleCancel = () => {
    setCurrentOldSerial('');
    setCurrentItemCode('');
    setScanMode('old');
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
      const response = await fetch('/api/repack/individual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saupj: saupj || '10',
          repackList: repackList.map((item) => ({
            oldSerialNo: item.oldSerialNo,
            newSerialNo: item.newSerialNo,
          })),
          userId: userId || 'SYSTEM',
        }),
      });

      const result: ApiResponse<{ count: number }> = await response.json();

      if (result.success) {
        showSuccess(result.message || '재포장 처리되었습니다.');
        setRepackList([]);
      } else {
        showError(result.error || '재포장 처리 실패');
      }
    } catch (err) {
      console.error('재포장 처리 오류:', err);
      handleApiError(err, '재포장 처리 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 개별 재포장 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <PackageOpen className="mr-2 h-5 w-5" />
            개별 재포장
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="mb-2 flex items-center gap-2">
            <Badge variant={scanMode === 'old' ? 'default' : 'secondary'}>
              1. 기존 시리얼
            </Badge>
            <span>→</span>
            <Badge variant={scanMode === 'new' ? 'default' : 'secondary'}>
              2. 새 시리얼
            </Badge>
          </div>

          {scanMode === 'old' ? (
            <BarcodeInput
              label="기존 시리얼 스캔"
              onScan={handleBarcodeScan}
              autoFocus
              placeholder="재포장할 기존 시리얼 스캔"
            />
          ) : (
            <>
              <div className="rounded-lg bg-blue-50 p-4">
                <div className="text-sm text-gray-600">기존 시리얼</div>
                <div className="font-mono font-bold">{currentOldSerial}</div>
                <div className="text-xs text-gray-500">품목: {currentItemCode}</div>
              </div>
              <BarcodeInput
                label="새 시리얼 스캔"
                onScan={handleBarcodeScan}
                autoFocus
                placeholder="새 시리얼 스캔"
              />
              <Button variant="outline" onClick={handleCancel} className="w-full">
                취소
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* 재포장 목록 */}
      {repackList.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              재포장 목록 ({repackList.length}건)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-48 overflow-auto rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No</TableHead>
                    <TableHead>기존 시리얼</TableHead>
                    <TableHead>새 시리얼</TableHead>
                    <TableHead>품목</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repackList.map((item, idx) => (
                    <TableRow key={item.oldSerialNo}>
                      <TableCell>{item.no}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {item.oldSerialNo}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {item.newSerialNo}
                      </TableCell>
                      <TableCell className="text-xs">{item.itemCode}</TableCell>
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

            <Button onClick={handleSave} className="w-full" disabled={isLoading}>
              <Save className="mr-2 h-4 w-4" />
              재포장 완료 ({repackList.length}건)
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
