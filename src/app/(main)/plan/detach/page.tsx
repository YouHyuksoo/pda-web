/**
 * @file src/app/(main)/plan/detach/page.tsx
 * @description
 * 탈착 페이지입니다. (HP140 대체)
 * 장착된 부품을 탈착 처리합니다.
 *
 * 초보자 가이드:
 * 1. **공정/라인 선택**: 탈착할 공정과 라인 선택
 * 2. **조회**: 현재 장착된 부품 목록 조회
 * 3. **선택**: 탈착할 부품 선택
 * 4. **탈착**: 선택한 부품 탈착 처리
 */

'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Search, Unplug } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { ProcessSelect, LineSelect } from '@/components/forms/ProcessLineSelect';
import { useAuthStore } from '@/stores/auth-store';
import { formatNumber } from '@/lib/utils/string';
import {
  showSuccess,
  showError,
  showWarning,
  showConfirm,
  showInfo,
  handleApiError,
} from '@/lib/utils/toast';

/** API 응답 인터페이스 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

/** 장착된 부품 타입 */
interface MountedPart {
  feederNo: string;
  partCode: string;
  partName: string;
  lotNo: string;
  remainQty: number;
  mountTime: string;
}

export default function DetachPage() {
  const { opcode, linecode, userId, setForm } = useAuthStore();
  const [processCode, setProcessCode] = useState(opcode || '');
  const [lineCode, setLineCode] = useState(linecode || '');
  const [workDate, setWorkDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [mountedList, setMountedList] = useState<MountedPart[]>([]);
  const [detachList, setDetachList] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setForm('HP140', '탈착');
  }, [setForm]);

  // 장착 목록 조회
  const handleSearch = async () => {
    if (!processCode || !lineCode) {
      showWarning('공정/라인을 선택하세요.');
      return;
    }

    setIsLoading(true);

    try {
      const params = new URLSearchParams({ processCode, lineCode });
      const response = await fetch(`/api/plan/mount?${params}`);
      const result: ApiResponse<MountedPart[]> = await response.json();

      if (result.success && result.data) {
        setMountedList(result.data);
        setDetachList([]);
        if (result.data.length === 0) {
          showInfo('장착된 부품이 없습니다.');
        }
      } else {
        showError(result.error || '조회 실패');
        setMountedList([]);
      }
    } catch (err) {
      console.error('장착 목록 조회 오류:', err);
      handleApiError(err, '장착 목록 조회 중 오류가 발생했습니다.');
      setMountedList([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 탈착 선택 토글
  const handleToggleDetach = (feederNo: string) => {
    setDetachList((prev) =>
      prev.includes(feederNo)
        ? prev.filter((f) => f !== feederNo)
        : [...prev, feederNo]
    );
  };

  // 탈착 저장
  const handleSave = async () => {
    if (detachList.length === 0) {
      showWarning('탈착할 항목을 선택하세요.');
      return;
    }

    const confirmed = await showConfirm(`${detachList.length}건을 탈착하시겠습니까?`);
    if (!confirmed) return;

    setIsLoading(true);

    try {
      const response = await fetch('/api/plan/mount', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processCode,
          lineCode,
          feederNos: detachList,
          userId: userId || 'SYSTEM',
        }),
      });

      const result: ApiResponse<{ count: number }> = await response.json();

      if (result.success) {
        showSuccess(result.message || '탈착 처리되었습니다.');
        setMountedList((prev) =>
          prev.filter((m) => !detachList.includes(m.feederNo))
        );
        setDetachList([]);
      } else {
        showError(result.error || '탈착 실패');
      }
    } catch (err) {
      console.error('탈착 처리 오류:', err);
      handleApiError(err, '탈착 처리 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 조회 조건 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <Unplug className="mr-2 h-5 w-5" />
            조회 조건
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <ProcessSelect
              value={processCode}
              onChange={setProcessCode}
              label="공정"
            />
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
          <Button onClick={handleSearch} disabled={isLoading} className="w-full">
            <Search className="mr-2 h-4 w-4" />
            조회
          </Button>
        </CardContent>
      </Card>

      {/* 장착된 부품 목록 */}
      {mountedList.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">장착된 부품 목록</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-64 overflow-auto rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">선택</TableHead>
                    <TableHead>피더</TableHead>
                    <TableHead>부품</TableHead>
                    <TableHead className="text-right">잔량</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mountedList.map((item) => (
                    <TableRow
                      key={item.feederNo}
                      className={
                        detachList.includes(item.feederNo) ? 'bg-red-50' : ''
                      }
                    >
                      <TableCell>
                        <Checkbox
                          checked={detachList.includes(item.feederNo)}
                          onCheckedChange={() => handleToggleDetach(item.feederNo)}
                        />
                      </TableCell>
                      <TableCell className="font-bold">{item.feederNo}</TableCell>
                      <TableCell>
                        <div>{item.partCode}</div>
                        <div className="text-xs text-gray-500">{item.lotNo}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(item.remainQty)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button
              onClick={handleSave}
              variant="destructive"
              className="w-full"
              disabled={isLoading || detachList.length === 0}
            >
              <Unplug className="mr-2 h-4 w-4" />
              탈착 ({detachList.length}건)
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
