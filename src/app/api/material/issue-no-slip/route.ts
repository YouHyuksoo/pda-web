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


/** 동적 라우트 설정 - 빌드 시 정적 생성 방지 */
export const dynamic = 'force-dynamic';
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
