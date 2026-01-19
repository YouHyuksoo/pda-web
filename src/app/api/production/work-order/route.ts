/**
 * @file src/app/api/production/work-order/route.ts
 * @description
 * 작업지시 조회 API 엔드포인트입니다.
 * 생산투입 페이지에서 사용하는 작업지시 목록을 조회합니다.
 *
 * @example
 * GET /api/production/work-order?processCode=P01&lineCode=L01&workDate=2026-01-16
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';

/**
 * 작업지시 인터페이스
 */
interface WorkOrder {
  WORK_ORDER: string;
  ITEM_CODE: string;
  ITEM_NAME: string;
  PLAN_QTY: number;
  REMAIN_QTY: number;
  INPUT_QTY: number;
  START_TIME: string;
  END_TIME: string;
}

/**
 * GET /api/production/work-order
 * 작업지시 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const processCode = searchParams.get('processCode');
    const lineCode = searchParams.get('lineCode');
    const workDate = searchParams.get('workDate');

    // 필수 파라미터 검증
    if (!processCode || !lineCode) {
      return error('공정코드와 라인코드는 필수입니다.');
    }

    // 작업지시 조회 쿼리
    // TODO: 실제 테이블/컬럼명에 맞게 수정 필요
    const sql = `
      SELECT
        WORK_ORDER,
        ITEM_CODE,
        ITEM_NAME,
        PLAN_QTY,
        NVL(PLAN_QTY - INPUT_QTY, PLAN_QTY) AS REMAIN_QTY,
        NVL(INPUT_QTY, 0) AS INPUT_QTY,
        TO_CHAR(START_TIME, 'HH24:MI') AS START_TIME,
        TO_CHAR(END_TIME, 'HH24:MI') AS END_TIME
      FROM PMA200
      WHERE PROCESS_CODE = :processCode
        AND LINE_CODE = :lineCode
        AND WORK_DATE = TO_DATE(:workDate, 'YYYY-MM-DD')
        AND STATUS IN ('10', '20')
      ORDER BY START_TIME ASC
    `;

    const result = await oracle.query<WorkOrder>(sql, {
      processCode,
      lineCode,
      workDate: workDate || new Date().toISOString().split('T')[0],
    });

    if (!result.success) {
      return serverError(result.error || 'DB 조회 실패');
    }

    // 결과 변환
    const workOrders = (result.data || []).map((item, index) => ({
      no: index + 1,
      workOrder: item.WORK_ORDER,
      itemCode: item.ITEM_CODE,
      itemName: item.ITEM_NAME,
      planQty: item.PLAN_QTY,
      remainQty: item.REMAIN_QTY,
      inputQty: item.INPUT_QTY,
      startTime: item.START_TIME,
      endTime: item.END_TIME,
    }));

    return success(workOrders);
  } catch (err) {
    console.error('작업지시 조회 API 오류:', err);
    return serverError('작업지시 조회 중 오류가 발생했습니다.');
  }
}
