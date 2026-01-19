/**
 * @file src/app/(main)/plan/periodic-check/page.tsx
 * @description
 * 주기검사 페이지입니다. (HP150 대체)
 * 정기적인 검사를 수행하고 결과를 기록합니다.
 *
 * 초보자 가이드:
 * 1. **공정/라인 선택**: 검사할 공정과 라인 선택
 * 2. **조회**: 검사 항목 조회
 * 3. **검사**: 각 항목별 OK/NG 입력
 * 4. **저장**: 검사 결과 저장
 */

'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Search, Save, ClipboardCheck, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ProcessSelect, LineSelect } from '@/components/forms/ProcessLineSelect';
import { useAuthStore } from '@/stores/auth-store';
import {
  showSuccess,
  showError,
  showWarning,
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

/** 검사 항목 타입 */
interface CheckItem {
  no: number;
  checkName: string;
  standard: string;
  result: 'OK' | 'NG' | null;
  value: string;
}

export default function PeriodicCheckPage() {
  const { opcode, linecode, saupj, userId, setForm } = useAuthStore();
  const [processCode, setProcessCode] = useState(opcode || '');
  const [lineCode, setLineCode] = useState(linecode || '');
  const [workDate, setWorkDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [checkList, setCheckList] = useState<CheckItem[]>([]);
  const [remark, setRemark] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setForm('HP150', '주기검사');
  }, [setForm]);

  // 검사 항목 조회
  const handleSearch = async () => {
    if (!processCode || !lineCode) {
      showWarning('공정/라인을 선택하세요.');
      return;
    }

    setIsLoading(true);

    try {
      const params = new URLSearchParams({ processCode, lineCode });
      const response = await fetch(`/api/plan/check?${params}`);
      const result: ApiResponse<CheckItem[]> = await response.json();

      if (result.success && result.data) {
        setCheckList(result.data);
        setRemark('');
        if (result.data.length === 0) {
          showInfo('검사 항목이 없습니다.');
        }
      } else {
        showError(result.error || '조회 실패');
        setCheckList([]);
      }
    } catch (err) {
      console.error('검사 항목 조회 오류:', err);
      handleApiError(err, '검사 항목 조회 중 오류가 발생했습니다.');
      setCheckList([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 검사 결과 변경
  const handleResultChange = (idx: number, result: 'OK' | 'NG') => {
    setCheckList((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, result } : item))
    );
  };

  // 측정값 변경
  const handleValueChange = (idx: number, value: string) => {
    setCheckList((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, value } : item))
    );
  };

  // 저장
  const handleSave = async () => {
    const unchecked = checkList.filter((i) => i.result === null);
    if (unchecked.length > 0) {
      showWarning('모든 항목을 검사해주세요.');
      return;
    }

    const ngCount = checkList.filter((i) => i.result === 'NG').length;
    if (ngCount > 0 && !remark) {
      showWarning('NG 항목이 있습니다. 비고를 입력해주세요.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/plan/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saupj: saupj || '10',
          processCode,
          lineCode,
          checkDate: workDate,
          results: checkList,
          remark,
          userId: userId || 'SYSTEM',
        }),
      });

      const result: ApiResponse<{ finalResult: string }> = await response.json();

      if (result.success) {
        showSuccess(result.message || '저장되었습니다.');
        setCheckList([]);
        setRemark('');
      } else {
        showError(result.error || '저장 실패');
      }
    } catch (err) {
      console.error('검사 저장 오류:', err);
      handleApiError(err, '검사 저장 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const okCount = checkList.filter((i) => i.result === 'OK').length;
  const ngCount = checkList.filter((i) => i.result === 'NG').length;

  return (
    <div className="space-y-4">
      {/* 조회 조건 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <ClipboardCheck className="mr-2 h-5 w-5" />
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
            <Label>검사일자</Label>
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

      {/* 검사 항목 */}
      {checkList.length > 0 && (
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
              {checkList.map((item, idx) => (
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
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-medium">
                        {item.no}. {item.checkName}
                      </div>
                      <div className="text-xs text-gray-500">
                        기준: {item.standard}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant={item.result === 'OK' ? 'default' : 'outline'}
                        onClick={() => handleResultChange(idx, 'OK')}
                        className="h-8 px-2"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant={item.result === 'NG' ? 'destructive' : 'outline'}
                        onClick={() => handleResultChange(idx, 'NG')}
                        className="h-8 px-2"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Input
                    placeholder="측정값 입력"
                    value={item.value}
                    onChange={(e) => handleValueChange(idx, e.target.value)}
                    className="h-8"
                  />
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

            <Button
              onClick={handleSave}
              disabled={isLoading}
              className="w-full"
            >
              <Save className="mr-2 h-4 w-4" />
              저장
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
