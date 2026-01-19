/**
 * @file src/app/api/material/receive-cancel/route.ts
 * @description
 * 자재입고 취소 API 엔드포인트입니다.
 * 입고된 자재를 취소 처리합니다.
 *
 * @example
 * POST /api/material/receive-cancel
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';

/**
 * POST /api/material/receive-cancel
 * 자재입고 취소 처리
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { saupj, whsCode, items, userId } = body;

    if (!whsCode) {
      return error('창고 코드는 필수입니다.');
    }

    if (!items || items.length === 0) {
      return error('취소할 항목이 없습니다.');
    }

    let successCount = 0;

    for (const item of items) {
      try {
        // 재고 차감
        const stockResult = await oracle.execute(
          `UPDATE PMS100
           SET QTY = QTY - :qty,
               UPD_USER = :userId,
               UPD_DATE = SYSDATE
           WHERE BOX_NO = :boxNo
             AND WHS_CODE = :whsCode
             AND QTY >= :qty`,
          {
            boxNo: item.boxNo,
            whsCode: whsCode,
            qty: item.qty,
            userId: userId || 'SYSTEM',
          }
        );

        if (stockResult.success && (stockResult.rowsAffected || 0) > 0) {
          // 입고 이력에 취소 표시
          await oracle.execute(
            `UPDATE PMB310
             SET CANCEL_YN = 'Y',
                 CANCEL_USER = :userId,
                 CANCEL_DATE = SYSDATE
             WHERE BOX_NO = :boxNo
               AND WHS_CODE = :whsCode
               AND RECEIVE_DATE = :receiveDate
               AND CANCEL_YN IS NULL`,
            {
              boxNo: item.boxNo,
              whsCode: whsCode,
              receiveDate: item.receiveDate?.replace(/-/g, '') || '',
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
      return error('취소된 항목이 없습니다. 재고가 부족할 수 있습니다.');
    }

    return success(
      { count: successCount },
      `${successCount}건 취소 처리되었습니다.`
    );
  } catch (err) {
    console.error('자재입고 취소 API 오류:', err);
    return serverError('자재입고 취소 처리 중 오류가 발생했습니다.');
  }
}
