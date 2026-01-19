/**
 * @file src/app/(main)/quality/oqc/page.tsx
 * @description
 * OQC 검사 페이지입니다. (HS250 대체)
 * 출하 전 최종 품질검사를 수행합니다.
 *
 * 초보자 가이드:
 * 1. **제품 바코드 스캔**: 검사할 제품 바코드 스캔
 * 2. **검사 항목 확인**: 각 검사 항목별 기준 확인
 * 3. **검사 결과 입력**: OK/NG 버튼으로 결과 입력
 * 4. **검사 완료**: 모든 항목 검사 후 저장
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Save, ClipboardCheck, CheckCircle2, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

import { BarcodeInput } from '@/components/forms/BarcodeInput';
import { useAuthStore } from '@/stores/auth-store';
import { formatNumber } from '@/lib/utils/string';
import {
  showSuccess,
  showError,
  showWarning,
  showConfirm,
  showScanSuccess,
  handleApiError,
} from '@/lib/utils/toast';

/** 제품 정보 타입 */
interface OqcItem {
  boxNo: string;
  itemCode: string;
  itemName: string;
  qty: number;
  lotNo: string;
}

/** 검사 결과 타입 */
interface CheckResult {
  itemNo: number;
  checkName: string;
  standard: string;
  result: 'OK' | 'NG' | null;
  value: string;
}

/** API 응답 인터페이스 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

/** OQC 검사 항목 기본값 */
const OQC_CHECK_ITEMS: Omit<CheckResult, 'result' | 'value'>[] = [
  { itemNo: 1, checkName: '외관 검사', standard: '흠집, 오염 없음' },
  { itemNo: 2, checkName: '치수 검사', standard: '규격 ±0.5mm' },
  { itemNo: 3, checkName: '기능 검사', standard: '정상 동작' },
  { itemNo: 4, checkName: '포장 상태', standard: '파손 없음' },
  { itemNo: 5, checkName: '라벨 확인', standard: '정보 일치' },
];

export default function OqcPage() {
  const { saupj, userId, setForm } = useAuthStore();

  // 상태 관리
  const [oqcItem, setOqcItem] = useState<OqcItem | null>(null);
  const [checkResults, setCheckResults] = useState<CheckResult[]>([]);
  const [remark, setRemark] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 페이지 로드 시 화면 정보 설정
  useEffect(() => {
    setForm('HS250', 'OQC검사');
  }, [setForm]);

  // OK/NG 카운트
  const okCount = checkResults.filter((r) => r.result === 'OK').length;
  const ngCount = checkResults.filter((r) => r.result === 'NG').length;

  // 바코드 스캔 처리
  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      if (!barcode) {
        showWarning('바코드를 입력하세요.');
        return;
      }

      try {
        const params = new URLSearchParams({ boxNo: barcode });
        const response = await fetch(`/api/quality/oqc?${params}`);
        const result: ApiResponse<OqcItem> = await response.json();

        if (result.success && result.data) {
          setOqcItem(result.data);
          setCheckResults(
            OQC_CHECK_ITEMS.map((item) => ({ ...item, result: null, value: '' }))
          );
          setRemark('');
          showScanSuccess(`${barcode} 조회 완료`);
        } else {
          showError(result.error || '제품 조회 실패');
          setOqcItem(null);
        }
      } catch (err) {
        console.error('제품 조회 오류:', err);
        // 오류 시 기본값으로 등록
        setOqcItem({
          boxNo: barcode,
          itemCode: '',
          itemName: '',
          qty: 0,
          lotNo: '',
        });
        setCheckResults(
          OQC_CHECK_ITEMS.map((item) => ({ ...item, result: null, value: '' }))
        );
        setRemark('');
        showScanSuccess(`${barcode} 스캔 완료`);
      }
    },
    []
  );

  // 검사 결과 변경
  const handleResultChange = (itemNo: number, result: 'OK' | 'NG') => {
    setCheckResults((prev) =>
      prev.map((item) => (item.itemNo === itemNo ? { ...item, result } : item))
    );
  };

  // 측정값 변경
  const handleValueChange = (itemNo: number, value: string) => {
    setCheckResults((prev) =>
      prev.map((item) => (item.itemNo === itemNo ? { ...item, value } : item))
    );
  };

  // 저장
  const handleSave = async () => {
    const unchecked = checkResults.filter((r) => r.result === null);
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
      const response = await fetch('/api/quality/oqc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saupj: saupj || '10',
          boxNo: oqcItem?.boxNo,
          itemCode: oqcItem?.itemCode,
          results: checkResults,
          remark,
          userId: userId || 'SYSTEM',
        }),
      });

      const result: ApiResponse<{ finalResult: string }> = await response.json();

      if (result.success) {
        showSuccess(result.message || `검사 완료 (${finalResult})`);
        setOqcItem(null);
        setCheckResults([]);
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
      {/* 바코드 스캔 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <ClipboardCheck className="mr-2 h-5 w-5" />
            OQC 검사
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <BarcodeInput
            label="제품 바코드"
            placeholder="출하 제품 바코드 스캔"
            onScan={handleBarcodeScan}
            autoFocus
          />
        </CardContent>
      </Card>

      {/* 제품 정보 */}
      {oqcItem && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">제품 정보</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-blue-50 p-4 space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">BOX NO</span>
                  <span className="font-mono">{oqcItem.boxNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">품목</span>
                  <span>
                    {oqcItem.itemCode}
                    {oqcItem.itemName && ` - ${oqcItem.itemName}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">LOT</span>
                  <span className="font-mono">{oqcItem.lotNo || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">수량</span>
                  <span className="font-bold">{formatNumber(oqcItem.qty)}</span>
                </div>
              </div>
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
                {checkResults.map((item) => (
                  <div
                    key={item.itemNo}
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
                          {item.itemNo}. {item.checkName}
                        </div>
                        <div className="text-xs text-gray-500">
                          기준: {item.standard}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant={item.result === 'OK' ? 'default' : 'outline'}
                          onClick={() => handleResultChange(item.itemNo, 'OK')}
                          className="h-8 px-2"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={item.result === 'NG' ? 'destructive' : 'outline'}
                          onClick={() => handleResultChange(item.itemNo, 'NG')}
                          className="h-8 px-2"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Input
                      placeholder="측정값/비고"
                      value={item.value}
                      onChange={(e) => handleValueChange(item.itemNo, e.target.value)}
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
