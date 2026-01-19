/**
 * @file src/app/api/production/input-cancel/route.ts
 * @description
 * 생산투입취소 API 엔드포인트입니다.
 * 투입된 자재를 취소 처리합니다.
 *
 * @example
 * GET /api/production/input-cancel?processCode=P01&lineCode=L01&workDate=20240101
 * POST /api/production/input-cancel
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';

/**
 * GET /api/production/input-cancel
 * 투입 내역 조회
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
        A.BOX_NO,
        A.ITEM_CODE,
        B.ITEM_NAME,
        A.QTY,
        TO_CHAR(A.REG_DATE, 'HH24:MI') AS INPUT_TIME,
        A.WORK_ORDER
      FROM PMB100 A
      LEFT JOIN BOM_MASTER B ON A.ITEM_CODE = B.ITEM_CODE
      WHERE A.PROCESS_CODE = :processCode
        AND A.LINE_CODE = :lineCode
        AND A.INPUT_DATE = :workDate
        AND A.CANCEL_YN IS NULL
      ORDER BY A.REG_DATE DESC
    `;

    const result = await oracle.query(sql, {
      processCode,
      lineCode,
      workDate: wkDate,
    });

    if (!result.success) {
      return serverError(result.error || 'DB 조회 실패');
    }

    const items = (result.data || []).map((row: Record<string, unknown>, idx: number) => ({
      no: idx + 1,
      boxNo: row.BOX_NO,
      itemCode: row.ITEM_CODE,
      itemName: row.ITEM_NAME || '',
      qty: row.QTY,
      inputTime: row.INPUT_TIME || '',
      workOrder: row.WORK_ORDER || '',
      selected: false,
    }));

    return success(items);
  } catch (err) {
    console.error('투입 내역 조회 오류:', err);
    return serverError('투입 내역 조회 중 오류가 발생했습니다.');
  }
}

/**
 * POST /api/production/input-cancel
 * 투입 취소 처리
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { processCode, lineCode, items, userId } = body;

    if (!items || items.length === 0) {
      return error('취소할 항목이 없습니다.');
    }

    let successCount = 0;

    for (const item of items) {
      try {
        // 투입 취소 표시
        const result = await oracle.execute(
          `UPDATE PMB100
           SET CANCEL_YN = 'Y',
               CANCEL_USER = :userId,
               CANCEL_DATE = SYSDATE
           WHERE BOX_NO = :boxNo
             AND PROCESS_CODE = :processCode
             AND LINE_CODE = :lineCode
             AND CANCEL_YN IS NULL`,
          {
            boxNo: item.boxNo,
            processCode: processCode,
            lineCode: lineCode,
            userId: userId || 'SYSTEM',
          }
        );

        if (result.success && (result.rowsAffected || 0) > 0) {
          // 재고 복원
          await oracle.execute(
            `UPDATE PMS100
             SET QTY = QTY + :qty,
                 UPD_USER = :userId,
                 UPD_DATE = SYSDATE
             WHERE BOX_NO = :boxNo`,
            {
              boxNo: item.boxNo,
              qty: item.qty,
              userId: userId || 'SYSTEM',
            }
          );
          successCount++;
        }
      } catch (itemErr) {
        console.error('취소 항목 처리 오류:', itemErr);
      }
    }

    if (successCount === 0) {
      return error('취소된 항목이 없습니다.');
    }

    return success(
      { count: successCount },
      `${successCount}건 취소 처리되었습니다.`
    );
  } catch (err) {
    console.error('투입취소 API 오류:', err);
    return serverError('투입취소 처리 중 오류가 발생했습니다.');
  }
}
