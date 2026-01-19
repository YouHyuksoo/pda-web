/**
 * @file src/app/(main)/quality/oqc-oracle/page.tsx
 * @description
 * OQC 검사(Oracle) 페이지입니다. (HS251 대체)
 * Oracle DB 직접 연동하여 출하 예정 목록 조회 및 검사 수행.
 *
 * 초보자 가이드:
 * 1. **출하일자 선택**: 검사할 출하일자 선택
 * 2. **조회**: 출하 예정 목록 조회
 * 3. **대상 선택**: 검사할 대상 클릭
 * 4. **검사 수행**: 각 항목별 OK/NG 입력
 * 5. **저장**: 검사 결과 Oracle DB에 저장
 */

'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Search, Save, Database } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useAuthStore } from '@/stores/auth-store';
import { formatNumber } from '@/lib/utils/string';
import {
  showSuccess,
  showError,
  showWarning,
  showInfo,
  showConfirm,
  handleApiError,
} from '@/lib/utils/toast';

/** 검사 대상 타입 */
interface OqcTarget {
  shipNo: string;
  boxNo: string;
  itemCode: string;
  itemName: string;
  qty: number;
  customer: string;
}

/** 검사 항목 타입 */
interface CheckItem {
  no: number;
  checkCode: string;
  checkName: string;
  standard: string;
  result: 'OK' | 'NG' | null;
}

