/**
 * @file src/app/api/outsourcing/box/route.ts
 * @description
 * 외주출고 BOX 재고 조회 API 엔드포인트입니다.
 * C# HS100[외주출고].cs의 DoFind 로직을 구현합니다.
 *
 * @example
 * GET /api/outsourcing/box?boxNo=BOX001&saupj=10
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';


/** 동적 라우트 설정 - 빌드 시 정적 생성 방지 */
export const dynamic = 'force-dynamic';
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
 * GET /api/outsourcing/box
 * BOX 재고 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const boxNo = searchParams.get('boxNo');
    const saupj = searchParams.get('saupj') || '10';

    if (!boxNo) {
      return error('BOX_NO를 입력해주십시오');
    }

    // PMS100에서 BOX 재고 조회
    const sql = `
      SELECT BOXNO, ITEMCODE, PQTY, WHSCODE
      FROM PMS100
      WHERE BOXNO = :boxNo
        AND SAUPJ = :saupj
        AND PQTY > 0
    `;

    const result = await oracle.query<BoxStock>(sql, { boxNo, saupj });

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
    console.error('외주출고 BOX 조회 API 오류:', err);
    return serverError('BOX 조회 중 오류가 발생했습니다.');
  }
}
