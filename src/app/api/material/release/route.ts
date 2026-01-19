/**
 * @file src/app/api/material/release/route.ts
 * @description
 * 자재출고 API 엔드포인트입니다.
 * 창고에서 자재를 출고 처리합니다.
 *
 * @example
 * POST /api/material/release
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';

/**
 * POST /api/material/release
 * 자재출고 저장
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { saupj, releaseDate, whsCode, items, userId } = body;

    if (!whsCode) {
      return error('창고 코드는 필수입니다.');
    }

    if (!items || items.length === 0) {
      return error('출고할 항목이 없습니다.');
    }

    const wkDate = releaseDate?.replace(/-/g, '') || new Date().toISOString().slice(0, 10).replace(/-/g, '');
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
          // 출고 이력 기록
          await oracle.execute(
            `INSERT INTO PMB320 (
              SAUPJ, RELEASE_DATE, BOX_NO, ITEM_CODE,
              WHS_CODE, QTY, RELEASE_TYPE,
              REG_USER, REG_DATE
            ) VALUES (
              :saupj, :releaseDate, :boxNo, :itemCode,
              :whsCode, :qty, 'O',
              :userId, SYSDATE
            )`,
            {
              saupj: saupj || '10',
              releaseDate: wkDate,
              boxNo: item.boxNo,
              itemCode: item.itemCode,
              whsCode: whsCode,
              qty: item.qty,
              userId: userId || 'SYSTEM',
            }
          );
          successCount++;
        }
      } catch (itemErr) {
        console.error('출고 항목 처리 오류:', itemErr);
      }
    }

    if (successCount === 0) {
      return error('출고된 항목이 없습니다. 재고가 부족할 수 있습니다.');
    }

    return success(
      { count: successCount },
      `${successCount}건 출고 처리되었습니다.`
    );
  } catch (err) {
    console.error('자재출고 API 오류:', err);
    return serverError('자재출고 처리 중 오류가 발생했습니다.');
  }
}
