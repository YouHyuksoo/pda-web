/**
 * @file src/app/api/production/plan/route.ts
 * @description
 * 생산계획 조회 API 엔드포인트입니다.
 * 공정/라인/일자별 생산계획을 조회합니다.
 *
 * @example
 * GET /api/production/plan?processCode=P01&lineCode=L01&workDate=20240101
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';

/**
 * 생산계획 인터페이스
 */
interface ProductionPlan {
  ORDER_NO: string;
  ITEM_CODE: string;
  ITEM_NAME: string;
  PLAN_QTY: number;
  INPUT_QTY: number;
  GOOD_QTY: number;
  START_TIME: string;
  WORK_ORDER: string;
  PLAN_DATE: string;
}

/**
 * GET /api/production/plan
 * 생산계획 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const processCode = searchParams.get('processCode');
    const lineCode = searchParams.get('lineCode');
    const workDate = searchParams.get('workDate');

    if (!processCode || !lineCode) {
      return error('공정코드와 라인코드는 필수입니다.');
    }

    const wkDate = workDate?.replace(/-/g, '') || new Date().toISOString().slice(0, 10).replace(/-/g, '');

    // 생산계획 조회 쿼리
    const sql = `
      SELECT
        A.ORDER_NO,
        A.ITEM_CODE,
        B.ITEM_NAME,
        A.PLAN_QTY,
        NVL(A.INPUT_QTY, 0) AS INPUT_QTY,
        NVL(A.GOOD_QTY, 0) AS GOOD_QTY,
        TO_CHAR(A.START_TIME, 'HH24:MI') AS START_TIME,
        A.WORK_ORDER,
        A.PLAN_DATE
      FROM PMA200 A
      LEFT JOIN BOM_MASTER B ON A.ITEM_CODE = B.ITEM_CODE
      WHERE A.PROCESS_CODE = :processCode
        AND A.LINE_CODE = :lineCode
        AND A.PLAN_DATE = :workDate
        AND A.STATUS <> 'C'
      ORDER BY A.START_TIME, A.ORDER_NO
    `;

    const result = await oracle.query<ProductionPlan>(sql, {
      processCode,
      lineCode,
      workDate: wkDate,
    });

    if (!result.success) {
      return serverError(result.error || 'DB 조회 실패');
    }

    // 결과 변환
    const plans = (result.data || []).map((row, idx) => ({
      no: idx + 1,
      orderNo: row.ORDER_NO,
      itemCode: row.ITEM_CODE,
      itemName: row.ITEM_NAME || '',
      planQty: row.PLAN_QTY,
      inputQty: row.INPUT_QTY,
      goodQty: row.GOOD_QTY,
      startTime: row.START_TIME || '',
      workOrder: row.WORK_ORDER,
      planDate: row.PLAN_DATE,
    }));

    return success(plans);
  } catch (err) {
    console.error('생산계획 조회 오류:', err);
    return serverError('생산계획 조회 중 오류가 발생했습니다.');
  }
}
