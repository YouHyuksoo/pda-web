/**
 * @file src/app/api/production/cart-stock/route.ts
 * @description
 * 대차재고현황 API 엔드포인트입니다.
 * 대차별 재고 현황을 조회합니다.
 *
 * @example
 * GET /api/production/cart-stock?processCode=P01&lineCode=L01&cartNo=CART001
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, serverError } from '@/lib/api/response';

/**
 * GET /api/production/cart-stock
 * 대차재고 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const processCode = searchParams.get('processCode');
    const lineCode = searchParams.get('lineCode');
    const cartNo = searchParams.get('cartNo');

    let sql = `
      SELECT
        A.CART_NO,
        A.ITEM_CODE,
        B.ITEM_NAME,
        A.QTY,
        A.LOCATION,
        TO_CHAR(A.UPD_DATE, 'YYYY-MM-DD HH24:MI') AS LAST_UPDATE
      FROM PMS200 A
      LEFT JOIN BOM_MASTER B ON A.ITEM_CODE = B.ITEM_CODE
      WHERE A.QTY > 0
    `;

    const params: Record<string, unknown> = {};

    if (processCode) {
      sql += ' AND A.PROCESS_CODE = :processCode';
      params.processCode = processCode;
    }

    if (lineCode) {
      sql += ' AND A.LINE_CODE = :lineCode';
      params.lineCode = lineCode;
    }

    if (cartNo) {
      sql += ' AND A.CART_NO LIKE :cartNo';
      params.cartNo = `%${cartNo}%`;
    }

    sql += ' ORDER BY A.CART_NO, A.ITEM_CODE';

    const result = await oracle.query(sql, params);

    if (!result.success) {
      return serverError(result.error || 'DB 조회 실패');
    }

    const items = (result.data || []).map((row: Record<string, unknown>) => ({
      cartNo: row.CART_NO,
      itemCode: row.ITEM_CODE,
      itemName: row.ITEM_NAME || '',
      qty: row.QTY,
      location: row.LOCATION || '',
      lastUpdate: row.LAST_UPDATE || '',
    }));

    return success(items);
  } catch (err) {
    console.error('대차재고 조회 오류:', err);
    return serverError('대차재고 조회 중 오류가 발생했습니다.');
  }
}
