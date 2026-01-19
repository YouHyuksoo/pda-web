/**
 * @file src/app/(main)/production/smd-check/page.tsx
 * @description
 * SMD전수검사 페이지입니다. (HS603 대체)
 * SMD 부품 검사 결과를 등록합니다.
 *
 * 초보자 가이드:
 * 1. **공정/라인 선택**: 검사할 공정과 라인 선택
 * 2. **바코드 스캔**: BOX 바코드 스캔
 * 3. **검사 결과 입력**: OK/NG 버튼으로 결과 입력
 * 4. **저장**: 검사 결과 저장
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Save, CheckCircle2, XCircle } from 'lucide-react';

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

import { BarcodeInput } from '@/components/forms/BarcodeInput';
import { ProcessSelect, LineSelect } from '@/components/forms/ProcessLineSelect';
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

/** 검사 항목 타입 */
interface CheckItem {
  no: number;
  boxNo: string;
  itemCode: string;
  result: 'OK' | 'NG' | null;
  checkTime: string;
}

/** API 응답 인터페이스 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export default function SmdCheckPage() {
  const { saupj, opcode, linecode, userId, setForm } = useAuthStore();

  // 상태 관리
  const [processCode, setProcessCode] = useState(opcode || '');
  const [lineCode, setLineCode] = useState(linecode || '');
  const [workDate, setWorkDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [checkList, setCheckList] = useState<CheckItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 페이지 로드 시 화면 정보 설정
  useEffect(() => {
    setForm('HS603', 'SMD전수검사');
  }, [setForm]);

  // OK/NG 카운트
  const okCount = checkList.filter((i) => i.result === 'OK').length;
  const ngCount = checkList.filter((i) => i.result === 'NG').length;

  // 바코드 스캔 처리
  const handleBarcodeScan = useCallback(
    (barcode: string) => {
      if (!processCode || !lineCode) {
        showWarning('공정과 라인을 선택하세요.');
        return;
      }

      if (!barcode) {
        showWarning('바코드를 입력하세요.');
        return;
      }

      // 중복 체크
      if (checkList.some((item) => item.boxNo === barcode)) {
        showScanError('이미 검사된 항목입니다.');
        return;
      }

      // 검사 항목 추가 (결과 미입력 상태)
      const newItem: CheckItem = {
        no: checkList.length + 1,
        boxNo: barcode,
        itemCode: '',
        result: null,
        checkTime: format(new Date(), 'HH:mm:ss'),
      };

      setCheckList((prev) => [...prev, newItem]);
      showScanSuccess(`${barcode} 스캔 완료`);
    },
    [processCode, lineCode, checkList]
  );

  // 검사 결과 입력
  const handleResult = (idx: number, result: 'OK' | 'NG') => {
    setCheckList((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, result } : item))
    );
  };

  // 저장
  const handleSave = async () => {
    const unchecked = checkList.filter((i) => i.result === null);
    if (unchecked.length > 0) {
      showWarning(`미검사 항목이 ${unchecked.length}건 있습니다.`);
      return;
    }

    if (checkList.length === 0) {
      showWarning('검사할 항목이 없습니다.');
      return;
    }

    const confirmed = await showConfirm(
      `${checkList.length}건의 검사 결과를 저장하시겠습니까?`,
      { description: `OK: ${okCount}건, NG: ${ngCount}건` }
    );
    if (!confirmed) return;

    setIsLoading(true);

    try {
      const response = await fetch('/api/production/smd-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saupj: saupj || '10',
          processCode,
          lineCode,
          workDate: workDate,
          items: checkList.map((item) => ({
            boxNo: item.boxNo,
            itemCode: item.itemCode,
            result: item.result,
            checkTime: item.checkTime,
          })),
          userId: userId || 'SYSTEM',
        }),
      });

      const result: ApiResponse<{ count: number; ok: number; ng: number }> =
        await response.json();

      if (result.success) {
        showSuccess(result.message || `검사 완료 (OK: ${okCount}건, NG: ${ngCount}건)`);
        setCheckList([]);
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

  return (
    <div className="space-y-4">
      {/* 검사 조건 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">검사 조건</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <ProcessSelect value={processCode} onChange={setProcessCode} label="공정" />
            <LineSelect value={lineCode} onChange={setLineCode} label="라인" />
          </div>
          <div className="space-y-2">
            <Label>검사일자</Label>
            <Input
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* 바코드 스캔 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">바코드 스캔</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <BarcodeInput
            placeholder="바코드를 스캔하세요"
            onScan={handleBarcodeScan}
            autoFocus
            disabled={!processCode || !lineCode}
          />

          {/* 검사 목록 */}
          {checkList.length > 0 && (
            <>
              <div className="flex justify-between items-center">
                <span className="text-sm">총 {checkList.length}건</span>
                <div className="flex gap-2">
                  <Badge variant="default">OK: {okCount}</Badge>
                  <Badge variant="destructive">NG: {ngCount}</Badge>
                </div>
              </div>

              <div className="max-h-64 overflow-auto rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">No</TableHead>
                      <TableHead>BOX</TableHead>
                      <TableHead>결과</TableHead>
                      <TableHead>시간</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {checkList.map((item, idx) => (
                      <TableRow
                        key={item.boxNo}
                        className={
                          item.result === 'NG'
                            ? 'bg-red-50'
                            : item.result === 'OK'
                            ? 'bg-green-50'
                            : 'bg-yellow-50'
                        }
                      >
                        <TableCell>{item.no}</TableCell>
                        <TableCell className="font-mono text-xs">{item.boxNo}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant={item.result === 'OK' ? 'default' : 'outline'}
                              onClick={() => handleResult(idx, 'OK')}
                              className="h-7 px-2"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant={item.result === 'NG' ? 'destructive' : 'outline'}
                              onClick={() => handleResult(idx, 'NG')}
                              className="h-7 px-2"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{item.checkTime}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 저장 버튼 */}
              <Button
                onClick={handleSave}
                disabled={checkList.length === 0 || isLoading}
                className="w-full"
              >
                <Save className="mr-2 h-4 w-4" />
                저장
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
