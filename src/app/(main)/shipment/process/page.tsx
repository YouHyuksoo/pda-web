/**
 * @file src/app/(main)/shipment/process/page.tsx
 * @description
 * 출하처리 페이지입니다. (HS400 대체)
 * 원본 C# HS400[출하처리].cs와 동일한 기능 구현
 *
 * 초보자 가이드:
 * 1. **출하일자**: 출하 처리할 날짜 선택
 * 2. **창고**: 출고할 창고 선택 (S1012)
 * 3. **출고처**: 출고처 선택 (S1012 - 4)
 * 4. **업체**: 업체 선택 (출고처 선택 시 자동 연동)
 * 5. **출고구분**: 출고 구분 선택 (B1005)
 * 6. **차수**: 자동 조회 (당일 MAX+1)
 * 7. **차량번호**: 차량번호 입력
 * 8. **BOX 스캔**: BOX 바코드 스캔하여 Grid에 추가
 * 9. **저장**: PMB900 테이블에 출하 실적 저장
 *
 * 주요 테이블:
 * - PMS100: 재고 정보
 * - PMB900: 출하 실적
 * - BMA100: 코드 마스터
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Save, Trash2, X, Package, Truck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { useAuthStore } from '@/stores/auth-store';
import { formatNumber } from '@/lib/utils/string';
import {
  showSuccess,
  showError,
  showWarning,
  showConfirm,
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

/** 콤보박스 아이템 타입 */
interface ComboItem {
  code: string;
  name: string;
}

/** 출하 BOX 그리드 아이템 (Grid1) */
interface ShipmentGridItem {
  no: number;
  itemCode: string;    // P/NO
  qty: number;         // 재고수량
  outQty: number;      // 출고량
  boxNo: string;       // BOXNO
  whsCode: string;     // 창고코드
}

/** Panel2 상세 그리드 아이템 (Grid2) */
interface DetailGridItem {
  no: number;
  itemCode: string;    // P/NO
  qty: number;         // 재고수량
  boxNo: string;       // BOXNO
  outQty: number;      // 출고량
}

