/**
 * @file src/app/(main)/production/cart-stock/page.tsx
 * @description
 * 대차재고현황 페이지입니다. (HS810 대체)
 * 대차별 재고 현황을 조회합니다.
 *
 * 초보자 가이드:
 * 1. **공정/라인 선택**: 조회할 공정과 라인 선택 (선택사항)
 * 2. **대차번호 입력**: 특정 대차 조회 시 입력 (선택사항)
 * 3. **조회**: 조회 버튼으로 대차재고 확인
 */

'use client';

import { useState, useEffect } from 'react';
import { Search, ShoppingCart, RefreshCw } from 'lucide-react';

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

import { ProcessSelect, LineSelect } from '@/components/forms/ProcessLineSelect';
import { useAuthStore } from '@/stores/auth-store';
import { formatNumber } from '@/lib/utils/string';
import {
  showError,
  showInfo,
  handleApiError,
} from '@/lib/utils/toast';

/** 대차재고 타입 */
interface CartStock {
  cartNo: string;
  itemCode: string;
  itemName: string;
  qty: number;
  location: string;
  lastUpdate: string;
}

/** API 응답 인터페이스 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export default function CartStockPage() {
  const { opcode, linecode, setForm } = useAuthStore();

  // 상태 관리
  const [processCode, setProcessCode] = useState(opcode || '');
  const [lineCode, setLineCode] = useState(linecode || '');
  const [cartNo, setCartNo] = useState('');
  const [stockList, setStockList] = useState<CartStock[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 페이지 로드 시 화면 정보 설정
  useEffect(() => {
    setForm('HS810', '대차재고현황');
  }, [setForm]);

  // 조회
  const handleSearch = async () => {
    setIsLoading(true);

    try {
      const params = new URLSearchParams();
      if (processCode) params.append('processCode', processCode);
      if (lineCode) params.append('lineCode', lineCode);
      if (cartNo) params.append('cartNo', cartNo);

      const response = await fetch(`/api/production/cart-stock?${params}`);
      const result: ApiResponse<CartStock[]> = await response.json();

      if (result.success && result.data) {
        setStockList(result.data);
        if (result.data.length === 0) {
          showInfo('조회 결과가 없습니다.');
        }
      } else {
        showError(result.error || '조회 실패');
        setStockList([]);
      }
    } catch (err) {
      console.error('조회 오류:', err);
      handleApiError(err, '조회 중 오류가 발생했습니다.');
      setStockList([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 초기화
  const handleReset = () => {
    setCartNo('');
    setStockList([]);
  };

  // 대차별 그룹핑
  const groupedByCart = stockList.reduce((acc, item) => {
    if (!acc[item.cartNo]) acc[item.cartNo] = [];
    acc[item.cartNo].push(item);
    return acc;
  }, {} as Record<string, CartStock[]>);

  return (
    <div className="space-y-4">
      {/* 조회 조건 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <ShoppingCart className="mr-2 h-5 w-5" />
            조회 조건
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <ProcessSelect value={processCode} onChange={setProcessCode} label="공정" />
            <LineSelect value={lineCode} onChange={setLineCode} label="라인" />
          </div>
          <div className="space-y-2">
            <Label>대차번호</Label>
            <Input
              value={cartNo}
              onChange={(e) => setCartNo(e.target.value)}
              placeholder="대차번호 입력 (선택)"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSearch} disabled={isLoading} className="flex-1">
              <Search className="mr-2 h-4 w-4" />
              조회
            </Button>
            <Button onClick={handleReset} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              초기화
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 대차별 재고 목록 */}
      {Object.keys(groupedByCart).length > 0 && (
        <div className="space-y-4">
          {Object.entries(groupedByCart).map(([cart, items]) => {
            const totalQty = items.reduce((acc, item) => acc + item.qty, 0);
            return (
              <Card key={cart}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>{cart}</span>
                    <div className="flex gap-2">
                      <Badge variant="outline">{items.length}종</Badge>
                      <Badge variant="default">{formatNumber(totalQty)}EA</Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-48 overflow-auto rounded border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>품목</TableHead>
                          <TableHead className="text-right">수량</TableHead>
                          <TableHead>위치</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <div className="font-medium">{item.itemCode}</div>
                              <div className="text-xs text-gray-500">{item.itemName}</div>
                            </TableCell>
                            <TableCell className="text-right font-bold">
                              {formatNumber(item.qty)}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {item.location}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 조회 결과 없음 */}
      {stockList.length === 0 && !isLoading && (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            조회 버튼을 눌러 대차재고를 확인하세요.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
