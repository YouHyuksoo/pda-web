/**
 * @file src/app/api/outsourcing/route.ts
 * @description
 * 외주출고 API 엔드포인트입니다.
 * C# HS100[외주출고].cs의 로직을 구현합니다.
 *
 * 주요 테이블:
 * - BMF300: 업체 마스터
 * - PMS100: 재고
 * - PMB400: 외주 입출고
 *
 * @example
 * GET /api/outsourcing/vendor (업체 목록 조회)
 * GET /api/outsourcing/box?boxNo=BOX001&saupj=10 (BOX 재고 조회)
 * GET /api/outsourcing/history?custCode=C001&saupj=10 (출고 이력 조회)
 * POST /api/outsourcing (외주출고 저장)
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';

/**
 * 외주출고 저장 요청 인터페이스
 */
interface OutsourcingRequest {
  saupj: string;
  outDate: string;
  custCode: string;
  items: {
    boxNo: string;
    itemCode: string;
    qty: number;
    whsCode: string;
  }[];
  userId: string;
}

/**
 * POST /api/outsourcing
 * 외주출고 저장
 */
export async function POST(request: NextRequest) {
  try {
    const body: OutsourcingRequest = await request.json();
    const { saupj, outDate, custCode, items, userId } = body;

    // 입력 검증
    if (!custCode) {
      return error('업체를 선택해주십시오');
    }
    if (!items || items.length === 0) {
      return error('저장할 BOX 정보가 없습니다.');
    }

    const wkDate = outDate.replace(/-/g, '');
    const queries = [];

    for (const item of items) {
      // PMB400 (외주 입출고) INSERT
      queries.push({
        sql: `
          INSERT INTO PMB400 (
            SNO, SAUPJ, WKDATE, WHSCODE, BOXNO, ITEMCODE,
            GUBUN, PQTY, F_WHSCODE, OUTTYPE, SAGUBCD,
            DEL_YN, IOTYPE, MAKER, MAKEDATE
          ) VALUES (
            UF_PMB400_SNO(:wkDate),
            :saupj, :wkDate, :whsCode, :boxNo, :itemCode,
            'Y', :pqty, :custCode, '', '',
            'N', 'OUT', :userId, SYSDATE
          )
        `,
        params: {
          wkDate,
          saupj: saupj || '10',
          whsCode: item.whsCode,
          boxNo: item.boxNo,
          itemCode: item.itemCode,
          pqty: item.qty,
          custCode,
          userId: userId || 'SYSTEM'
        }
      });
    }

    const result = await oracle.executeTransaction(queries);

    if (!result.success) {
      return serverError(result.error || '외주출고 등록오류');
    }

    return success({ count: items.length }, '저장되었습니다');
  } catch (err) {
    console.error('외주출고 저장 API 오류:', err);
    return serverError('외주출고 저장 중 오류가 발생했습니다.');
  }
}
