/**
 * @file src/app/(main)/production/input/page.tsx
 * @description
 * 생산투입 페이지입니다. (HS600 대체)
 * 자재를 생산라인에 투입하고 관리합니다.
 *
 * 초보자 가이드:
 * 1. **공정/라인 선택**: 작업할 공정과 라인 선택
 * 2. **작업지시 조회**: 선택한 조건으로 생산계획 조회
 * 3. **자재 바코드 스캔**: 투입할 자재 바코드 스캔
 * 4. **저장**: 투입 내역 저장
 *
 * 주요 테이블:
 * - PMA200: 생산계획 마스터
 * - SLOT_INPUT: 슬롯 투입 정보
 * - PMS100: 재고 정보
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Search, Save, Trash2, RefreshCw, PackagePlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
  showInfo,
  showConfirm,
  showScanSuccess,
  showScanError,
  handleApiError,
} from '@/lib/utils/toast';

// 작업지시 타입
interface WorkOrder {
  no: number;
  itemCode: string;
  itemName: string;
  orderNo: string;
  planQty: number;
  remainQty: number;
  startTime: string;
  endTime: string;
  inputQty: number;
  workOrder: string;
}

// 투입 자재 타입
interface InputMaterial {
  no: number;
  itemCode: string;
  itemName: string;
  qty: number;
  inputQty: number;
  boxNo: string;
  whCode: string;
  flag: string;
}

/** API 응답 인터페이스 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export default function ProductionInputPage() {
  const { opcode, linecode, saupj, userId, setForm } = useAuthStore();

  // 상태 관리
  const [processCode, setProcessCode] = useState(opcode || '');
  const [lineCode, setLineCode] = useState(linecode || '');
  const [workDate, setWorkDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [autoMode, setAutoMode] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // 작업지시 목록
  const [orderList, setOrderList] = useState<WorkOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);

  // 투입 자재 목록
  const [materialList, setMaterialList] = useState<InputMaterial[]>([]);

  // 현재 선택된 작업 정보
  const [currentItemCode, setCurrentItemCode] = useState('');
  const [currentPlanQty, setCurrentPlanQty] = useState(0);
  const [currentRemainQty, setCurrentRemainQty] = useState(0);
  const [currentInputQty, setCurrentInputQty] = useState(0);

  // 페이지 로드 시 화면 정보 설정
  useEffect(() => {
    setForm('HS600', '생산투입');
  }, [setForm]);

  // 작업지시 선택 시 정보 업데이트
  useEffect(() => {
    if (selectedOrder) {
      setCurrentItemCode(selectedOrder.itemCode);
      setCurrentPlanQty(selectedOrder.planQty);
      setCurrentRemainQty(selectedOrder.remainQty);
      setCurrentInputQty(selectedOrder.inputQty);
    }
  }, [selectedOrder]);

  // 작업지시 조회
  const handleSearch = useCallback(async () => {
    if (!processCode || !lineCode) {
      showWarning('공정과 라인을 선택하세요.');
      return;
    }

    setIsLoading(true);

    try {
      // 실제 API 연동
      const params = new URLSearchParams({
        opCode: processCode,
        lineCode: lineCode,
        planDate: workDate,
        saupj: saupj || '10',
      });

      const response = await fetch(`/api/production/input?${params}`);
      const result: ApiResponse<WorkOrder[]> = await response.json();

      if (!result.success) {
        showError(result.error || result.message || '조회 실패');
        setOrderList([]);
        return;
      }

      const orders = result.data || [];
      setOrderList(orders);

      if (orders.length > 0) {
        if (autoMode) {
          setSelectedOrder(orders[0]);
          // 해당 작업지시의 투입 자재 목록 조회
          loadMaterialList(orders[0].workOrder);
        }
        showSuccess(`${orders.length}건 조회되었습니다.`);
      } else {
        showInfo(result.message || '조회된 데이터가 없습니다.');
      }
    } catch (error) {
      console.error('조회 오류:', error);
      handleApiError(error, '조회 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [processCode, lineCode, workDate, saupj, autoMode]);

  // 투입 자재 목록 조회
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const loadMaterialList = async (workOrder: string) => {
    // TODO: 실제 API 연동 - workOrder로 자재 목록 조회
    // 임시 데이터 - 해당 작업지시에 필요한 자재 목록
    const mockMaterials: InputMaterial[] = [
      {
        no: 1,
        itemCode: 'MAT001',
        itemName: 'PCB 기판',
        qty: 100,
        inputQty: 0,
        boxNo: '',
        whCode: 'WH01',
        flag: 'N',
      },
      {
        no: 2,
        itemCode: 'MAT002',
        itemName: 'IC 칩',
        qty: 200,
        inputQty: 0,
        boxNo: '',
        whCode: 'WH01',
        flag: 'N',
      },
      {
        no: 3,
        itemCode: 'MAT003',
        itemName: '저항',
        qty: 1000,
        inputQty: 0,
        boxNo: '',
        whCode: 'WH02',
        flag: 'N',
      },
    ];
    setMaterialList(mockMaterials);
  };

  // 작업지시 선택
  const handleOrderSelect = (order: WorkOrder) => {
    setSelectedOrder(order);
    loadMaterialList(order.workOrder);
  };

  // 바코드 스캔 처리
  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      if (!selectedOrder) {
        showWarning('작업지시를 먼저 선택하세요.');
        return;
      }

      if (!barcode) {
        showWarning('바코드를 입력하세요.');
        return;
      }

      // 중복 체크
      const existingMaterial = materialList.find((m) => m.boxNo === barcode);
      if (existingMaterial) {
        showScanError('이미 투입된 자재입니다.');
        return;
      }

      try {
        // 실제 API 연동 - 바코드로 자재 정보 조회
        const params = new URLSearchParams({
          boxNo: barcode,
          opCode: processCode,
        });
        const response = await fetch(`/api/production/input/box?${params}`);
        const result: ApiResponse<{
          boxNo: string;
          itemCode: string;
          itemName: string;
          qty: number;
          whsCode: string;
        }> = await response.json();

        if (!result.success || !result.data) {
          showScanError(result.error || '해당 BOX를 찾을 수 없습니다.');
          return;
        }

        const boxData = result.data;

        // 새 자재 항목 추가
        setMaterialList((prev) => [
          ...prev,
          {
            no: prev.length + 1,
            itemCode: boxData.itemCode,
            itemName: boxData.itemName,
            qty: boxData.qty,
            inputQty: boxData.qty,
            boxNo: boxData.boxNo,
            whCode: boxData.whsCode,
            flag: 'Y',
          },
        ]);

        // 스캔 성공 피드백
        showScanSuccess(`${boxData.itemCode} 스캔 완료`);
      } catch (error) {
        console.error('바코드 처리 오류:', error);
        showScanError('바코드 처리 중 오류가 발생했습니다.');
      }
    },
    [selectedOrder, materialList, processCode]
  );

  // 투입 취소
  const handleCancelInput = (index: number) => {
    setMaterialList((prev) =>
      prev.map((item, i) => {
        if (i === index) {
          return {
            ...item,
            boxNo: '',
            inputQty: 0,
            flag: 'N',
          };
        }
        return item;
      })
    );
  };

  // 저장
  const handleSave = async () => {
    const inputItems = materialList.filter((m) => m.flag === 'Y');
    if (inputItems.length === 0) {
      showWarning('투입할 자재가 없습니다.');
      return;
    }

    const confirmed = await showConfirm(
      `${inputItems.length}건의 자재를 투입하시겠습니까?`
    );
    if (!confirmed) return;

    setIsLoading(true);

    try {
      // 실제 API 연동
      const response = await fetch('/api/production/input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saupj: saupj || '10',
          opCode: processCode,
          lineCode: lineCode,
          planDate: workDate,
          workOrder: selectedOrder?.workOrder || '',
          items: inputItems.map((item) => ({
            boxNo: item.boxNo,
            itemCode: item.itemCode,
            inputQty: item.inputQty,
            whsCode: item.whCode,
          })),
          userId: userId || 'SYSTEM',
        }),
      });

      const result: ApiResponse<{ count: number }> = await response.json();

      if (!result.success) {
        showError(result.error || '저장 실패');
        return;
      }

      showSuccess(result.message || `${inputItems.length}건 저장되었습니다.`);
      setMaterialList([]);
      handleSearch(); // 새로고침
    } catch (error) {
      console.error('저장 오류:', error);
      handleApiError(error, '저장 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 초기화
  const handleReset = () => {
    setSelectedOrder(null);
    setMaterialList([]);
    setCurrentItemCode('');
    setCurrentPlanQty(0);
    setCurrentRemainQty(0);
    setCurrentInputQty(0);
  };

  return (
    <div className="space-y-4">
      {/* 조회 조건 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">조회 조건</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <ProcessSelect
              value={processCode}
              onChange={setProcessCode}
              label="공정"
            />
            <LineSelect
              value={lineCode}
              onChange={setLineCode}
              label="라인"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>작업일자</Label>
              <Input
                type="date"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="autoMode"
                  checked={autoMode}
                  onCheckedChange={(checked) => setAutoMode(checked as boolean)}
                />
                <Label htmlFor="autoMode" className="text-sm">
                  자동선택
                </Label>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSearch} disabled={isLoading} className="flex-1">
              <Search className="mr-2 h-4 w-4" />
              조회
            </Button>
            <Button variant="outline" onClick={handleReset}>
              <RefreshCw className="mr-2 h-4 w-4" />
              초기화
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 작업지시 목록 */}
      {orderList.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">작업지시</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-40 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">선택</TableHead>
                    <TableHead>품목</TableHead>
                    <TableHead className="text-right">계획</TableHead>
                    <TableHead className="text-right">잔량</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderList.map((order) => (
                    <TableRow
                      key={order.orderNo}
                      className={
                        selectedOrder?.orderNo === order.orderNo
                          ? 'bg-blue-50'
                          : 'cursor-pointer hover:bg-gray-50'
                      }
                      onClick={() => handleOrderSelect(order)}
                    >
                      <TableCell>
                        <input
                          type="radio"
                          name="order"
                          checked={selectedOrder?.orderNo === order.orderNo}
                          onChange={() => handleOrderSelect(order)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{order.itemCode}</div>
                        <div className="text-xs text-gray-500">{order.itemName}</div>
                      </TableCell>
                      <TableCell className="text-right">{order.planQty}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={order.remainQty > 0 ? 'secondary' : 'default'}>
                          {order.remainQty}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 자재 투입 */}
      {selectedOrder && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-base">
              <PackagePlus className="mr-2 h-5 w-5" />
              자재 투입
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 현재 작업 정보 */}
            <div className="grid grid-cols-2 gap-2 rounded bg-gray-50 p-3 text-sm">
              <div>
                <span className="text-gray-500">품목:</span>{' '}
                <span className="font-medium">{currentItemCode}</span>
              </div>
              <div>
                <span className="text-gray-500">계획:</span>{' '}
                <span className="font-medium">{currentPlanQty}</span>
              </div>
              <div>
                <span className="text-gray-500">잔량:</span>{' '}
                <span className="font-medium text-orange-600">{currentRemainQty}</span>
              </div>
              <div>
                <span className="text-gray-500">투입:</span>{' '}
                <span className="font-medium text-blue-600">{currentInputQty}</span>
              </div>
            </div>

            {/* 바코드 입력 */}
            <BarcodeInput
              label="자재 바코드"
              placeholder="자재 바코드를 스캔하세요"
              onScan={handleBarcodeScan}
              autoFocus
            />

            {/* 투입 자재 목록 */}
            {materialList.length > 0 && (
              <div>
                <Label className="mb-2 block">투입 자재 목록</Label>
                <div className="max-h-48 overflow-auto rounded border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>품목</TableHead>
                        <TableHead>BOX NO</TableHead>
                        <TableHead className="text-right">수량</TableHead>
                        <TableHead className="w-12">취소</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {materialList.map((item, index) => (
                        <TableRow
                          key={`${item.itemCode}-${index}`}
                          className={item.flag === 'Y' ? 'bg-green-50' : ''}
                        >
                          <TableCell>
                            <div className="text-sm font-medium">{item.itemCode}</div>
                            <div className="text-xs text-gray-500">{item.itemName}</div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {item.boxNo || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.flag === 'Y' ? (
                              <Badge>{item.inputQty}</Badge>
                            ) : (
                              <span className="text-gray-400">{item.qty}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {item.flag === 'Y' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500"
                                onClick={() => handleCancelInput(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* 저장 버튼 */}
            <Button
              onClick={handleSave}
              disabled={!materialList.some((m) => m.flag === 'Y') || isLoading}
              className="w-full"
            >
              <Save className="mr-2 h-4 w-4" />
              저장 ({materialList.filter((m) => m.flag === 'Y').length}건)
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
