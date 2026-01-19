/**
 * @file src/app/api/production/stirring/route.ts
 * @description
 * 교반 API 엔드포인트입니다.
 * 교반 시작/종료 시간을 기록합니다.
 *
 * @example
 * POST /api/production/stirring
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';

/**
 * POST /api/production/stirring
 * 교반 저장
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { saupj, processCode, lineCode, workDate, items, userId } = body;

    if (!processCode || !lineCode) {
      return error('공정코드와 라인코드는 필수입니다.');
    }

    if (!items || items.length === 0) {
      return error('저장할 항목이 없습니다.');
    }

    const wkDate = workDate?.replace(/-/g, '') || new Date().toISOString().slice(0, 10).replace(/-/g, '');
    let successCount = 0;

    for (const item of items) {
      try {
        const result = await oracle.execute(
          `INSERT INTO PMB430 (
            SAUPJ, WORK_DATE, PROCESS_CODE, LINE_CODE,
            BOX_NO, ITEM_CODE, START_TIME, END_TIME, DURATION, STATUS,
            REG_USER, REG_DATE
          ) VALUES (
            :saupj, :workDate, :processCode, :lineCode,
            :boxNo, :itemCode, :startTime, :endTime, :duration, :status,
            :userId, SYSDATE
          )`,
          {
            saupj: saupj || '10',
            workDate: wkDate,
            processCode: processCode,
            lineCode: lineCode,
            boxNo: item.boxNo,
            itemCode: item.itemCode || '',
            startTime: item.startTime || '',
            endTime: item.endTime || '',
            duration: item.duration || 0,
            status: item.status === 'completed' ? 'C' : 'W',
            userId: userId || 'SYSTEM',
          }
        );

        if (result.success) successCount++;
      } catch (itemErr) {
        console.error('교반 항목 처리 오류:', itemErr);
      }
    }

    if (successCount === 0) {
      return error('저장된 항목이 없습니다.');
    }

    return success(
      { count: successCount },
      `${successCount}건 저장되었습니다.`
    );
  } catch (err) {
    console.error('교반 API 오류:', err);
    return serverError('교반 저장 중 오류가 발생했습니다.');
  }
}
