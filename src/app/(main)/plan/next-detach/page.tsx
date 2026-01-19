/**
 * @file src/app/(main)/plan/next-detach/page.tsx
 * @description
 * 차기탈착 페이지입니다. (HP220 대체)
 * 차기 작업에서 사용하지 않는 부품을 사전에 탈착 예정으로 등록합니다.
 *
 * 초보자 가이드:
 * 1. **공정/라인 선택**: 작업할 공정과 라인 선택
 * 2. **조회**: 탈착 대상 부품 목록 조회
 * 3. **선택**: 탈착할 부품 선택
 * 4. **등록**: 탈착 예정 등록
 */

'use client';

import { useState, useEffect } from 'react';
import { format, addDays } from 'date-fns';
import { Search, Unplug, AlertCircle } from 'lucide-react';
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

/** 탈착 후보 타입 */
interface DetachCandidate {
  feederNo: string;
  partCode: string;
  partName: string;
  lotNo: string;
  remainQty: number;
  reason: string;
  selected: boolean;
}

export default function NextDetachPage() {
  const { opcode, linecode, userId, setForm } = useAuthStore();
  const [processCode, setProcessCode] = useState(opcode || '');
  const [lineCode, setLineCode] = useState(linecode || '');
  const [planDate, setPlanDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [detachList, setDetachList] = useState<DetachCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setForm('HP220', '차기탈착');
  }, [setForm]);

  // 탈착 대상 조회
  const handleSearch = async () => {
    if (!processCode || !lineCode) {
      showWarning('공정/라인을 선택하세요.');
      return;
    }

    setIsLoading(true);

    try {
      const params = new URLSearchParams({
        processCode,
        lineCode,
        planDate: planDate.replace(/-/g, ''),
      });
      const response = await fetch(`/api/plan/next-detach?${params}`);
      const result: ApiResponse<DetachCandidate[]> = await response.json();

      if (result.success && result.data) {
        setDetachList(result.data);
        if (result.data.length === 0) {
          showInfo('탈착 대상이 없습니다.');
        }
      } else {
        showError(result.error || '조회 실패');
        setDetachList([]);
      }
    } catch (err) {
      console.error('차기탈착 조회 오류:', err);
      handleApiError(err, '차기탈착 조회 중 오류가 발생했습니다.');
      setDetachList([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 전체 선택/해제
  const handleSelectAll = (checked: boolean) => {
    setDetachList((prev) => prev.map((item) => ({ ...item, selected: checked })));
  };

  // 개별 선택
  const handleSelect = (feederNo: string, checked: boolean) => {
    setDetachList((prev) =>
      prev.map((item) =>
        item.feederNo === feederNo ? { ...item, selected: checked } : item
      )
    );
  };

  // 탈착 예정 등록
  const handleSave = async () => {
    const selected = detachList.filter((d) => d.selected);
    if (selected.length === 0) {
      showWarning('탈착할 항목을 선택하세요.');
      return;
    }

    const confirmed = await showConfirm(
      `${selected.length}건을 탈착 예정으로 등록하시겠습니까?`
    );
    if (!confirmed) return;

    setIsLoading(true);

    try {
      const response = await fetch('/api/plan/next-detach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processCode,
          lineCode,
          feederNos: selected.map((s) => s.feederNo),
          userId: userId || 'SYSTEM',
        }),
      });

      const result: ApiResponse<{ count: number }> = await response.json();

      if (result.success) {
        showSuccess(result.message || '탈착 예정 등록되었습니다.');
        setDetachList((prev) => prev.filter((d) => !d.selected));
      } else {
        showError(result.error || '등록 실패');
      }
    } catch (err) {
      console.error('차기탈착 등록 오류:', err);
      handleApiError(err, '탈착 예정 등록 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedCount = detachList.filter((d) => d.selected).length;

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
            <ProcessSelect value={processCode} onChange={setProcessCode} label="공정" />
            <LineSelect value={lineCode} onChange={setLineCode} label="라인" />
          </div>
          <div className="space-y-2">
            <Label>계획일자</Label>
            <Input
              type="date"
              value={planDate}
              onChange={(e) => setPlanDate(e.target.value)}
            />
          </div>
          <Button onClick={handleSearch} disabled={isLoading} className="w-full">
            <Search className="mr-2 h-4 w-4" />
            조회
          </Button>
        </CardContent>
      </Card>

      {/* 탈착 대상 목록 */}
      {detachList.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span>탈착 대상</span>
              <Badge variant="destructive">{detachList.length}건</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 rounded bg-yellow-50 p-2 text-sm text-yellow-700">
              <AlertCircle className="h-4 w-4" />
              <span>차기 작업에서 사용하지 않는 부품 목록입니다.</span>
            </div>

            <div className="max-h-64 overflow-auto rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={
                          detachList.length > 0 && detachList.every((d) => d.selected)
                        }
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>피더</TableHead>
                    <TableHead>부품</TableHead>
                    <TableHead className="text-right">잔량</TableHead>
                    <TableHead>사유</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detachList.map((item) => (
                    <TableRow
                      key={item.feederNo}
                      className={item.selected ? 'bg-red-50' : ''}
                    >
                      <TableCell>
                        <Checkbox
                          checked={item.selected}
                          onCheckedChange={(c) =>
                            handleSelect(item.feederNo, c as boolean)
                          }
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
                      <TableCell className="text-xs">{item.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button
              onClick={handleSave}
              variant="destructive"
              className="w-full"
              disabled={isLoading || selectedCount === 0}
            >
              <Unplug className="mr-2 h-4 w-4" />
              탈착 예정 등록 ({selectedCount}건)
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 데이터 없음 */}
      {detachList.length === 0 && !isLoading && (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            조회 버튼을 눌러 탈착 대상을 확인하세요.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
