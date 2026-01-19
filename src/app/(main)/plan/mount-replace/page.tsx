/**
 * @file src/app/(main)/plan/mount-replace/page.tsx
 * @description
 * 장착/교체 페이지입니다. (HP130 대체)
 * 피더에 부품을 장착하거나 기존 부품을 교체합니다.
 *
 * 초보자 가이드:
 * 1. **공정/라인 선택**: 작업할 공정과 라인 선택
 * 2. **피더번호 입력**: 장착할 피더 번호 입력
 * 3. **LOT 스캔**: 부품 LOT 바코드 스캔
 * 4. **저장**: 장착 정보 저장
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Save, Trash2, Settings } from 'lucide-react';
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
import { ProcessSelect, LineSelect } from '@/components/forms/ProcessLineSelect';
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

/** 장착 항목 타입 */
interface MountItem {
  no: number;
  feederNo: string;
  partCode: string;
  partName: string;
  lotNo: string;
  qty: number;
  mountTime: string;
}

export default function MountReplacePage() {
  const { opcode, linecode, userId, setForm } = useAuthStore();
  const [processCode, setProcessCode] = useState(opcode || '');
  const [lineCode, setLineCode] = useState(linecode || '');
  const [workDate, setWorkDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [feederNo, setFeederNo] = useState('');
  const [mountList, setMountList] = useState<MountItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setForm('HP130', '장착/교체');
  }, [setForm]);

  // 부품 LOT 스캔
  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      if (!processCode || !lineCode) {
        showWarning('공정/라인을 선택하세요.');
        return;
      }
      if (!feederNo) {
        showWarning('피더번호를 입력하세요.');
        return;
      }

      // 같은 피더에 이미 장착된 부품이 있으면 교체 확인
      const existingIdx = mountList.findIndex((m) => m.feederNo === feederNo);
      if (existingIdx >= 0) {
        const confirmed = await showConfirm(
          `피더 ${feederNo}에 장착된 부품을 교체하시겠습니까?`
        );
        if (!confirmed) return;
      }

      try {
        const params = new URLSearchParams({ lotNo: barcode });
        const response = await fetch(`/api/plan/lot?${params}`);
        const result: ApiResponse<{
          lotNo: string;
          partCode: string;
          partName: string;
          qty: number;
        }> = await response.json();

        if (result.success && result.data) {
          const newItem: MountItem = {
            no: mountList.length + 1,
            feederNo,
            partCode: result.data.partCode,
            partName: result.data.partName,
            lotNo: result.data.lotNo,
            qty: result.data.qty,
            mountTime: format(new Date(), 'HH:mm:ss'),
          };

          if (existingIdx >= 0) {
            // 교체
            setMountList((prev) =>
              prev.map((item, idx) =>
                idx === existingIdx
                  ? { ...newItem, no: item.no }
                  : item
              )
            );
            showScanSuccess(`피더 ${feederNo} 부품 교체 완료`);
          } else {
            // 신규 장착
            setMountList((prev) => [...prev, newItem]);
            showScanSuccess(`피더 ${feederNo} 장착 완료`);
          }
          setFeederNo('');
        } else {
          showScanError(result.error || 'LOT 조회 실패');
        }
      } catch (err) {
        console.error('LOT 조회 오류:', err);
        showScanError('LOT 조회 중 오류가 발생했습니다.');
      }
    },
    [processCode, lineCode, feederNo, mountList]
  );

  // 항목 삭제
  const handleDelete = (idx: number) => {
    setMountList((prev) =>
      prev.filter((_, i) => i !== idx).map((item, i) => ({ ...item, no: i + 1 }))
    );
  };

  // 저장
  const handleSave = async () => {
    if (mountList.length === 0) {
      showWarning('저장할 항목이 없습니다.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/plan/mount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processCode,
          lineCode,
          mountList: mountList.map((item) => ({
            feederNo: item.feederNo,
            partCode: item.partCode,
            lotNo: item.lotNo,
            qty: item.qty,
          })),
          userId: userId || 'SYSTEM',
        }),
      });

      const result: ApiResponse<{ count: number }> = await response.json();

      if (result.success) {
        showSuccess(result.message || '저장되었습니다.');
        setMountList([]);
      } else {
        showError(result.error || '저장 실패');
      }
    } catch (err) {
      console.error('장착 저장 오류:', err);
      handleApiError(err, '저장 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 작업 조건 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <Settings className="mr-2 h-5 w-5" />
            작업 조건
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <ProcessSelect value={processCode} onChange={setProcessCode} label="공정" />
            <LineSelect value={lineCode} onChange={setLineCode} label="라인" />
          </div>
          <div className="space-y-2">
            <Label>작업일자</Label>
            <Input
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* 부품 장착/교체 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">부품 장착/교체</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>피더번호</Label>
            <Input
              value={feederNo}
              onChange={(e) => setFeederNo(e.target.value)}
              placeholder="피더번호 입력"
            />
          </div>

          <BarcodeInput
            label="부품 LOT 바코드"
            onScan={handleBarcodeScan}
            disabled={!processCode || !lineCode || !feederNo}
          />

          {mountList.length > 0 && (
            <>
              <div className="max-h-64 overflow-auto rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>피더</TableHead>
                      <TableHead>부품</TableHead>
                      <TableHead>LOT</TableHead>
                      <TableHead className="text-right">수량</TableHead>
                      <TableHead>시간</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mountList.map((item, idx) => (
                      <TableRow key={item.feederNo}>
                        <TableCell className="font-bold">{item.feederNo}</TableCell>
                        <TableCell>
                          <div>{item.partCode}</div>
                          <div className="text-xs text-gray-500">{item.partName}</div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{item.lotNo}</TableCell>
                        <TableCell className="text-right">
                          {formatNumber(item.qty)}
                        </TableCell>
                        <TableCell className="text-xs">{item.mountTime}</TableCell>
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
                className="w-full"
                disabled={isLoading}
              >
                <Save className="mr-2 h-4 w-4" />
                저장 ({mountList.length}건)
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