export default function ShipmentProcessPage() {
  const { saupj, userId, setForm } = useAuthStore();

  // ===== Panel1 상태 (메인 입력) =====
  const [shipDate, setShipDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [warehouse, setWarehouse] = useState('');         // 창고 (cboWh)
  const [destination, setDestination] = useState('');     // 출고처 (cboOuter)
  const [customer, setCustomer] = useState('');           // 업체 (cboCustCode)
  const [outType, setOutType] = useState('');             // 출고구분 (cboType)
  const [chasu, setChasu] = useState('1');                // 차수 (txtChasu)
  const [carNo, setCarNo] = useState('');                 // 차량번호 (txtCarNo)
  const [boxNo, setBoxNo] = useState('');                 // BOX (txtBoxNo)
  const [totalSum, setTotalSum] = useState(0);            // 합계 (txtSum)

  // Grid1 데이터
  const [gridData, setGridData] = useState<ShipmentGridItem[]>([]);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  // ===== Panel2 상태 (상세 확인) =====
  const [showPanel2, setShowPanel2] = useState(false);
  const [panel2Data, setPanel2Data] = useState({
    shipDate: '',
    destination: '',
    customer: '',
    outType: '',
    boxNo: '',
  });
  const [grid2Data, setGrid2Data] = useState<DetailGridItem[]>([]);

  // ===== 콤보박스 데이터 =====
  const [warehouseList, setWarehouseList] = useState<ComboItem[]>([]);
  const [destinationList, setDestinationList] = useState<ComboItem[]>([]);
  const [customerList, setCustomerList] = useState<ComboItem[]>([]);
  const [outTypeList, setOutTypeList] = useState<ComboItem[]>([]);

  // 기타 상태
  const [isLoading, setIsLoading] = useState(false);
  const boxNoRef = useRef<HTMLInputElement>(null);
  const carNoRef = useRef<HTMLInputElement>(null);

  // ===== 페이지 초기화 =====
  useEffect(() => {
    setForm('HS400', '출하처리');
    loadComboData();
    loadChasu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setForm]);

  // 날짜 변경 시 차수 재조회
  useEffect(() => {
    loadChasu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipDate]);

  // 합계 계산
  useEffect(() => {
    const sum = gridData.reduce((acc, item) => acc + item.outQty, 0);
    setTotalSum(sum);
  }, [gridData]);

  // ===== 콤보박스 데이터 로드 =====
  const loadComboData = async () => {
    try {
      // 창고 목록 (S1012)
      const whRes = await fetch('/api/common/combo?majorCode=S1012');
      const whResult: ApiResponse<ComboItem[]> = await whRes.json();
      if (whResult.success && whResult.data) {
        setWarehouseList([{ code: '', name: '선택' }, ...whResult.data]);
      }

      // 출고처 목록 (S1012)
      const destRes = await fetch('/api/common/combo?majorCode=S1012');
      const destResult: ApiResponse<ComboItem[]> = await destRes.json();
      if (destResult.success && destResult.data) {
        setDestinationList([{ code: '', name: '선택' }, ...destResult.data]);
      }

      // 업체 목록
      const custRes = await fetch('/api/common/combo?type=customer');
      const custResult: ApiResponse<ComboItem[]> = await custRes.json();
      if (custResult.success && custResult.data) {
        setCustomerList([{ code: '', name: '선택' }, ...custResult.data]);
      }

      // 출고구분 목록 (B1005)
      const typeRes = await fetch('/api/common/combo?majorCode=B1005');
      const typeResult: ApiResponse<ComboItem[]> = await typeRes.json();
      if (typeResult.success && typeResult.data) {
        setOutTypeList([{ code: '', name: '선택' }, ...typeResult.data]);
      }
    } catch (err) {
      console.error('콤보박스 데이터 로드 오류:', err);
    }
  };

  // ===== 차수 자동 조회 (DoCHASU) =====
  const loadChasu = async () => {
    try {
      const wkDate = shipDate.replace(/-/g, '');
      const res = await fetch(`/api/shipment?action=getChasu&wkDate=${wkDate}`);
      const result: ApiResponse<{ chasu: number }> = await res.json();
      if (result.success && result.data) {
        setChasu(result.data.chasu.toString());
      }
    } catch (err) {
      console.error('차수 조회 오류:', err);
      setChasu('1');
    }
  };

  // ===== 출고처 선택 (cboOuter_SelectedIndexChanged) =====
  const handleDestinationChange = (value: string) => {
    setDestination(value);
  };

  // ===== BOX 스캔 처리 (DoBoxNo) =====
  const handleBoxScan = async () => {
    if (!boxNo.trim()) {
      return;
    }

    // 차량번호 필수 체크
    if (!carNo.trim()) {
      showWarning('차량번호를 입력하세요.');
      carNoRef.current?.focus();
      return;
    }

    // 출고처 필수 체크
    if (!destination) {
      showWarning('출고처를 선택하세요.');
      return;
    }

    // 출고구분 필수 체크
    if (!outType) {
      showWarning('출고구분을 선택하세요.');
      return;
    }

    // 중복 스캔 체크
    const isDuplicate = gridData.some((item) => item.boxNo === boxNo.toUpperCase());
    if (isDuplicate) {
      showScanError('중복스캔');
      setBoxNo('');
      boxNoRef.current?.select();
      return;
    }

    try {
      // PMS100에서 재고 조회
      const params = new URLSearchParams({
        whsCode: warehouse,
        boxNo: boxNo.toUpperCase(),
      });
      const res = await fetch(`/api/shipment/box?${params}`);
      const result: ApiResponse<{
        itemCode: string;
        pqty: number;
        boxNo: string;
        whsCode: string;
      }[]> = await res.json();

      if (result.success && result.data && result.data.length > 0) {
        // 조회된 데이터를 Grid1에 추가
        const newItems: ShipmentGridItem[] = result.data.map((item) => ({
          no: 0, // 나중에 재정렬
          itemCode: item.itemCode,
          qty: item.pqty,
          outQty: item.pqty, // 기본값: 재고수량 = 출고량
          boxNo: item.boxNo,
          whsCode: item.whsCode,
        }));

        setGridData((prev) => {
          const updated = [...newItems, ...prev];
          // 번호 재정렬 (역순으로 - 최신이 위로)
          return updated.map((item, idx) => ({
            ...item,
            no: updated.length - idx,
          }));
        });

        // Panel2 데이터 설정
        setPanel2Data({
          shipDate: shipDate,
          destination: destinationList.find((d) => d.code === destination)?.name || '',
          customer: customerList.find((c) => c.code === customer)?.name || '',
          outType: outTypeList.find((t) => t.code === outType)?.name || '',
          boxNo: boxNo.toUpperCase(),
        });

        showScanSuccess(`${newItems.length}건 추가`);
      } else {
        showScanError('해당 BOX를 찾을 수 없습니다.');
      }
    } catch (err) {
      console.error('BOX 조회 오류:', err);
      handleApiError(err, 'BOX 조회 중 오류가 발생했습니다.');
    }

    setBoxNo('');
    boxNoRef.current?.select();
  };

  // ===== BOX 입력 키 이벤트 (txtBoxNo_KeyPress) =====
  const handleBoxNoKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleBoxScan();
    }
  };

  // ===== 차량번호 입력 키 이벤트 (txtCarNo_KeyPress) =====
  const handleCarNoKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && carNo.trim()) {
      boxNoRef.current?.focus();
      boxNoRef.current?.select();
    }
  };

  // ===== 출고량 수정 =====
  const handleOutQtyChange = (index: number, value: string) => {
    const newQty = parseInt(value) || 0;
    setGridData((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, outQty: Math.min(newQty, item.qty) } : item
      )
    );
  };

  // ===== 삭제 (btnRemove_Click) =====
  const handleDelete = () => {
    if (selectedRow === null) {
      showWarning('삭제할 항목을 선택하세요.');
      return;
    }

    setGridData((prev) => {
      const updated = prev.filter((_, i) => i !== selectedRow);
      return updated.map((item, idx) => ({
        ...item,
        no: updated.length - idx,
      }));
    });
    setSelectedRow(null);
  };

  // ===== 저장 (DoSave) =====
  const handleSave = async () => {
    if (gridData.length === 0) {
      showWarning('출하할 항목이 없습니다.');
      return;
    }

    const confirmed = await showConfirm('저장하시겠습니까?');
    if (!confirmed) return;

    setIsLoading(true);

    try {
      const wkDate = shipDate.replace(/-/g, '');
      const response = await fetch('/api/shipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saupj: saupj || '10',
          wkDate: wkDate,
          chasu: chasu,
          custCode: customer,
          destCode: destination,
          outType: outType,
          carNo: carNo,
          whsCode: warehouse,
          items: gridData.map((item) => ({
            boxNo: item.boxNo,
            itemCode: item.itemCode,
            whsCode: item.whsCode,
            outQty: item.outQty,
          })),
          userId: userId || 'SYSTEM',
        }),
      });

      const result: ApiResponse<{ count: number }> = await response.json();

      if (result.success) {
        showSuccess('저장되었습니다.');

        // 저장 완료된 항목 색상 변경 (원본에서는 RoyalBlue)
        // 여기서는 상태로 표시

        // Grid 초기화
        setGridData([]);
        setTotalSum(0);

        // 차수 재조회
        loadChasu();
      } else {
        showError(result.error || '[출하처리] 오류');
      }
    } catch (err) {
      console.error('저장 오류:', err);
      handleApiError(err, '저장 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // ===== Panel2 확인 버튼 (btnOk_Click) =====
  const handlePanel2Ok = () => {
    // Grid2에서 출고량이 입력된 항목만 Grid1으로 이동
    const validItems = grid2Data.filter((item) => item.outQty > 0);

    if (validItems.length > 0) {
      const newItems: ShipmentGridItem[] = validItems.map((item) => ({
        no: 0,
        itemCode: item.itemCode,
        qty: item.qty,
        outQty: item.outQty,
        boxNo: item.boxNo,
        whsCode: warehouse,
      }));

      setGridData((prev) => {
        const updated = [...prev, ...newItems];
        return updated.map((item, idx) => ({
          ...item,
          no: idx + 1,
        }));
      });
    }

    setShowPanel2(false);
    setGrid2Data([]);
  };

  // ===== 닫기 =====
  const handleClose = () => {
    // 원본에서는 Form.Close() - 여기서는 이전 페이지로 이동 또는 무시
    if (gridData.length > 0) {
      showConfirm('작성 중인 내용이 있습니다. 닫으시겠습니까?').then((confirmed) => {
        if (confirmed) {
          window.history.back();
        }
      });
    } else {
      window.history.back();
    }
  };

  return (
    <div className="space-y-4">
      {/* ===== Panel1: 메인 입력 화면 ===== */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <Truck className="mr-2 h-5 w-5" />
            출하 처리
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 출하일자 */}
          <div className="grid grid-cols-[80px_1fr] items-center gap-2">
            <Label>출하일자</Label>
            <Input
              type="date"
              value={shipDate}
              onChange={(e) => setShipDate(e.target.value)}
            />
          </div>

          {/* 창고 */}
          <div className="grid grid-cols-[80px_1fr] items-center gap-2">
            <Label>창 고</Label>
            <Select value={warehouse} onValueChange={setWarehouse}>
              <SelectTrigger>
                <SelectValue placeholder="선택" />
              </SelectTrigger>
              <SelectContent>
                {warehouseList.map((item) => (
                  <SelectItem key={item.code || 'empty'} value={item.code || 'empty'}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 출고처 */}
          <div className="grid grid-cols-[80px_1fr] items-center gap-2">
            <Label>출 고 처</Label>
            <Select value={destination} onValueChange={handleDestinationChange}>
              <SelectTrigger>
                <SelectValue placeholder="선택" />
              </SelectTrigger>
              <SelectContent>
                {destinationList.map((item) => (
                  <SelectItem key={item.code || 'empty'} value={item.code || 'empty'}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 업체 */}
          <div className="grid grid-cols-[80px_1fr] items-center gap-2">
            <Label>업 체</Label>
            <Select value={customer} onValueChange={setCustomer} disabled>
              <SelectTrigger>
                <SelectValue placeholder="선택" />
              </SelectTrigger>
              <SelectContent>
                {customerList.map((item) => (
                  <SelectItem key={item.code || 'empty'} value={item.code || 'empty'}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 출고구분 + 차수 */}
          <div className="grid grid-cols-[80px_1fr_50px_60px] items-center gap-2">
            <Label>출고구분</Label>
            <Select value={outType} onValueChange={setOutType}>
              <SelectTrigger>
                <SelectValue placeholder="선택" />
              </SelectTrigger>
              <SelectContent>
                {outTypeList.map((item) => (
                  <SelectItem key={item.code || 'empty'} value={item.code || 'empty'}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Label className="text-right">차수</Label>
            <Input
              value={chasu}
              onChange={(e) => setChasu(e.target.value)}
              className="text-center"
              readOnly
            />
          </div>

          {/* 합계 (출고처 옆에 표시 - 원본 위치) */}
          <div className="grid grid-cols-[80px_1fr_50px_60px] items-center gap-2">
            <div></div>
            <div></div>
            <Label className="text-right">합계</Label>
            <Input
              value={formatNumber(totalSum)}
              className="text-right"
              readOnly
            />
          </div>

          {/* 차량번호 + BOX */}
          <div className="grid grid-cols-[80px_80px_40px_1fr] items-center gap-2">
            <Label>차량번호</Label>
            <Input
              ref={carNoRef}
              value={carNo}
              onChange={(e) => setCarNo(e.target.value)}
              onKeyPress={handleCarNoKeyPress}
              placeholder=""
            />
            <Label className="text-center">BOX</Label>
            <Input
              ref={boxNoRef}
              value={boxNo}
              onChange={(e) => setBoxNo(e.target.value.toUpperCase())}
              onKeyPress={handleBoxNoKeyPress}
              placeholder="바코드 스캔"
            />
          </div>
        </CardContent>
      </Card>

      {/* ===== Grid1: 출하 목록 ===== */}
      <Card>
        <CardContent className="p-2">
          <div className="max-h-48 overflow-auto rounded border">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100">
                  <TableHead className="w-10 text-center">No</TableHead>
                  <TableHead className="w-24">P/NO</TableHead>
                  <TableHead className="w-16 text-right">재고수량</TableHead>
                  <TableHead className="w-16 text-right">출고량</TableHead>
                  <TableHead>BOXNO</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gridData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                      BOX를 스캔하세요
                    </TableCell>
                  </TableRow>
                ) : (
                  gridData.map((item, index) => (
                    <TableRow
                      key={`${item.boxNo}-${index}`}
                      className={`cursor-pointer ${
                        selectedRow === index ? 'bg-blue-100' : ''
                      }`}
                      onClick={() => setSelectedRow(index)}
                    >
                      <TableCell className="text-center">{item.no}</TableCell>
                      <TableCell className="font-mono text-xs">{item.itemCode}</TableCell>
                      <TableCell className="text-right">{formatNumber(item.qty)}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          value={item.outQty}
                          onChange={(e) => handleOutQtyChange(index, e.target.value)}
                          className="h-6 w-14 text-right text-xs"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{item.boxNo}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ===== 버튼 영역 ===== */}
      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={isLoading || gridData.length === 0}
          className="flex-1"
        >
          <Save className="mr-2 h-4 w-4" />
          저장
        </Button>
        <Button
          variant="outline"
          onClick={handleDelete}
          disabled={selectedRow === null}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          삭제
        </Button>
        <Button variant="outline" onClick={handleClose}>
          <X className="mr-2 h-4 w-4" />
          닫기
        </Button>
      </div>

      {/* ===== Panel2: 상세 확인 다이얼로그 ===== */}
      <Dialog open={showPanel2} onOpenChange={setShowPanel2}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Package className="mr-2 h-5 w-5" />
              상세 확인
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* 출하일자 */}
            <div className="grid grid-cols-[80px_1fr] items-center gap-2">
              <Label>출하일자</Label>
              <Input value={panel2Data.shipDate} readOnly />
            </div>

            {/* 출고처 */}
            <div className="grid grid-cols-[80px_1fr] items-center gap-2">
              <Label>출 고 처</Label>
              <Input value={panel2Data.destination} readOnly />
            </div>

            {/* 업체 */}
            <div className="grid grid-cols-[80px_1fr] items-center gap-2">
              <Label>업 체</Label>
              <Input value={panel2Data.customer} readOnly />
            </div>

            {/* 출고구분 */}
            <div className="grid grid-cols-[80px_1fr] items-center gap-2">
              <Label>출고구분</Label>
              <Input value={panel2Data.outType} readOnly />
            </div>

            {/* BOX */}
            <div className="grid grid-cols-[80px_1fr] items-center gap-2">
              <Label>BOX</Label>
              <Input value={panel2Data.boxNo} readOnly />
            </div>

            {/* Grid2 */}
            <div className="max-h-40 overflow-auto rounded border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100">
                    <TableHead className="w-10 text-center">No</TableHead>
                    <TableHead className="w-24">P/NO</TableHead>
                    <TableHead className="w-16 text-right">재고수량</TableHead>
                    <TableHead>BOXNO</TableHead>
                    <TableHead className="w-16 text-right">출고량</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grid2Data.map((item, index) => (
                    <TableRow key={`${item.boxNo}-${index}`}>
                      <TableCell className="text-center">{item.no}</TableCell>
                      <TableCell className="font-mono text-xs">{item.itemCode}</TableCell>
                      <TableCell className="text-right">{formatNumber(item.qty)}</TableCell>
                      <TableCell className="font-mono text-xs">{item.boxNo}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          value={item.outQty}
                          onChange={(e) => {
                            const newQty = parseInt(e.target.value) || 0;
                            setGrid2Data((prev) =>
                              prev.map((g, i) =>
                                i === index ? { ...g, outQty: newQty } : g
                              )
                            );
                          }}
                          className="h-6 w-14 text-right text-xs"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* 버튼 */}
            <div className="flex gap-2 pt-2">
              <Button onClick={handlePanel2Ok} className="flex-1">
                확인
              </Button>
              <Button variant="outline" onClick={() => setShowPanel2(false)}>
                닫기
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
