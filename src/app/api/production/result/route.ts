/**
 * @file src/app/api/production/result/route.ts
 * @description
 * 실적등록 API 엔드포인트입니다.
 * C# HS700[실적등록].cs의 로직을 구현합니다.
 *
 * 주요 테이블:
 * - PMA200: 생산계획
 * - PMA900: 매거진 바코드 정보
 * - PMB200: 실적등록
 * - PMS100: 재고
 *
 * @example
 * GET /api/production/result?opCode=0100&lineCode=01&planDate=2025-01-16 (생산계획 조회)
 * GET /api/production/result/box?boxNo=BOX001&opCode=0100 (BOX 검증)
 * POST /api/production/result (실적 저장)
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';


/** 동적 라우트 설정 - 빌드 시 정적 생성 방지 */
export const dynamic = 'force-dynamic';
/**
 * 생산계획 인터페이스 (PMA200)
 */
interface ProductionPlan {
  NO: number;
  ORDERNO: string;
  P_ITEMCODE: string;
  PQTY: number;
  INPUTQTY: number;
  GQTY: number;
  STIME: string;
  WORKORDER: string;
  PLANDATE: string;
  ITEMCODE: string;
}

/**
 * GET /api/production/result
 * 생산계획 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const opCode = searchParams.get('opCode');
    const lineCode = searchParams.get('lineCode');
    const planDate = searchParams.get('planDate');
    const saupj = searchParams.get('saupj') || '10';

    // 필수 파라미터 체크
    if (!opCode) {
      return error('공정을 선택해 주십시오');
    }
    if (!lineCode) {
      return error('라인을 선택해 주십시오');
    }
    if (!planDate) {
      return error('날짜를 선택해 주십시오');
    }

    // 생산계획 조회 (PMA200)
    // GQTY: 양품수량, INPUTQTY: 투입수량
    const sql = `
      SELECT ROWNUM AS NO, A.ORDERNO, A.PITEMCODE AS P_ITEMCODE, A.PQTY,
             NVL(TO_NUMBER(UF_PMB100_INPUT_QTY(A.WORKORDER)), 0) AS INPUTQTY,
             NVL((SELECT SUM(PRTQTY) FROM PMB200 WHERE WORKORDER = A.WORKORDER), 0) AS GQTY,
             TO_CHAR(A.STIME, 'HH24:MI') AS STIME,
             A.WORKORDER,
             TO_CHAR(A.PLANDATE, 'YYYY-MM-DD') AS PLANDATE,
             A.ITEMCODE
      FROM PMA200 A
      WHERE A.PLANDATE = TO_DATE(:planDate, 'YYYY-MM-DD')
        AND A.OPCODE = :opCode
        AND A.LINECODE = :lineCode
        AND A.SAUPJ = :saupj
        AND A.STATUS_TYPE <> 7
      ORDER BY A.ORDERNO
    `;

    const result = await oracle.query<ProductionPlan>(sql, {
      planDate,
      opCode,
      lineCode,
      saupj
    });

    if (!result.success) {
      return serverError(result.error || 'DB 조회 실패');
    }

    const plans = (result.data || []).map((item, idx) => ({
      no: idx + 1,
      orderNo: item.ORDERNO,
      itemCode: item.P_ITEMCODE,
      processItemCode: item.ITEMCODE,
      planQty: item.PQTY,
      inputQty: item.INPUTQTY,
      goodQty: item.GQTY,
      remainQty: item.PQTY - item.GQTY,
      startTime: item.STIME || '',
      workOrder: item.WORKORDER,
      planDate: item.PLANDATE,
      // 상태 구분
      status: item.GQTY >= item.PQTY ? 'complete' :
              item.GQTY > 0 ? 'progress' : 'pending'
    }));

    if (plans.length === 0) {
      return success([], '생산계획이 없습니다');
    }

    return success(plans);
  } catch (err) {
    console.error('생산계획 조회 API 오류:', err);
    return serverError('생산계획 조회 중 오류가 발생했습니다.');
  }
}

/**
 * 실적 저장 요청 인터페이스
 */
interface ResultRequest {
  saupj: string;
  opCode: string;
  lineCode: string;
  planDate: string;
  workOrder: string;
  items: {
    boxNo: string;
    itemCode: string;
    pItemCode: string;
    qty: number;
  }[];
  userId: string;
}

/**
 * POST /api/production/result
 * 실적등록 저장
 */
export async function POST(request: NextRequest) {
  try {
    const body: ResultRequest = await request.json();
    const { saupj, opCode, lineCode, planDate, workOrder, items, userId } = body;

    // 입력 검증
    if (!opCode || !lineCode) {
      return error('공정/라인 정보가 없습니다.');
    }
    if (!items || items.length === 0) {
      return error('저장할 BOX 정보가 없습니다.');
    }

    const wkDate = planDate.replace(/-/g, '');
    const queries = [];

    for (const item of items) {
      // 실적번호 조회
      const snoResult = await oracle.scalar<string>(
        `SELECT UF_PMB200_SNO(:wkDate) AS SNO FROM DUAL`,
        { wkDate }
      );
      const resultSno = snoResult || `${wkDate}0001`;

      // PMB200 (실적등록) INSERT
      queries.push({
        sql: `
          INSERT INTO PMB200 (
            SNO, SAUPJ, WKDATE, OPCODE, LINECODE, BOXNO, ITEMCODE,
            P_ITEMCODE, PRTQTY, WORKORDER, GUBUN, JUYA,
            MAKER, MAKEDATE
          ) VALUES (
            TRIM(:sno), TRIM(:saupj), TRIM(:wkDate), TRIM(:opCode), TRIM(:lineCode),
            TRIM(:boxNo), TRIM(:itemCode), TRIM(:pItemCode), :prtQty, TRIM(:workOrder),
            'Y', TRIM(UF_JUYA(:opCode)), :userId, SYSDATE
          )
        `,
        params: {
          sno: resultSno,
          saupj: saupj || '10',
          wkDate,
          opCode,
          lineCode,
          boxNo: item.boxNo,
          itemCode: item.itemCode,
          pItemCode: item.pItemCode,
          prtQty: item.qty,
          workOrder: workOrder || '****',
          userId: userId || 'SYSTEM'
        }
      });

      // PMS100 (재고) INSERT 또는 UPDATE
      queries.push({
        sql: `
          MERGE INTO PMS100 A
          USING (SELECT :boxNo AS BOXNO, :itemCode AS ITEMCODE FROM DUAL) B
          ON (A.BOXNO = B.BOXNO AND A.ITEMCODE = B.ITEMCODE)
          WHEN MATCHED THEN
            UPDATE SET PQTY = PQTY + :pqty, EDITOR = :userId, EDITDATE = SYSDATE
          WHEN NOT MATCHED THEN
            INSERT (SAUPJ, BOXNO, ITEMCODE, WHSCODE, PQTY, GUBUN, MAKER, MAKEDATE)
            VALUES (:saupj, :boxNo, :itemCode, UF_BMA100_WHSCODE(:opCode), :pqty, 'Y', :userId, SYSDATE)
        `,
        params: {
          boxNo: item.boxNo,
          itemCode: item.itemCode,
          pqty: item.qty,
          userId: userId || 'SYSTEM',
          saupj: saupj || '10',
          opCode
        }
      });
    }

    const result = await oracle.executeTransaction(queries);

    if (!result.success) {
      return serverError(result.error || '등록오류');
    }

    return success({ count: items.length }, '저장되었습니다');
  } catch (err) {
    console.error('실적등록 저장 API 오류:', err);
    return serverError('실적등록 저장 중 오류가 발생했습니다.');
  }
}
