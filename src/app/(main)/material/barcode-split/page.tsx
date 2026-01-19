/**
 * @file src/app/(main)/material/barcode-split/page.tsx
 * @description 바코드분할 페이지 (HSJ240 대체)
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Split, Plus, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarcodeInput } from '@/components/forms/BarcodeInput';
import { useAuthStore } from '@/stores/auth-store';

interface SplitTarget { newBoxNo: string; qty: number; }
interface SourceBox { boxNo: string; itemCode: string; itemName: string; totalQty: number; }

export default function BarcodeSplitPage() {
  const { setForm } = useAuthStore();
  const [sourceBox, setSourceBox] = useState<SourceBox | null>(null);
  const [splitList, setSplitList] = useState<SplitTarget[]>([]);
  const [newBoxNo, setNewBoxNo] = useState('');
  const [splitQty, setSplitQty] = useState('');

  useEffect(() => { setForm('HSJ240', '바코드분할'); }, [setForm]);

  const handleSourceScan = useCallback((barcode: string) => {
    // TODO: API로 바코드 정보 조회
    setSourceBox({ boxNo: barcode, itemCode: 'ITEM001', itemName: '자재A', totalQty: 100 });
    setSplitList([]);
  }, []);

  const handleAddSplit = () => {
    if (!newBoxNo || !splitQty) { alert('새 BOX NO와 수량을 입력하세요.'); return; }
    const qty = parseInt(splitQty);
    if (isNaN(qty) || qty <= 0) { alert('올바른 수량을 입력하세요.'); return; }
    const usedQty = splitList.reduce((acc, item) => acc + item.qty, 0);
    if (sourceBox && usedQty + qty > sourceBox.totalQty) { alert('분할 수량이 원본 수량을 초과합니다.'); return; }
    if (splitList.some(s => s.newBoxNo === newBoxNo)) { alert('이미 등록된 BOX NO입니다.'); return; }
    setSplitList(prev => [...prev, { newBoxNo, qty }]);
    setNewBoxNo('');
    setSplitQty('');
  };

  const handleDelete = (idx: number) => setSplitList(prev => prev.filter((_, i) => i !== idx));

  const handleSave = () => {
    if (!sourceBox) { alert('원본 BOX를 스캔하세요.'); return; }
    if (splitList.length === 0) { alert('분할 대상을 추가하세요.'); return; }
    alert(`${sourceBox.boxNo}가 ${splitList.length}개로 분할되었습니다.`);
    setSourceBox(null);
    setSplitList([]);
  };

  const usedQty = splitList.reduce((acc, item) => acc + item.qty, 0);
  const remainQty = sourceBox ? sourceBox.totalQty - usedQty : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="flex items-center text-base"><Split className="mr-2 h-5 w-5" />원본 BOX</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <BarcodeInput label="원본 BOX NO 스캔" onScan={handleSourceScan} autoFocus />
          {sourceBox && (
            <div className="rounded-lg bg-blue-50 p-4 space-y-1">
              <div className="flex justify-between"><span className="text-sm text-gray-600">BOX NO</span><span className="font-mono">{sourceBox.boxNo}</span></div>
              <div className="flex justify-between"><span className="text-sm text-gray-600">품목</span><span>{sourceBox.itemCode} - {sourceBox.itemName}</span></div>
              <div className="flex justify-between"><span className="text-sm text-gray-600">총 수량</span><span className="font-bold">{sourceBox.totalQty}</span></div>
              <div className="flex justify-between"><span className="text-sm text-gray-600">잔여 수량</span><span className="font-bold text-blue-600">{remainQty}</span></div>
            </div>
          )}
        </CardContent>
      </Card>
      {sourceBox && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">분할 등록</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>새 BOX NO</Label><Input value={newBoxNo} onChange={e => setNewBoxNo(e.target.value)} placeholder="새 BOX NO" /></div>
              <div className="space-y-2"><Label>수량</Label><Input type="number" value={splitQty} onChange={e => setSplitQty(e.target.value)} placeholder="수량" /></div>
            </div>
            <Button onClick={handleAddSplit} variant="outline" className="w-full"><Plus className="mr-2 h-4 w-4" />분할 추가</Button>
            {splitList.length > 0 && (
              <>
                <Table>
                  <TableHeader><TableRow><TableHead>새 BOX NO</TableHead><TableHead className="text-right">수량</TableHead><TableHead></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {splitList.map((item, idx) => (
                      <TableRow key={item.newBoxNo}><TableCell className="font-mono">{item.newBoxNo}</TableCell><TableCell className="text-right">{item.qty}</TableCell><TableCell><Button variant="ghost" size="icon" onClick={() => handleDelete(idx)}><Trash2 className="h-4 w-4 text-red-500" /></Button></TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Button onClick={handleSave} className="w-full"><Save className="mr-2 h-4 w-4" />분할 저장 ({splitList.length}건)</Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
