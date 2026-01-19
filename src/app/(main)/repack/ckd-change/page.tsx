/**
 * @file src/app/(main)/repack/ckd-change/page.tsx
 * @description
 * CKD품번변경 페이지입니다. (HS320 대체)
 * BOX의 품번을 변경 처리합니다.
 *
 * 초보자 가이드:
 * 1. **BOX 스캔**: 품번 변경할 BOX 바코드 스캔
 * 2. **품번 선택**: 변경할 새 품번 검색/선택
 * 3. **추가**: 변경 목록에 추가
 * 4. **저장**: 품번 변경 완료
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Save, Trash2, Search } from 'lucide-react';
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
import { BarcodeInput } from '@/components/forms/BarcodeInput';
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

/** 원본 BOX 타입 */
interface SourceItem {
  boxNo: string;
  itemCode: string;
  itemName: string;
  qty: number;
}

/** 변경 항목 타입 */
interface ChangeItem {
  no: number;
  boxNo: string;
  oldItemCode: string;
  newItemCode: string;
  newItemName: string;
  qty: number;
}

export default function CkdChangePage() {
  const { saupj, userId, setForm } = useAuthStore();
  const [sourceItem, setSourceItem] = useState<SourceItem | null>(null);
  const [newItemCode, setNewItemCode] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [changeList, setChangeList] = useState<ChangeItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setForm('HS320', 'CKD품번변경');
  }, [setForm]);

  // BOX 바코드 스캔
  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      if (changeList.some((c) => c.boxNo === barcode)) {
        showWarning('이미 등록된 BOX입니다.');
        return;
      }

      try {
        const params = new URLSearchParams({ boxNo: barcode });
        const response = await fetch(`/api/repack/ckd-change?${params}`);
        const result: ApiResponse<SourceItem> = await response.json();

        if (result.success && result.data) {
          setSourceItem(result.data);
          setNewItemCode('');
          setNewItemName('');
          showScanSuccess(`${barcode} 조회 완료`);
        } else {
          showScanError(result.error || 'BOX 조회 실패');
          setSourceItem(null);
        }
      } catch (err) {
        console.error('BOX 조회 오류:', err);
        showScanError('BOX 조회 중 오류가 발생했습니다.');
      }
    },
    [changeList]
  );

  // 품목 검색
  const handleNewItemSearch = async () => {
    if (!searchKeyword) {
      showWarning('검색어를 입력하세요.');
      return;
    }

    setIsLoading(true);

    try {
      const params = new URLSearchParams({
        type: 'item',
        itemCode: searchKeyword,
      });
      const response = await fetch(`/api/repack/ckd-change?${params}`);
      const result: ApiResponse<Array<{ itemCode: string; itemName: string }>> =
        await response.json();

      if (result.success && result.data && result.data.length > 0) {
        // 첫 번째 결과 선택 (실제로는 팝업으로 선택하게 할 수 있음)
        setNewItemCode(result.data[0].itemCode);
        setNewItemName(result.data[0].itemName);
        showSuccess(`${result.data.length}건 검색됨`);
      } else {
        showWarning('검색 결과가 없습니다.');
      }
    } catch (err) {
      console.error('품목 검색 오류:', err);
      handleApiError(err, '품목 검색 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 변경 목록에 추가
  const handleAdd = () => {
    if (!sourceItem) {
      showWarning('BOX를 스캔하세요.');
      return;
    }
    if (!newItemCode) {
      showWarning('변경할 품번을 선택하세요.');
      return;
    }
    if (sourceItem.itemCode === newItemCode) {
      showWarning('동일한 품번입니다.');
      return;
    }

    setChangeList((prev) => [
      ...prev,
      {
        no: prev.length + 1,
        boxNo: sourceItem.boxNo,
        oldItemCode: sourceItem.itemCode,
        newItemCode,
        newItemName,
        qty: sourceItem.qty,
      },
    ]);
    setSourceItem(null);
    setNewItemCode('');
    setNewItemName('');
    setSearchKeyword('');
  };

  // 항목 삭제
  const handleDelete = (idx: number) => {
    setChangeList((prev) =>
      prev.filter((_, i) => i !== idx).map((item, i) => ({ ...item, no: i + 1 }))
    );
  };

  // 저장
  const handleSave = async () => {
    if (changeList.length === 0) {
      showWarning('변경할 항목이 없습니다.');
      return;
    }

    const confirmed = await showConfirm(
      `${changeList.length}건의 품번을 변경하시겠습니까?`
    );
    if (!confirmed) return;

    setIsLoading(true);

    try {
      const response = await fetch('/api/repack/ckd-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saupj: saupj || '10',
          changeList,
          userId: userId || 'SYSTEM',
        }),
      });

      const result: ApiResponse<{ count: number }> = await response.json();

      if (result.success) {
        showSuccess(result.message || '품번 변경 처리되었습니다.');
        setChangeList([]);
      } else {
        showError(result.error || '품번 변경 실패');
      }
    } catch (err) {
      console.error('품번 변경 처리 오류:', err);
      handleApiError(err, '품번 변경 처리 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* BOX 스캔 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <RefreshCw className="mr-2 h-5 w-5" />
            BOX 스캔
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <BarcodeInput label="BOX 바코드" onScan={handleBarcodeScan} autoFocus />

          {sourceItem && (
            <>
              <div className="space-y-1 rounded-lg bg-gray-50 p-4">
                <div className="text-sm font-medium text-gray-500">현재 품번</div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">BOX NO</span>
                  <span className="font-mono">{sourceItem.boxNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">품목</span>
                  <span className="font-bold">{sourceItem.itemCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">품명</span>
                  <span>{sourceItem.itemName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">수량</span>
                  <span>{formatNumber(sourceItem.qty)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>변경할 품번 검색</Label>
                <div className="flex gap-2">
                  <Input
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    placeholder="품번 또는 품명 입력"
                    onKeyDown={(e) => e.key === 'Enter' && handleNewItemSearch()}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleNewItemSearch}
                    disabled={isLoading}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {newItemCode && (
                <>
                  <div className="space-y-1 rounded-lg bg-blue-50 p-4">
                    <div className="text-sm font-medium text-blue-600">변경 후 품번</div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">품목</span>
                      <span className="font-bold">{newItemCode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">품명</span>
                      <span>{newItemName}</span>
                    </div>
                  </div>
                </>
              )}

              <Button
                onClick={handleAdd}
                variant="outline"
                className="w-full"
                disabled={!newItemCode}
              >
                변경 목록에 추가
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* 변경 목록 */}
      {changeList.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">변경 목록 ({changeList.length}건)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-48 overflow-auto rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No</TableHead>
                    <TableHead>BOX</TableHead>
                    <TableHead>변경 전</TableHead>
                    <TableHead>변경 후</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {changeList.map((item, idx) => (
                    <TableRow key={item.boxNo}>
                      <TableCell>{item.no}</TableCell>
                      <TableCell className="font-mono text-xs">{item.boxNo}</TableCell>
                      <TableCell className="text-xs">{item.oldItemCode}</TableCell>
                      <TableCell className="text-xs font-bold text-blue-600">
                        {item.newItemCode}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(idx)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button onClick={handleSave} className="w-full" disabled={isLoading}>
              <Save className="mr-2 h-4 w-4" />
              품번 변경 완료 ({changeList.length}건)
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
