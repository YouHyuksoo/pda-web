/**
 * @file src/app/(main)/plan/next-mount/page.tsx
 * @description
 * 차기장착 페이지입니다. (HP210 대체)
 * 차기 작업에 필요한 부품을 사전에 준비/장착합니다.
 *
 * 초보자 가이드:
 * 1. **공정/라인 선택**: 작업할 공정과 라인 선택
 * 2. **조회**: 차기 작업에 필요한 부품 목록 조회
 * 3. **피더 선택**: 테이블에서 장착할 피더 선택
 * 4. **LOT 스캔**: 해당 피더에 장착할 부품 LOT 바코드 스캔
 * 5. **저장**: 사전 장착 정보 저장
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, addDays } from 'date-fns';
import { Search, Save, Trash2, Settings2 } from 'lucide-react';
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
import { formatNumber } from '@/lib/utils/string';
import {
  showSuccess,
  showError,
  showWarning,
  showInfo,
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

/** 필요 부품 타입 */
interface RequiredPart {
  feederNo: string;
  partCode: string;
  partName: string;
  requiredQty: number;
  preparedLot: string | null;
  preparedQty: number;
}

/** 차기장착 조회 응답 타입 */
interface NextMountResponse {
  orderNo: string | null;
  itemCode?: string;
  itemName?: string;
  parts: RequiredPart[];
}

export default function NextMountPage() {
  const { opcode, linecode, userId, setForm } = useAuthStore();
  const [processCode, setProcessCode] = useState(opcode || '');
  const [lineCode, setLineCode] = useState(linecode || '');
  const [planDate, setPlanDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [orderNo, setOrderNo] = useState('');
  const [requiredParts, setRequiredParts] = useState<RequiredPart[]>([]);
  const [selectedFeeder, setSelectedFeeder] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setForm('HP210', '차기장착');
  }, [setForm]);

  // 차기 작업 필요 부품 조회
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
      const response = await fetch(`/api/plan/next-mount?${params}`);
      const result: ApiResponse<NextMountResponse> = await response.json();

      if (result.success && result.data) {
        if (!result.data.orderNo) {
          showInfo(result.message || '차기 작업이 없습니다.');
          setOrderNo('');
          setRequiredParts([]);
        } else {
          setOrderNo(result.data.orderNo);
          setRequiredParts(result.data.parts);
          if (result.data.parts.length === 0) {
            showInfo('필요한 부품이 없습니다.');
          }
        }
      } else {
        showError(result.error || '조회 실패');
        setOrderNo('');
        setRequiredParts([]);
      }
    } catch (err) {
      console.error('차기장착 조회 오류:', err);
      handleApiError(err, '차기장착 조회 중 오류가 발생했습니다.');
      setOrderNo('');
      setRequiredParts([]);
    } finally {
      setIsLoading(false);
    }
  };

  // LOT 바코드 스캔
  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      if (!selectedFeeder) {
        showWarning('피더를 선택하세요.');
        return;
      }

      const idx = requiredParts.findIndex((p) => p.feederNo === selectedFeeder);
      if (idx < 0) return;

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
          // 부품 코드 검증
          if (result.data.partCode !== requiredParts[idx].partCode) {
            showScanError('필요한 부품과 다릅니다.');
            return;
          }

          setRequiredParts((prev) =>
            prev.map((part, i) =>
              i === idx
                ? { ...part, preparedLot: result.data!.lotNo, preparedQty: result.data!.qty }
                : part
            )
          );
          showScanSuccess(`피더 ${selectedFeeder}에 LOT 등록 완료`);
          setSelectedFeeder('');
        } else {
          showScanError(result.error || 'LOT 조회 실패');
        }
      } catch (err) {
        console.error('LOT 조회 오류:', err);
        showScanError('LOT 조회 중 오류가 발생했습니다.');
      }
    },
    [selectedFeeder, requiredParts]
  );

  // LOT 준비 취소
  const handleClear = (feederNo: string) => {
    setRequiredParts((prev) =>
      prev.map((part) =>
        part.feederNo === feederNo ? { ...part, preparedLot: null, preparedQty: 0 } : part
      )
    );
  };

  // 저장
  const handleSave = async () => {
    const prepared = requiredParts.filter((p) => p.preparedLot);
    if (prepared.length === 0) {
      showWarning('준비된 부품이 없습니다.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/plan/next-mount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNo,
          mountList: prepared,
          userId: userId || 'SYSTEM',
        }),
      });

      const result: ApiResponse<{ count: number }> = await response.json();

      if (result.success) {
        showSuccess(result.message || '저장되었습니다.');
      } else {
        showError(result.error || '저장 실패');
      }
    } catch (err) {
      console.error('차기장착 저장 오류:', err);
      handleApiError(err, '저장 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const preparedCount = requiredParts.filter((p) => p.preparedLot).length;

  return (
    <div className="space-y-4">
      {/* 조회 조건 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <Settings2 className="mr-2 h-5 w-5" />
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

      {/* 필요 부품 목록 */}
      {requiredParts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span>필요 부품 ({orderNo})</span>
              <Badge
                variant={preparedCount === requiredParts.length ? 'default' : 'secondary'}
              >
                {preparedCount}/{requiredParts.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <BarcodeInput
              label="부품 LOT 바코드"
              onScan={handleBarcodeScan}
              disabled={!selectedFeeder}
              placeholder={
                selectedFeeder
                  ? `피더 ${selectedFeeder}에 장착할 LOT 스캔`
                  : '피더를 먼저 선택하세요'
              }
            />

            <div className="max-h-64 overflow-auto rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>피더</TableHead>
                    <TableHead>부품</TableHead>
                    <TableHead className="text-right">필요</TableHead>
                    <TableHead>준비</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requiredParts.map((part) => (
                    <TableRow
                      key={part.feederNo}
                      className={
                        selectedFeeder === part.feederNo
                          ? 'bg-blue-50'
                          : part.preparedLot
                          ? 'bg-green-50'
                          : ''
                      }
                      onClick={() => !part.preparedLot && setSelectedFeeder(part.feederNo)}
                    >
                      <TableCell className="font-bold">{part.feederNo}</TableCell>
                      <TableCell>
                        <div>{part.partCode}</div>
                        <div className="text-xs text-gray-500">{part.partName}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(part.requiredQty)}
                      </TableCell>
                      <TableCell>
                        {part.preparedLot ? (
                          <div>
                            <div className="font-mono text-xs">{part.preparedLot}</div>
                            <div className="text-xs text-green-600">
                              {formatNumber(part.preparedQty)}
                            </div>
                          </div>
                        ) : (
                          <Badge variant="outline">미준비</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {part.preparedLot && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClear(part.feederNo);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button
              onClick={handleSave}
              className="w-full"
              disabled={isLoading || preparedCount === 0}
            >
              <Save className="mr-2 h-4 w-4" />
              저장 ({preparedCount}건)
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
