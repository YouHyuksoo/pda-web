/**
 * @file src/app/api/material/barcode/route.ts
 * @description
 * 바코드로 자재 정보 조회 API 엔드포인트입니다.
 * BOX 바코드를 스캔하여 자재 정보를 조회합니다.
 *
 * @example
 * GET /api/material/barcode?boxNo=BOX001&whsCode=WH01
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';

/**
 * 재고 정보 인터페이스
 */
interface StockInfo {
  BOX_NO: string;
  ITEM_CODE: string;
  ITEM_NAME: string;
  QTY: number;
  WHS_CODE: string;
  LOCATION: string;
  LOT_NO: string;
}

/**
 * GET /api/material/barcode
 * 바코드로 재고 정보 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const boxNo = searchParams.get('boxNo');
    const whsCode = searchParams.get('whsCode');

    if (!boxNo) {
      return error('바코드는 필수입니다.');
    }

    // 재고 조회 쿼리
    // TODO: 실제 테이블/컬럼명에 맞게 수정 필요
    let sql = `
      SELECT
        A.BOX_NO,
        A.ITEM_CODE,
        B.ITEM_NAME,
        A.QTY,
        A.WHS_CODE,
        A.LOCATION,
        A.LOT_NO
      FROM PMS100 A
      LEFT JOIN BOM_MASTER B ON A.ITEM_CODE = B.ITEM_CODE
      WHERE A.BOX_NO = :boxNo
        AND A.QTY > 0
    `;

    const params: Record<string, string> = { boxNo };

    // 창고 조건 추가
    if (whsCode) {
      sql += ' AND A.WHS_CODE = :whsCode';
      params.whsCode = whsCode;
    }

    const result = await oracle.query<StockInfo>(sql, params);

    if (!result.success) {
      return serverError(result.error || 'DB 조회 실패');
    }

    if (!result.data || result.data.length === 0) {
      return error('해당 바코드의 재고를 찾을 수 없습니다.', 404);
    }

    const stock = result.data[0];

    return success({
      boxNo: stock.BOX_NO,
      itemCode: stock.ITEM_CODE,
      itemName: stock.ITEM_NAME,
      qty: stock.QTY,
      whsCode: stock.WHS_CODE,
      location: stock.LOCATION,
      lotNo: stock.LOT_NO,
    });
  } catch (err) {
    console.error('바코드 조회 API 오류:', err);
    return serverError('바코드 조회 중 오류가 발생했습니다.');
  }
}
