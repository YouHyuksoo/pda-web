/**
 * @file src/app/api/material/issue-no-slip/route.ts
 * @description
 * 자재불출(전표X) API 엔드포인트입니다.
 * 전표 없이 창고 간 자재 이동을 처리합니다.
 *
 * @example
 * POST /api/material/issue-no-slip
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';

/**
 * POST /api/material/issue-no-slip
 * 자재불출(전표X) 저장
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { saupj, issueDate, fromWhsCode, toWhsCode, items, userId } = body;

    if (!fromWhsCode || !toWhsCode) {
      return error('FROM/TO 창고 코드는 필수입니다.');
    }

    if (!items || items.length === 0) {
      return error('불출할 항목이 없습니다.');
    }

    // 자재 불출 처리
    // TODO: 실제 프로시저/테이블에 맞게 수정 필요
    const sql = `
      BEGIN
        FOR i IN 1..:itemCount LOOP
          -- 출고 창고 재고 차감
          UPDATE PMS100
          SET QTY = QTY - :qty,
              UPD_USER = :userId,
              UPD_DATE = SYSDATE
          WHERE BOX_NO = :boxNo
            AND WHS_CODE = :fromWhsCode;

          -- 입고 창고 재고 증가 또는 생성
          MERGE INTO PMS100 A
          USING (SELECT :boxNo AS BOX_NO, :itemCode AS ITEM_CODE, :toWhsCode AS WHS_CODE FROM DUAL) B
          ON (A.BOX_NO = B.BOX_NO AND A.WHS_CODE = B.WHS_CODE)
          WHEN MATCHED THEN
            UPDATE SET A.QTY = A.QTY + :qty, A.UPD_USER = :userId, A.UPD_DATE = SYSDATE
          WHEN NOT MATCHED THEN
            INSERT (BOX_NO, ITEM_CODE, WHS_CODE, QTY, REG_USER, REG_DATE)
            VALUES (B.BOX_NO, B.ITEM_CODE, B.WHS_CODE, :qty, :userId, SYSDATE);

          -- 이동 이력 기록
          INSERT INTO PMB300 (
            MOVE_DATE, SEQ_NO, BOX_NO, ITEM_CODE,
            FROM_WHS, TO_WHS, QTY,
            REG_USER, REG_DATE
          ) VALUES (
            :issueDate, PMB300_SEQ.NEXTVAL, :boxNo, :itemCode,
            :fromWhsCode, :toWhsCode, :qty,
            :userId, SYSDATE
          );
        END LOOP;
        COMMIT;
      END;
    `;

    let successCount = 0;
    const wkDate = issueDate?.replace(/-/g, '') || new Date().toISOString().slice(0, 10).replace(/-/g, '');

    for (const item of items) {
      try {
        const result = await oracle.execute(
          `INSERT INTO PMB300 (
            SAUPJ, MOVE_DATE, BOX_NO, ITEM_CODE,
            FROM_WHS, TO_WHS, QTY,
            REG_USER, REG_DATE
          ) VALUES (
            :saupj, :moveDate, :boxNo, :itemCode,
            :fromWhs, :toWhs, :qty,
            :userId, SYSDATE
          )`,
          {
            saupj: saupj || '10',
            moveDate: wkDate,
            boxNo: item.boxNo,
            itemCode: item.itemCode,
            fromWhs: fromWhsCode,
            toWhs: toWhsCode,
            qty: item.qty,
            userId: userId || 'SYSTEM',
          }
        );
        if (result.success) successCount++;
      } catch (itemErr) {
        console.error('항목 처리 오류:', itemErr);
      }
    }

    if (successCount === 0) {
      return error('저장된 항목이 없습니다.');
    }

    return success(
      { count: successCount },
      `${successCount}건 불출 처리되었습니다.`
    );
  } catch (err) {
    console.error('자재불출(전표X) API 오류:', err);
    return serverError('자재불출 처리 중 오류가 발생했습니다.');
  }
}
