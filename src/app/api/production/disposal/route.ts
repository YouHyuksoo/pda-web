/**
 * @file src/app/api/production/disposal/route.ts
 * @description
 * 폐기처리 API 엔드포인트입니다.
 * 재고를 폐기 처리합니다.
 *
 * @example
 * POST /api/production/disposal
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';


/** 동적 라우트 설정 - 빌드 시 정적 생성 방지 */
export const dynamic = 'force-dynamic';
/**
 * POST /api/production/disposal
 * 폐기처리 저장
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { saupj, whsCode, reason, remark, items, userId } = body;

    if (!whsCode) {
      return error('창고코드는 필수입니다.');
    }

    if (!reason) {
      return error('폐기사유는 필수입니다.');
    }

    if (!items || items.length === 0) {
      return error('폐기할 항목이 없습니다.');
    }

    const wkDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    let successCount = 0;
    let totalQty = 0;

    for (const item of items) {
      try {
        // 재고 차감
        const stockResult = await oracle.execute(
          `UPDATE PMS100
           SET QTY = 0,
               DISPOSAL_YN = 'Y',
               UPD_USER = :userId,
               UPD_DATE = SYSDATE
           WHERE BOX_NO = :boxNo
             AND WHS_CODE = :whsCode`,
          {
            boxNo: item.boxNo,
            whsCode: whsCode,
            userId: userId || 'SYSTEM',
          }
        );

        if (stockResult.success) {
          // 폐기 이력 기록
          await oracle.execute(
            `INSERT INTO PMB420 (
              SAUPJ, DISPOSAL_DATE, BOX_NO, ITEM_CODE,
              WHS_CODE, QTY, REASON_CODE, REMARK,
              REG_USER, REG_DATE
            ) VALUES (
              :saupj, :disposalDate, :boxNo, :itemCode,
              :whsCode, :qty, :reasonCode, :remark,
              :userId, SYSDATE
            )`,
            {
              saupj: saupj || '10',
              disposalDate: wkDate,
              boxNo: item.boxNo,
              itemCode: item.itemCode || '',
              whsCode: whsCode,
              qty: item.qty,
              reasonCode: reason,
              remark: remark || '',
              userId: userId || 'SYSTEM',
            }
          );
          successCount++;
          totalQty += item.qty;
        }
      } catch (itemErr) {
        console.error('폐기 항목 처리 오류:', itemErr);
      }
    }

    if (successCount === 0) {
      return error('폐기된 항목이 없습니다.');
    }

    return success(
      { count: successCount, totalQty },
      `${successCount}건 (${totalQty}EA) 폐기 처리되었습니다.`
    );
  } catch (err) {
    console.error('폐기처리 API 오류:', err);
    return serverError('폐기처리 중 오류가 발생했습니다.');
  }
}
