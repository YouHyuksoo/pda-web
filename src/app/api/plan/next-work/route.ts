/**
 * @file src/app/api/plan/next-work/route.ts
 * @description
 * 차기 작업 API 엔드포인트입니다.
 * 차기 작업 목록 조회 및 상태 변경(준비완료/시작)을 처리합니다.
 *
 * @example
 * GET /api/plan/next-work?processCode=P01&lineCode=L01&fromDate=20240102&toDate=20240108
 * POST /api/plan/next-work (상태 변경)
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';


/** 동적 라우트 설정 - 빌드 시 정적 생성 방지 */
export const dynamic = 'force-dynamic';
/**
 * GET /api/plan/next-work
 * 차기 작업 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const processCode = searchParams.get('processCode');
    const lineCode = searchParams.get('lineCode');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    if (!processCode || !lineCode) {
      return error('공정/라인을 선택해주세요.');
    }

    const sql = `
      SELECT
        A.ORDERNO AS ORDER_NO,
        A.ITEMCODE AS ITEM_CODE,
        B.ITEM_NAME,
        A.PLANQTY AS PLAN_QTY,
        A.WKDATE AS PLAN_DATE,
        CASE A.STATUS
          WHEN 'P' THEN 'scheduled'
          WHEN 'R' THEN 'ready'
          WHEN 'W' THEN 'started'
          ELSE A.STATUS
        END AS STATUS,
        TO_CHAR(A.STARTTIME, 'HH24:MI') AS START_TIME
      FROM PMO100 A
      LEFT JOIN BOM_MASTER B ON A.ITEMCODE = B.ITEM_CODE
      WHERE A.OPCODE = :processCode
        AND A.LINECODE = :lineCode
        AND A.WKDATE BETWEEN :fromDate AND :toDate
        AND A.STATUS IN ('P', 'R', 'W')
      ORDER BY A.WKDATE, A.SEQ
    `;

    const result = await oracle.query(sql, {
      processCode,
      lineCode,
      fromDate: fromDate?.replace(/-/g, '') || '',
      toDate: toDate?.replace(/-/g, '') || '',
    });

    const plans = (result.data || []).map((row: Record<string, unknown>) => ({
      orderNo: row.ORDER_NO || '',
      itemCode: row.ITEM_CODE || '',
      itemName: row.ITEM_NAME || '',
      planQty: row.PLAN_QTY || 0,
      planDate: String(row.PLAN_DATE || '').replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
      status: row.STATUS || 'scheduled',
      startTime: row.START_TIME || null,
    }));

    return success(plans);
  } catch (err) {
    console.error('차기작업 조회 오류:', err);
    return serverError('차기작업 조회 중 오류가 발생했습니다.');
  }
}

/**
 * POST /api/plan/next-work
 * 차기 작업 상태 변경 (준비완료/시작)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderNo, action, userId } = body;

    if (!orderNo) {
      return error('작업지시번호가 없습니다.');
    }

    let newStatus = '';
    let message = '';

    switch (action) {
      case 'ready':
        newStatus = 'R';
        message = '준비완료 처리되었습니다.';
        break;
      case 'start':
        newStatus = 'W';
        message = '차기 작업이 시작되었습니다.';
        break;
      default:
        return error('잘못된 액션입니다.');
    }

    const sql = action === 'start'
      ? `
          UPDATE PMO100
          SET STATUS = :newStatus,
              STARTTIME = SYSDATE,
              EDITOR = :userId,
              EDITDATE = SYSDATE
          WHERE ORDERNO = :orderNo
        `
      : `
          UPDATE PMO100
          SET STATUS = :newStatus,
              EDITOR = :userId,
              EDITDATE = SYSDATE
          WHERE ORDERNO = :orderNo
        `;

    const result = await oracle.execute(sql, {
      orderNo,
      newStatus,
      userId: userId || 'SYSTEM',
    });

    if (!result.success) {
      return serverError(result.error || '상태 변경 실패');
    }

    return success({ orderNo }, message);
  } catch (err) {
    console.error('차기작업 상태 변경 오류:', err);
    return serverError('차기작업 상태 변경 중 오류가 발생했습니다.');
  }
}
