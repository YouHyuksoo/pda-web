/**
 * @file src/app/api/production/result/box/route.ts
 * @description
 * 실적등록 BOX 검증 API 엔드포인트입니다.
 * C# HS700[실적등록].cs의 BOX 검증 로직을 구현합니다.
 *
 * 주요 테이블:
 * - PMB200: 실적등록 (중복 확인)
 * - PMS100: 재고 (BOX 정보 조회)
 *
 * @example
 * GET /api/production/result/box?boxNo=BOX001&opCode=0100&saupj=10
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';


/** 동적 라우트 설정 - 빌드 시 정적 생성 방지 */
export const dynamic = 'force-dynamic';
/**
 * BOX 정보 인터페이스
 */
interface BoxInfo {
  BOXNO: string;
  ITEMCODE: string;
  PQTY: number;
  WHSCODE: string;
}

/**
 * GET /api/production/result/box
 * BOX 정보 조회 및 검증
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

    if (!opCode) {
      return error('공정을 선택해주십시오');
    }

    // 1. PMB200에서 중복 스캔 확인 (해당 공정에서 이미 실적등록된 BOX인지)
    const dupCheckSql = `
      SELECT BOXNO
      FROM PMB200 A
      WHERE A.SAUPJ = :saupj
        AND A.OPCODE = :opCode
        AND A.BOXNO = :boxNo
    `;
    const dupResult = await oracle.query<{ BOXNO: string }>(dupCheckSql, { saupj, opCode, boxNo });

    if (dupResult.success && dupResult.data && dupResult.data.length > 0) {
      return error('이미 실적등록된 BOX입니다.');
    }

    // 2. PMS100에서 BOX 재고 조회
    const stockSql = `
      SELECT BOXNO, ITEMCODE, NVL(PQTY, 0) AS PQTY, WHSCODE
      FROM PMS100
      WHERE BOXNO = :boxNo
        AND PQTY > 0
    `;
    const stockResult = await oracle.query<BoxInfo>(stockSql, { boxNo });

    if (!stockResult.success) {
      return serverError(stockResult.error || 'DB 조회 실패');
    }

    if (!stockResult.data || stockResult.data.length === 0) {
      // BOX에 재고가 없는 경우
      const countSql = `
        SELECT COUNT(*) AS CNT
        FROM PMS100
        WHERE BOXNO = :boxNo
      `;
      const countResult = await oracle.scalar<number>(countSql, { boxNo });

      if (!countResult || countResult === 0) {
        return error('존재하지 않는 BOX입니다.');
      }
      return error('BOX에 재고가 없습니다.');
    }

    // BOX 정보 반환
    const boxItems = stockResult.data.map((item, idx) => ({
      no: idx + 1,
      boxNo: item.BOXNO,
      itemCode: item.ITEMCODE,
      qty: item.PQTY,
      whsCode: item.WHSCODE,
    }));

    return success(boxItems);
  } catch (err) {
    console.error('실적등록 BOX 조회 API 오류:', err);
    return serverError('BOX 조회 중 오류가 발생했습니다.');
  }
}
