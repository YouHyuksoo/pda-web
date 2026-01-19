/**
 * @file src/app/(main)/production/room-temp/page.tsx
 * @description
 * 상온방치 페이지입니다. (HS604 대체)
 * 상온방치 시작/종료 시간을 기록합니다.
 *
 * 초보자 가이드:
 * 1. **공정/라인 선택**: 작업할 공정과 라인 선택
 * 2. **바코드 스캔**: 처음 스캔 시 시작, 다시 스캔 시 종료
 * 3. **저장**: 방치 기록 저장
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Thermometer, Save, Trash2, Play, Square } from 'lucide-react';

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
  showInfo,
  handleApiError,
} from '@/lib/utils/toast';

/** 상온방치 항목 타입 */
interface RoomTempItem {
  no: number;
  boxNo: string;
  itemCode: string;
  startTime: string;
  endTime: string | null;
  status: 'waiting' | 'completed';
}

/** API 응답 인터페이스 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export default function RoomTempPage() {
  const { saupj, opcode, linecode, userId, setForm } = useAuthStore();

  // 상태 관리
  const [processCode, setProcessCode] = useState(opcode || '');
  const [lineCode, setLineCode] = useState(linecode || '');
  const [workDate, setWorkDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [itemList, setItemList] = useState<RoomTempItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 페이지 로드 시 화면 정보 설정
  useEffect(() => {
    setForm('HS604', '상온방치');
  }, [setForm]);

  // 대기/완료 카운트
  const waitingCount = itemList.filter((i) => i.status === 'waiting').length;
  const completedCount = itemList.filter((i) => i.status === 'completed').length;

  // 바코드 스캔 처리 (시작/종료 토글)
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

      const existingIdx = itemList.findIndex((i) => i.boxNo === barcode);

      if (existingIdx >= 0) {
        // 이미 있는 항목: 종료 처리
        if (itemList[existingIdx].status === 'completed') {
          showInfo('이미 완료된 항목입니다.');
          return;
        }

        setItemList((prev) =>
          prev.map((item, idx) =>
            idx === existingIdx
              ? {
                  ...item,
                  endTime: format(new Date(), 'HH:mm:ss'),
                  status: 'completed' as const,
                }
              : item
          )
        );
        showScanSuccess(`${barcode} 종료`);
      } else {
        // 새 항목: 시작 처리
        const newItem: RoomTempItem = {
          no: itemList.length + 1,
          boxNo: barcode,
          itemCode: '',
          startTime: format(new Date(), 'HH:mm:ss'),
          endTime: null,
          status: 'waiting',
        };

        setItemList((prev) => [...prev, newItem]);
        showScanSuccess(`${barcode} 시작`);
      }
    },
    [processCode, lineCode, itemList]
  );

  // 항목 삭제
  const handleDelete = (idx: number) => {
    setItemList((prev) => {
      const newList = prev.filter((_, i) => i !== idx);
      return newList.map((item, i) => ({ ...item, no: i + 1 }));
    });
  };

  // 저장
  const handleSave = async () => {
    if (itemList.length === 0) {
      showWarning('저장할 항목이 없습니다.');
      return;
    }

    const confirmed = await showConfirm(
      `${itemList.length}건을 저장하시겠습니까?`,
      { description: `대기: ${waitingCount}건, 완료: ${completedCount}건` }
    );
    if (!confirmed) return;

    setIsLoading(true);

    try {
      const response = await fetch('/api/production/room-temp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saupj: saupj || '10',
          processCode,
          lineCode,
          workDate: workDate,
          items: itemList.map((item) => ({
            boxNo: item.boxNo,
            itemCode: item.itemCode,
            startTime: item.startTime,
            endTime: item.endTime || '',
            status: item.status,
          })),
          userId: userId || 'SYSTEM',
        }),
      });

      const result: ApiResponse<{ count: number }> = await response.json();

      if (result.success) {
        showSuccess(result.message || `${itemList.length}건 저장되었습니다.`);
        setItemList([]);
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
      {/* 작업 조건 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <Thermometer className="mr-2 h-5 w-5" />
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

      {/* 바코드 스캔 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">바코드 스캔 (시작/종료)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <BarcodeInput
            placeholder="시작: 새 바코드, 종료: 기존 바코드"
            onScan={handleBarcodeScan}
            autoFocus
            disabled={!processCode || !lineCode}
          />

          {/* 항목 목록 */}
          {itemList.length > 0 && (
            <>
              <div className="flex justify-between items-center">
                <span className="text-sm">총 {itemList.length}건</span>
                <div className="flex gap-2">
                  <Badge variant="secondary">
                    <Play className="h-3 w-3 mr-1" />
                    대기: {waitingCount}
                  </Badge>
                  <Badge variant="default">
                    <Square className="h-3 w-3 mr-1" />
                    완료: {completedCount}
                  </Badge>
                </div>
              </div>

              <div className="max-h-64 overflow-auto rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">No</TableHead>
                      <TableHead>BOX</TableHead>
                      <TableHead>시작</TableHead>
                      <TableHead>종료</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead className="w-12">삭제</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemList.map((item, idx) => (
                      <TableRow
                        key={item.boxNo}
                        className={
                          item.status === 'completed' ? 'bg-green-50' : 'bg-yellow-50'
                        }
                      >
                        <TableCell>{item.no}</TableCell>
                        <TableCell className="font-mono text-xs">{item.boxNo}</TableCell>
                        <TableCell>{item.startTime}</TableCell>
                        <TableCell>{item.endTime || '-'}</TableCell>
                        <TableCell>
                          <Badge
                            variant={item.status === 'completed' ? 'default' : 'secondary'}
                          >
                            {item.status === 'completed' ? '완료' : '대기'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500"
                            onClick={() => handleDelete(idx)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 저장 버튼 */}
              <Button
                onClick={handleSave}
                disabled={itemList.length === 0 || isLoading}
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
