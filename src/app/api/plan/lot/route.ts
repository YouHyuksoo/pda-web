/**
 * @file src/app/api/plan/lot/route.ts
 * @description
 * LOT 정보 조회 API 엔드포인트입니다.
 * 바코드 스캔으로 LOT 정보를 조회합니다.
 *
 * @example
 * GET /api/plan/lot?lotNo=LOT001
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';

/**
 * GET /api/plan/lot
 * LOT 정보 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lotNo = searchParams.get('lotNo');

    if (!lotNo) {
      return error('LOT 번호를 입력해주세요.');
    }

    const sql = `
      SELECT
        A.LOTNO AS LOT_NO,
        A.ITEMCODE AS PART_CODE,
        B.ITEM_NAME AS PART_NAME,
        A.PQTY AS QTY,
        A.WHSCODE AS WHS_CODE
      FROM PMS100 A
      LEFT JOIN BOM_MASTER B ON A.ITEMCODE = B.ITEM_CODE
      WHERE A.LOTNO = :lotNo
        AND A.PQTY > 0
    `;

    const result = await oracle.query(sql, { lotNo });

    if (!result.success || !result.data || result.data.length === 0) {
      return error('해당 LOT를 찾을 수 없거나 재고가 없습니다.');
    }

    const row = result.data[0] as Record<string, unknown>;

    return success({
      lotNo: row.LOT_NO,
      partCode: row.PART_CODE || '',
      partName: row.PART_NAME || '',
      qty: row.QTY || 0,
      whsCode: row.WHS_CODE || '',
    });
  } catch (err) {
    console.error('LOT 조회 오류:', err);
    return serverError('LOT 조회 중 오류가 발생했습니다.');
  }
}
