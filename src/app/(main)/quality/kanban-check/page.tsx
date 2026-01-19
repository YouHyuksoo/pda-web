/**
 * @file src/app/(main)/quality/kanban-check/page.tsx
 * @description
 * 간판검증 페이지입니다. (HS260 대체)
 * 간판 바코드를 스캔하여 유효성을 검증합니다.
 *
 * 초보자 가이드:
 * 1. **간판 바코드 스캔**: 검증할 간판 바코드 스캔
 * 2. **결과 확인**: 유효/무효/만료 상태 확인
 * 3. **상세 정보 확인**: 품목, 수량, 위치 정보 확인
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import {
  ScanBarcode,
  CheckCircle,
  XCircle,
  AlertTriangle,
  History,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { BarcodeInput } from '@/components/forms/BarcodeInput';
import { useAuthStore } from '@/stores/auth-store';
import { formatNumber } from '@/lib/utils/string';
import {
  showWarning,
  showScanSuccess,
  showScanError,
  handleApiError,
} from '@/lib/utils/toast';

/** 간판 정보 타입 */
interface KanbanInfo {
  kanbanNo: string;
  itemCode: string;
  itemName: string;
  qty: number;
  fromLocation: string;
  toLocation: string;
  status: 'valid' | 'invalid' | 'expired';
  message: string;
}

/** 스캔 이력 타입 */
interface ScanHistory {
  no: number;
  kanbanNo: string;
  result: 'valid' | 'invalid' | 'expired';
  scanTime: string;
}

/** API 응답 인터페이스 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export default function KanbanCheckPage() {
  const { setForm } = useAuthStore();

  // 상태 관리
  const [kanbanInfo, setKanbanInfo] = useState<KanbanInfo | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistory[]>([]);

  // 페이지 로드 시 화면 정보 설정
  useEffect(() => {
    setForm('HS260', '간판검증');
  }, [setForm]);

  // 바코드 스캔 처리
  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      if (!barcode) {
        showWarning('바코드를 입력하세요.');
        return;
      }

      try {
        const params = new URLSearchParams({ kanbanNo: barcode });
        const response = await fetch(`/api/quality/kanban-check?${params}`);
        const result: ApiResponse<KanbanInfo> = await response.json();

        if (result.success && result.data) {
          const info = result.data;
          setKanbanInfo(info);

          // 스캔 이력 추가 (최근 10개만 유지)
          setScanHistory((prev) => [
            {
              no: prev.length + 1,
              kanbanNo: barcode,
              result: info.status,
              scanTime: format(new Date(), 'HH:mm:ss'),
            },
            ...prev.slice(0, 9),
          ]);

          // 상태에 따른 토스트 메시지
          if (info.status === 'valid') {
            showScanSuccess(info.message);
          } else {
            showScanError(info.message);
          }
        } else {
          // API 오류 시 무효 처리
          const info: KanbanInfo = {
            kanbanNo: barcode,
            itemCode: '',
            itemName: '',
            qty: 0,
            fromLocation: '',
            toLocation: '',
            status: 'invalid',
            message: result.error || '유효하지 않은 간판입니다.',
          };
          setKanbanInfo(info);

          setScanHistory((prev) => [
            {
              no: prev.length + 1,
              kanbanNo: barcode,
              result: 'invalid',
              scanTime: format(new Date(), 'HH:mm:ss'),
            },
            ...prev.slice(0, 9),
          ]);

          showScanError(info.message);
        }
      } catch (err) {
        console.error('간판 검증 오류:', err);
        handleApiError(err, '간판 검증 중 오류가 발생했습니다.');
      }
    },
    []
  );

  // 상태별 아이콘
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'valid':
        return <CheckCircle className="h-12 w-12 text-green-500" />;
      case 'invalid':
        return <XCircle className="h-12 w-12 text-red-500" />;
      case 'expired':
        return <AlertTriangle className="h-12 w-12 text-yellow-500" />;
      default:
        return null;
    }
  };

  // 상태별 배지
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'valid':
        return (
          <Badge variant="default" className="bg-green-500">
            유효
          </Badge>
        );
      case 'invalid':
        return <Badge variant="destructive">무효</Badge>;
      case 'expired':
        return (
          <Badge variant="secondary" className="bg-yellow-500">
            만료
          </Badge>
        );
      default:
        return null;
    }
  };

  // 상태별 배경색
  const getStatusBg = (status: string) => {
    switch (status) {
      case 'valid':
        return 'bg-green-50 border-green-300';
      case 'invalid':
        return 'bg-red-50 border-red-300';
      case 'expired':
        return 'bg-yellow-50 border-yellow-300';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-4">
      {/* 바코드 스캔 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <ScanBarcode className="mr-2 h-5 w-5" />
            간판 검증
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BarcodeInput
            label="간판 바코드"
            placeholder="간판 바코드를 스캔하세요"
            onScan={handleBarcodeScan}
            autoFocus
          />
        </CardContent>
      </Card>

      {/* 검증 결과 */}
      {kanbanInfo && (
        <Card className={`border-2 ${getStatusBg(kanbanInfo.status)}`}>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center mb-4">
              {getStatusIcon(kanbanInfo.status)}
              <div className="mt-2 text-lg font-bold">{kanbanInfo.message}</div>
            </div>
            <div className="rounded-lg bg-white p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">간판번호</span>
                <span className="font-mono">{kanbanInfo.kanbanNo}</span>
              </div>
              {kanbanInfo.itemCode && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">품목</span>
                  <span>
                    {kanbanInfo.itemCode}
                    {kanbanInfo.itemName && ` - ${kanbanInfo.itemName}`}
                  </span>
                </div>
              )}
              {kanbanInfo.qty > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">수량</span>
                  <span className="font-bold">{formatNumber(kanbanInfo.qty)}</span>
                </div>
              )}
              {kanbanInfo.fromLocation && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">FROM</span>
                  <span>{kanbanInfo.fromLocation}</span>
                </div>
              )}
              {kanbanInfo.toLocation && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">TO</span>
                  <span>{kanbanInfo.toLocation}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 스캔 이력 */}
      {scanHistory.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-base">
              <History className="mr-2 h-5 w-5" />
              스캔 이력
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-48 overflow-auto rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">No</TableHead>
                    <TableHead>간판번호</TableHead>
                    <TableHead>결과</TableHead>
                    <TableHead>시간</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scanHistory.map((item) => (
                    <TableRow key={`${item.no}-${item.kanbanNo}`}>
                      <TableCell>{item.no}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {item.kanbanNo}
                      </TableCell>
                      <TableCell>{getStatusBadge(item.result)}</TableCell>
                      <TableCell>{item.scanTime}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
