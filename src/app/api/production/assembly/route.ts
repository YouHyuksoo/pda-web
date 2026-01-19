/**
 * @file src/app/api/production/assembly/route.ts
 * @description
 * 조립실적등록 API 엔드포인트입니다.
 * 조립 작업지시를 조회하고 실적을 등록합니다.
 *
 * @example
 * GET /api/production/assembly?processCode=P01&lineCode=L01&workDate=20240101
 * POST /api/production/assembly
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';


/** 동적 라우트 설정 - 빌드 시 정적 생성 방지 */
export const dynamic = 'force-dynamic';
/**
 * GET /api/production/assembly
 * 조립 작업지시 조회
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

    const sql = `
      SELECT
        A.ORDER_NO,
        A.ITEM_CODE,
        B.ITEM_NAME,
        A.PLAN_QTY,
        NVL(A.ASSEMBLY_QTY, 0) AS ASSEMBLY_QTY
      FROM PMO200 A
      LEFT JOIN BOM_MASTER B ON A.ITEM_CODE = B.ITEM_CODE
      WHERE A.PROCESS_CODE = :processCode
        AND A.LINE_CODE = :lineCode
        AND A.PLAN_DATE = :workDate
        AND A.STATUS IN ('R', 'P')
      ORDER BY A.ORDER_NO
    `;

    const result = await oracle.query(sql, {
      processCode,
      lineCode,
      workDate: wkDate,
    });

    if (!result.success) {
      return serverError(result.error || 'DB 조회 실패');
    }

    const plans = (result.data || []).map((row: Record<string, unknown>) => ({
      orderNo: row.ORDER_NO,
      itemCode: row.ITEM_CODE,
      itemName: row.ITEM_NAME || '',
      planQty: row.PLAN_QTY,
      assemblyQty: row.ASSEMBLY_QTY,
    }));

    return success(plans);
  } catch (err) {
    console.error('조립 작업지시 조회 오류:', err);
    return serverError('조립 작업지시 조회 중 오류가 발생했습니다.');
  }
}

/**
 * POST /api/production/assembly
 * 조립실적 저장
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { saupj, orderNo, processCode, lineCode, workDate, items, userId } = body;

    if (!orderNo) {
      return error('작업지시번호는 필수입니다.');
    }

    if (!items || items.length === 0) {
      return error('저장할 실적이 없습니다.');
    }

    const wkDate = workDate?.replace(/-/g, '') || new Date().toISOString().slice(0, 10).replace(/-/g, '');
    let successCount = 0;
    let okCount = 0;
    let ngCount = 0;

    for (const item of items) {
      try {
        const result = await oracle.execute(
          `INSERT INTO PMB500 (
            SAUPJ, ORDER_NO, PROCESS_CODE, LINE_CODE, WORK_DATE,
            SERIAL_NO, STATUS, ASSEMBLY_TIME,
            REG_USER, REG_DATE
          ) VALUES (
            :saupj, :orderNo, :processCode, :lineCode, :workDate,
            :serialNo, :status, :assemblyTime,
            :userId, SYSDATE
          )`,
          {
            saupj: saupj || '10',
            orderNo: orderNo,
            processCode: processCode || '',
            lineCode: lineCode || '',
            workDate: wkDate,
            serialNo: item.serialNo,
            status: item.status,
            assemblyTime: item.assemblyTime || '',
            userId: userId || 'SYSTEM',
          }
        );

        if (result.success) {
          successCount++;
          if (item.status === 'OK') okCount++;
          else if (item.status === 'NG') ngCount++;
        }
      } catch (itemErr) {
        console.error('조립실적 항목 처리 오류:', itemErr);
      }
    }

    if (successCount === 0) {
      return error('저장된 실적이 없습니다.');
    }

    // 작업지시 실적 수량 업데이트
    await oracle.execute(
      `UPDATE PMO200
       SET ASSEMBLY_QTY = NVL(ASSEMBLY_QTY, 0) + :okCount,
           UPD_USER = :userId,
           UPD_DATE = SYSDATE
       WHERE ORDER_NO = :orderNo`,
      {
        okCount: okCount,
        orderNo: orderNo,
        userId: userId || 'SYSTEM',
      }
    );

    return success(
      { count: successCount, ok: okCount, ng: ngCount },
      `저장 완료 (OK: ${okCount}건, NG: ${ngCount}건)`
    );
  } catch (err) {
    console.error('조립실적 API 오류:', err);
    return serverError('조립실적 저장 중 오류가 발생했습니다.');
  }
}
