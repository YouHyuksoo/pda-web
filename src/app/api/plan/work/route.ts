/**
 * @file src/app/api/plan/work/route.ts
 * @description
 * 작업 시작/종료 API 엔드포인트입니다.
 * 작업 계획 조회 및 시작/종료 처리를 수행합니다.
 *
 * @example
 * GET /api/plan/work?processCode=P01&lineCode=L01&workDate=20240115
 * POST /api/plan/work (시작/종료 처리)
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';

/**
 * GET /api/plan/work
 * 작업 계획 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const processCode = searchParams.get('processCode');
    const lineCode = searchParams.get('lineCode');
    const workDate = searchParams.get('workDate');

    if (!processCode || !lineCode) {
      return error('공정/라인을 선택해주세요.');
    }

    const wkDate = workDate?.replace(/-/g, '') || new Date().toISOString().slice(0, 10).replace(/-/g, '');

    const sql = `
      SELECT
        A.ORDER_NO,
        A.ITEM_CODE,
        B.ITEM_NAME,
        A.PLAN_QTY,
        A.STATUS,
        TO_CHAR(A.START_TIME, 'HH24:MI') AS START_TIME,
        TO_CHAR(A.END_TIME, 'HH24:MI') AS END_TIME
      FROM PMO100 A
      LEFT JOIN BOM_MASTER B ON A.ITEM_CODE = B.ITEM_CODE
      WHERE A.PROCESS_CODE = :processCode
        AND A.LINE_CODE = :lineCode
        AND A.WORK_DATE = :workDate
      ORDER BY A.SEQ_NO
    `;

    const result = await oracle.query(sql, { processCode, lineCode, workDate: wkDate });

    if (!result.success) {
      return serverError(result.error || 'DB 조회 실패');
    }

    const plans = (result.data || []).map((row: Record<string, unknown>) => ({
      orderNo: row.ORDER_NO,
      itemCode: row.ITEM_CODE,
      itemName: row.ITEM_NAME || '',
      planQty: row.PLAN_QTY || 0,
      status: row.STATUS === 'W' ? 'working' : row.STATUS === 'C' ? 'completed' : 'ready',
      startTime: row.START_TIME || null,
      endTime: row.END_TIME || null,
    }));

    return success(plans);
  } catch (err) {
    console.error('작업 계획 조회 오류:', err);
    return serverError('작업 계획 조회 중 오류가 발생했습니다.');
  }
}

/**
 * POST /api/plan/work
 * 작업 시작/종료 처리
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderNo, action, userId } = body;

    if (!orderNo) {
      return error('작업지시번호는 필수입니다.');
    }

    if (!action || !['start', 'end'].includes(action)) {
      return error('액션(start/end)을 지정해주세요.');
    }

    if (action === 'start') {
      // 작업 시작
      const result = await oracle.execute(
        `UPDATE PMO100
         SET STATUS = 'W',
             START_TIME = SYSDATE,
             UPD_USER = :userId,
             UPD_DATE = SYSDATE
         WHERE ORDER_NO = :orderNo`,
        {
          orderNo,
          userId: userId || 'SYSTEM',
        }
      );

      if (!result.success) {
        return serverError(result.error || '시작 처리 실패');
      }

      return success({ orderNo }, '작업이 시작되었습니다.');
    } else {
      // 작업 종료
      const result = await oracle.execute(
        `UPDATE PMO100
         SET STATUS = 'C',
             END_TIME = SYSDATE,
             UPD_USER = :userId,
             UPD_DATE = SYSDATE
         WHERE ORDER_NO = :orderNo`,
        {
          orderNo,
          userId: userId || 'SYSTEM',
        }
      );

      if (!result.success) {
        return serverError(result.error || '종료 처리 실패');
      }

      return success({ orderNo }, '작업이 종료되었습니다.');
    }
  } catch (err) {
    console.error('작업 시작/종료 오류:', err);
    return serverError('작업 처리 중 오류가 발생했습니다.');
  }
}
