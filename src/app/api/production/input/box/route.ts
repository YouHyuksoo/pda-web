/**
 * @file src/app/api/production/input/box/route.ts
 * @description
 * BOX 정보 조회 API 엔드포인트입니다.
 * C# HS600[생산투입].cs의 DoBoxNo() 로직을 구현합니다.
 *
 * @example
 * GET /api/production/input/box?boxNo=BOX001&opCode=0100&saupj=10
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
 * GET /api/production/input/box
 * BOX 정보 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const boxNo = searchParams.get('boxNo');
    const opCode = searchParams.get('opCode');
    const saupj = searchParams.get('saupj') || '10';

    if (!boxNo) {
      return error('BOX_NO를 입력해주십시오');
    }

    // 1. BOX 실적등록 여부 확인 (PMB100)
    const checkSql = `
      SELECT COUNT(*) AS CNT
      FROM PMB100
      WHERE BOXNO = :boxNo
        AND OPCODE = :opCode
        AND SAUPJ = :saupj
    `;
    const checkResult = await oracle.scalar<number>(checkSql, { boxNo, opCode, saupj });

    // BOX가 이미 실적등록된 경우 재고 확인
    if (checkResult && checkResult > 0) {
      const stockCheckSql = `
        SELECT NVL(SUM(PQTY), 0) AS QTY
        FROM PMS100
        WHERE BOXNO = :boxNo
          AND PQTY > 0
      `;
      const stockQty = await oracle.scalar<number>(stockCheckSql, { boxNo });

      if (!stockQty || stockQty === 0) {
        return error('BOX에 재고가 없습니다.');
      }
    }

    // 2. BOX 재고 조회 (PMS100)
    const sql = `
      SELECT BOXNO, ITEMCODE, NVL(PQTY, 0) AS PQTY, WHSCODE
      FROM PMS100
      WHERE BOXNO = :boxNo
        AND PQTY > 0
    `;

    const result = await oracle.query<BoxStock>(sql, { boxNo });

    if (!result.success) {
      return serverError(result.error || 'DB 조회 실패');
    }

    if (!result.data || result.data.length === 0) {
      return error('생산실적 이력이 없습니다.');
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
    console.error('BOX 조회 API 오류:', err);
    return serverError('BOX 조회 중 오류가 발생했습니다.');
  }
}
