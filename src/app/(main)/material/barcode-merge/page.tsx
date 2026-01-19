/**
 * @file src/app/(main)/material/barcode-merge/page.tsx
 * @description 바코드병합 페이지 (HSJ220 대체)
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Combine, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarcodeInput } from '@/components/forms/BarcodeInput';
import { useAuthStore } from '@/stores/auth-store';

interface MergeItem { no: number; boxNo: string; itemCode: string; qty: number; }

export default function BarcodeMergePage() {
  const { setForm } = useAuthStore();
  const [newBoxNo, setNewBoxNo] = useState('');
  const [itemList, setItemList] = useState<MergeItem[]>([]);
  const [totalQty, setTotalQty] = useState(0);

  useEffect(() => { setForm('HSJ220', '바코드병합'); }, [setForm]);
  useEffect(() => { setTotalQty(itemList.reduce((acc, item) => acc + item.qty, 0)); }, [itemList]);

  const handleBarcodeScan = useCallback((barcode: string) => {
    if (itemList.some(i => i.boxNo === barcode)) { alert('이미 등록된 BOX입니다.'); return; }
    // TODO: API로 바코드 정보 조회
    setItemList(prev => [...prev, { no: prev.length + 1, boxNo: barcode, itemCode: 'ITEM001', qty: Math.floor(Math.random() * 50) + 10 }]);
  }, [itemList]);

  const handleDelete = (idx: number) => setItemList(prev => prev.filter((_, i) => i !== idx).map((item, i) => ({ ...item, no: i + 1 })));

  const handleSave = () => {
    if (itemList.length < 2) { alert('2개 이상의 BOX를 등록하세요.'); return; }
    if (!newBoxNo) { alert('새 BOX NO를 입력하세요.'); return; }
    alert(`${itemList.length}개 BOX가 ${newBoxNo}로 병합되었습니다.`);
    setItemList([]);
    setNewBoxNo('');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="flex items-center text-base"><Combine className="mr-2 h-5 w-5" />바코드 병합</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>새 BOX NO</Label>
            <Input value={newBoxNo} onChange={e => setNewBoxNo(e.target.value)} placeholder="병합될 새 BOX NO 입력" />
          </div>
          <BarcodeInput label="기존 BOX NO 스캔" onScan={handleBarcodeScan} autoFocus />
        </CardContent>
      </Card>
      {itemList.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">병합 대상 ({itemList.length}건, 총 {totalQty}EA)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader><TableRow><TableHead>No</TableHead><TableHead>BOX</TableHead><TableHead>품목</TableHead><TableHead className="text-right">수량</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {itemList.map((item, idx) => (
                  <TableRow key={item.boxNo}><TableCell>{item.no}</TableCell><TableCell className="font-mono">{item.boxNo}</TableCell><TableCell>{item.itemCode}</TableCell><TableCell className="text-right">{item.qty}</TableCell><TableCell><Button variant="ghost" size="icon" onClick={() => handleDelete(idx)}><Trash2 className="h-4 w-4 text-red-500" /></Button></TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
            <Button onClick={handleSave} className="w-full" disabled={itemList.length < 2}><Save className="mr-2 h-4 w-4" />병합 저장</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
