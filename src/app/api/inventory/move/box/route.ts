/**
 * @file src/app/api/inventory/move/box/route.ts
 * @description
 * 재고이동 BOX 조회 API 엔드포인트입니다.
 * C# HS200[재고이동].cs의 BOX 조회 로직을 구현합니다.
 *
 * @example
 * GET /api/inventory/move/box?boxNo=BOX001&whsCode=W01
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';

/**
 * BOX 재고 인터페이스 (PMS100)
 */
interface BoxStock {
  BOXNO: string;
  ITEMCODE: string;
  PQTY: number;
  WHSCODE: string;
}

/**
 * GET /api/inventory/move/box
 * BOX 재고 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const boxNo = searchParams.get('boxNo');
    const whsCode = searchParams.get('whsCode');

    if (!boxNo) {
      return error('BOX_NO를 입력해주십시오');
    }
    if (!whsCode) {
      return error('창고를 선택해주십시오');
    }

    // PMS100에서 BOX 재고 조회 (LIKE 검색 지원)
    const sql = `
      SELECT BOXNO, ITEMCODE, PQTY, WHSCODE
      FROM PMS100
      WHERE BOXNO LIKE '%' || :boxNo || '%'
        AND WHSCODE = :whsCode
    `;

    const result = await oracle.query<BoxStock>(sql, { boxNo, whsCode });

    if (!result.success) {
      return serverError(result.error || 'DB 조회 실패');
    }

    if (!result.data || result.data.length === 0) {
      return error('정보를 조회할 수 없습니다.');
    }

    const boxItems = result.data.map((item, idx) => ({
      no: idx + 1,
      boxNo: item.BOXNO,
      itemCode: item.ITEMCODE,
      qty: item.PQTY,
      whsCode: item.WHSCODE,
    }));

    return success(boxItems);
  } catch (err) {
    console.error('재고이동 BOX 조회 API 오류:', err);
    return serverError('BOX 조회 중 오류가 발생했습니다.');
  }
}