/** API 응답 인터페이스 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export default function OqcOraclePage() {
  const { saupj, userId, setForm } = useAuthStore();

  // 상태 관리
  const [shipDate, setShipDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [targetList, setTargetList] = useState<OqcTarget[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<OqcTarget | null>(null);
  const [checkList, setCheckList] = useState<CheckItem[]>([]);
  const [remark, setRemark] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 페이지 로드 시 화면 정보 설정
  useEffect(() => {
    setForm('HS251', 'OQC검사(Oracle)');
  }, [setForm]);

  // OK/NG 카운트
  const okCount = checkList.filter((c) => c.result === 'OK').length;
  const ngCount = checkList.filter((c) => c.result === 'NG').length;

  // 출하 예정 목록 조회
  const handleSearch = async () => {
    setIsLoading(true);

    try {
      const params = new URLSearchParams({ shipDate });
      const response = await fetch(`/api/quality/oqc-oracle?${params}`);
      const result: ApiResponse<OqcTarget[]> = await response.json();

      if (result.success && result.data) {
        setTargetList(result.data);
        setSelectedTarget(null);
        if (result.data.length === 0) {
          showInfo('조회 결과가 없습니다.');
        }
      } else {
        showError(result.error || '조회 실패');
        setTargetList([]);
      }
    } catch (err) {
      console.error('조회 오류:', err);
      handleApiError(err, '조회 중 오류가 발생했습니다.');
      setTargetList([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 검사 대상 선택
  const handleSelectTarget = async (target: OqcTarget) => {
    setSelectedTarget(target);

    try {
      // 품목별 검사 항목 조회
      const params = new URLSearchParams({ itemCode: target.itemCode });
      const response = await fetch(`/api/quality/oqc-oracle?${params}`);
      const result: ApiResponse<CheckItem[]> = await response.json();

      if (result.success && result.data && result.data.length > 0) {
        setCheckList(result.data);
      } else {
        // 기본 검사 항목
        setCheckList([
          { no: 1, checkCode: 'CHK001', checkName: '외관 검사', standard: '기준서 참조', result: null },
          { no: 2, checkCode: 'CHK002', checkName: '치수 검사', standard: '±0.5mm', result: null },
          { no: 3, checkCode: 'CHK003', checkName: '전기적 특성', standard: '규격 내', result: null },
          { no: 4, checkCode: 'CHK004', checkName: '포장 상태', standard: '이상 없음', result: null },
        ]);
      }
      setRemark('');
    } catch (err) {
      console.error('검사 항목 조회 오류:', err);
      // 기본 검사 항목 사용
      setCheckList([
        { no: 1, checkCode: 'CHK001', checkName: '외관 검사', standard: '기준서 참조', result: null },
        { no: 2, checkCode: 'CHK002', checkName: '치수 검사', standard: '±0.5mm', result: null },
        { no: 3, checkCode: 'CHK003', checkName: '전기적 특성', standard: '규격 내', result: null },
        { no: 4, checkCode: 'CHK004', checkName: '포장 상태', standard: '이상 없음', result: null },
      ]);
      setRemark('');
    }
  };

  // 검사 결과 변경
  const handleResultChange = (no: number, result: 'OK' | 'NG') => {
    setCheckList((prev) =>
      prev.map((item) => (item.no === no ? { ...item, result } : item))
    );
  };

  // 저장
  const handleSave = async () => {
    const unchecked = checkList.filter((c) => c.result === null);
    if (unchecked.length > 0) {
      showWarning(`미검사 항목이 ${unchecked.length}건 있습니다.`);
      return;
    }

    if (ngCount > 0 && !remark) {
      showWarning('NG 항목이 있습니다. 비고를 입력해주세요.');
      return;
    }

    const finalResult = ngCount > 0 ? 'NG' : 'OK';
    const confirmed = await showConfirm(
      `검사 결과를 저장하시겠습니까?`,
      { description: `최종 결과: ${finalResult} (OK: ${okCount}건, NG: ${ngCount}건)` }
    );
    if (!confirmed) return;

    setIsLoading(true);

    try {
      const response = await fetch('/api/quality/oqc-oracle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saupj: saupj || '10',
          shipNo: selectedTarget?.shipNo,
          boxNo: selectedTarget?.boxNo,
          itemCode: selectedTarget?.itemCode,
          results: checkList,
          remark,
          userId: userId || 'SYSTEM',
        }),
      });

      const result: ApiResponse<{ finalResult: string }> = await response.json();

      if (result.success) {
        showSuccess(result.message || `검사 완료 (${finalResult})`);
        // 목록에서 완료 항목 제거
        setTargetList((prev) =>
          prev.filter((t) => t.shipNo !== selectedTarget?.shipNo)
        );
        setSelectedTarget(null);
        setCheckList([]);
        setRemark('');
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
      {/* 조회 조건 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <Database className="mr-2 h-5 w-5" />
            조회 조건
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
          <Button onClick={handleSearch} disabled={isLoading} className="w-full">
            <Search className="mr-2 h-4 w-4" />
            조회
          </Button>
        </CardContent>
      </Card>

      {/* 검사 대상 목록 */}
      {targetList.length > 0 && !selectedTarget && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              검사 대상 ({targetList.length}건)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-auto rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>출하번호</TableHead>
                    <TableHead>품목</TableHead>
                    <TableHead className="text-right">수량</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {targetList.map((target) => (
                    <TableRow
                      key={target.shipNo}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSelectTarget(target)}
                    >
                      <TableCell>
                        <div className="font-mono text-sm">{target.shipNo}</div>
                        <div className="text-xs text-gray-500">{target.customer}</div>
                      </TableCell>
                      <TableCell>
                        <div>{target.itemCode}</div>
                        <div className="text-xs text-gray-500">{target.itemName}</div>
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatNumber(target.qty)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 선택된 대상 및 검사 */}
      {selectedTarget && (
        <>
          {/* 대상 정보 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">검사 대상 정보</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-blue-50 p-4 space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">출하번호</span>
                  <span className="font-mono">{selectedTarget.shipNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">품목</span>
                  <span>
                    {selectedTarget.itemCode} - {selectedTarget.itemName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">고객</span>
                  <span>{selectedTarget.customer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">수량</span>
                  <span className="font-bold">{formatNumber(selectedTarget.qty)}</span>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => setSelectedTarget(null)}
                className="w-full mt-4"
              >
                목록으로
              </Button>
            </CardContent>
          </Card>

          {/* 검사 항목 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span>검사 항목</span>
                <div className="flex gap-2">
                  <Badge variant="default">OK: {okCount}</Badge>
                  <Badge variant="destructive">NG: {ngCount}</Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {checkList.map((item) => (
                  <div
                    key={item.no}
                    className={`rounded-lg border p-3 ${
                      item.result === 'NG'
                        ? 'border-red-300 bg-red-50'
                        : item.result === 'OK'
                        ? 'border-green-300 bg-green-50'
                        : ''
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">
                          {item.no}. {item.checkName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {item.checkCode} | 기준: {item.standard}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant={item.result === 'OK' ? 'default' : 'outline'}
                          onClick={() => handleResultChange(item.no, 'OK')}
                          className="h-8 px-3"
                        >
                          OK
                        </Button>
                        <Button
                          size="sm"
                          variant={item.result === 'NG' ? 'destructive' : 'outline'}
                          onClick={() => handleResultChange(item.no, 'NG')}
                          className="h-8 px-3"
                        >
                          NG
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label>
                  비고 {ngCount > 0 && <span className="text-red-500">*</span>}
                </Label>
                <Textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="특이사항 기재"
                  rows={2}
                />
              </div>

              {/* 저장 버튼 */}
              <Button
                onClick={handleSave}
                disabled={isLoading}
                className="w-full"
              >
                <Save className="mr-2 h-4 w-4" />
                검사 완료
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
