/**
 * @file src/app/api/production/parts-input/route.ts
 * @description
 * 부품투입 API 엔드포인트입니다.
 * 작업지시에 부품을 투입 처리합니다.
 *
 * @example
 * POST /api/production/parts-input
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';

/**
 * POST /api/production/parts-input
 * 부품투입 저장
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { saupj, workOrder, processCode, lineCode, items, userId } = body;

    if (!workOrder) {
      return error('작업지시번호는 필수입니다.');
    }

    if (!items || items.length === 0) {
      return error('투입할 부품이 없습니다.');
    }

    const wkDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    let successCount = 0;

    for (const item of items) {
      try {
        // 부품 투입 이력 기록
        const result = await oracle.execute(
          `INSERT INTO PMB201 (
            SAUPJ, WORK_ORDER, PROCESS_CODE, LINE_CODE,
            INPUT_DATE, BOX_NO, PART_CODE, QTY,
            REG_USER, REG_DATE
          ) VALUES (
            :saupj, :workOrder, :processCode, :lineCode,
            :inputDate, :boxNo, :partCode, :qty,
            :userId, SYSDATE
          )`,
          {
            saupj: saupj || '10',
            workOrder: workOrder,
            processCode: processCode || '',
            lineCode: lineCode || '',
            inputDate: wkDate,
            boxNo: item.boxNo,
            partCode: item.partCode,
            qty: item.qty,
            userId: userId || 'SYSTEM',
          }
        );

        if (result.success) {
          // 재고 차감
          await oracle.execute(
            `UPDATE PMS100
             SET QTY = QTY - :qty,
                 UPD_USER = :userId,
                 UPD_DATE = SYSDATE
             WHERE BOX_NO = :boxNo
               AND QTY >= :qty`,
            {
              boxNo: item.boxNo,
              qty: item.qty,
              userId: userId || 'SYSTEM',
            }
          );
          successCount++;
        }
      } catch (itemErr) {
        console.error('부품투입 항목 처리 오류:', itemErr);
      }
    }

    if (successCount === 0) {
      return error('투입된 부품이 없습니다.');
    }

    return success(
      { count: successCount },
      `${successCount}건 부품 투입되었습니다.`
    );
  } catch (err) {
    console.error('부품투입 API 오류:', err);
    return serverError('부품투입 처리 중 오류가 발생했습니다.');
  }
}
