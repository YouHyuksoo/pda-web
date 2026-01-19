/**
 * @file src/app/api/shipment/box/route.ts
 * @description
 * 출하처리 BOX 재고 조회 API 엔드포인트입니다.
 * C# HS400[출하처리].cs의 DoBoxNo() 로직을 구현합니다.
 *
 * @example
 * GET /api/shipment/box?boxNo=BOX001&whsCode=Z01
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
  ITEMCODE: string;
  PQTY: number;
  BOXNO: string;
  WHSCODE: string;
}

/**
 * GET /api/shipment/box
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

    // PMS100에서 BOX 재고 조회
    const sql = `
      SELECT ITEMCODE, PQTY, PQTY AS OUTQTY, BOXNO, WHSCODE
      FROM PMS100
      WHERE WHSCODE = :whsCode
        AND BOXNO = :boxNo
        AND PQTY > 0
    `;

    const result = await oracle.query<BoxStock>(sql, { boxNo, whsCode });

    if (!result.success) {
      return serverError(result.error || 'DB 조회 실패');
    }

    if (!result.data || result.data.length === 0) {
      return error('해당 창고에 BOX 재고가 없습니다.');
    }

    const boxItems = result.data.map((item, idx) => ({
      no: idx + 1,
      itemCode: item.ITEMCODE,
      qty: item.PQTY,
      outQty: item.PQTY, // 기본적으로 전량 출고
      boxNo: item.BOXNO,
      whsCode: item.WHSCODE,
    }));

    return success(boxItems);
  } catch (err) {
    console.error('출하 BOX 조회 API 오류:', err);
    return serverError('BOX 조회 중 오류가 발생했습니다.');
  }
}
