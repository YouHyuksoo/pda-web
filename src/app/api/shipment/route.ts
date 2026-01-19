/**
 * @file src/app/api/shipment/route.ts
 * @description
 * 출하처리 API 엔드포인트입니다.
 * C# HS400[출하처리].cs의 로직을 구현합니다.
 *
 * 주요 테이블:
 * - PMS100: 재고
 * - PMB900: 출하실적
 *
 * @example
 * GET /api/shipment?wkDate=2025-01-16 (차수 조회)
 * GET /api/shipment/box?boxNo=BOX001&whsCode=Z01 (BOX 재고 조회)
 * POST /api/shipment (출하 저장)
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';


/** 동적 라우트 설정 - 빌드 시 정적 생성 방지 */
export const dynamic = 'force-dynamic';
/**
 * GET /api/shipment
 * 출하 차수 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const wkDate = searchParams.get('wkDate');

    if (!wkDate) {
      return error('날짜를 선택해주십시오');
    }

    // 차수 조회 (PMB900)
    const sql = `
      SELECT NVL(MAX(CHASU), 0) + 1 AS CHASU
      FROM PMB900
      WHERE WKDATE = :wkDate
    `;

    const result = await oracle.scalar<number>(sql, { wkDate });
    const chasu = result || 1;

    return success({ chasu });
  } catch (err) {
    console.error('출하 차수 조회 API 오류:', err);
    return serverError('차수 조회 중 오류가 발생했습니다.');
  }
}

/**
 * 출하 저장 요청 인터페이스
 */
interface ShipmentRequest {
  saupj: string;
  wkDate: string;
  chasu: number;
  custCode: string;
  destCode: string;
  outType: string;
  carNo: string;
  items: {
    boxNo: string;
    itemCode: string;
    whsCode: string;
    outQty: number;
  }[];
  userId: string;
}

/**
 * POST /api/shipment
 * 출하실적 저장
 */
export async function POST(request: NextRequest) {
  try {
    const body: ShipmentRequest = await request.json();
    const { saupj, wkDate, chasu, custCode, destCode, outType, carNo, items, userId } = body;

    // 입력 검증
    if (!destCode) {
      return error('출고처를 선택해주십시오');
    }
    if (!outType) {
      return error('출고 구분을 선택해주십시오');
    }
    if (!items || items.length === 0) {
      return error('저장할 BOX 정보가 없습니다.');
    }

    const queries = [];

    for (const item of items) {
      // PMB900 (출하실적) INSERT
      queries.push({
        sql: `
          INSERT INTO PMB900 (
            SNO, SAUPJ, WKDATE, CHASU, BOXNO, ITEMCODE,
            WHSCODE, CUSTCODE, DESTCODE, OUTTYPE, CARNO, GQTY,
            MAKER, MAKEDATE
          ) VALUES (
            UF_PMB900_SNO(:wkDate),
            :saupj, :wkDate, :chasu, :boxNo, :itemCode,
            :whsCode, :custCode, :destCode, :outType, :carNo, :gqty,
            :userId, SYSDATE
          )
        `,
        params: {
          wkDate,
          saupj: saupj || '10',
          chasu,
          boxNo: item.boxNo,
          itemCode: item.itemCode,
          whsCode: item.whsCode,
          custCode: custCode || '',
          destCode,
          outType,
          carNo: carNo || '',
          gqty: item.outQty,
          userId: userId || 'SYSTEM'
        }
      });
    }

    const result = await oracle.executeTransaction(queries);

    if (!result.success) {
      return serverError(result.error || '출하처리 오류');
    }

    return success({ count: items.length }, '저장되었습니다');
  } catch (err) {
    console.error('출하처리 저장 API 오류:', err);
    return serverError('출하처리 저장 중 오류가 발생했습니다.');
  }
}
