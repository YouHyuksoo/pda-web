/**
 * @file src/app/api/production/smd-check/route.ts
 * @description
 * SMD전수검사 API 엔드포인트입니다.
 * SMD 검사 결과를 저장합니다.
 *
 * @example
 * POST /api/production/smd-check
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';

/**
 * POST /api/production/smd-check
 * SMD 검사결과 저장
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { saupj, processCode, lineCode, workDate, items, userId } = body;

    if (!processCode || !lineCode) {
      return error('공정코드와 라인코드는 필수입니다.');
    }

    if (!items || items.length === 0) {
      return error('검사할 항목이 없습니다.');
    }

    const wkDate = workDate?.replace(/-/g, '') || new Date().toISOString().slice(0, 10).replace(/-/g, '');
    let successCount = 0;
    let okCount = 0;
    let ngCount = 0;

    for (const item of items) {
      try {
        const result = await oracle.execute(
          `INSERT INTO PMB400 (
            SAUPJ, CHECK_DATE, PROCESS_CODE, LINE_CODE,
            BOX_NO, ITEM_CODE, CHECK_RESULT, CHECK_TIME,
            REG_USER, REG_DATE
          ) VALUES (
            :saupj, :checkDate, :processCode, :lineCode,
            :boxNo, :itemCode, :result, :checkTime,
            :userId, SYSDATE
          )`,
          {
            saupj: saupj || '10',
            checkDate: wkDate,
            processCode: processCode,
            lineCode: lineCode,
            boxNo: item.boxNo,
            itemCode: item.itemCode || '',
            result: item.result,
            checkTime: item.checkTime || '',
            userId: userId || 'SYSTEM',
          }
        );

        if (result.success) {
          successCount++;
          if (item.result === 'OK') okCount++;
          else if (item.result === 'NG') ngCount++;
        }
      } catch (itemErr) {
        console.error('검사 항목 처리 오류:', itemErr);
      }
    }

    if (successCount === 0) {
      return error('저장된 검사 결과가 없습니다.');
    }

    return success(
      { count: successCount, ok: okCount, ng: ngCount },
      `검사 완료 (OK: ${okCount}건, NG: ${ngCount}건)`
    );
  } catch (err) {
    console.error('SMD검사 API 오류:', err);
    return serverError('SMD검사 저장 중 오류가 발생했습니다.');
  }
}
