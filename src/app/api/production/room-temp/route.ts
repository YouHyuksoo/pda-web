/**
 * @file src/app/api/production/room-temp/route.ts
 * @description
 * 상온방치 API 엔드포인트입니다.
 * 상온방치 시작/종료 시간을 기록합니다.
 *
 * @example
 * POST /api/production/room-temp
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';

/**
 * POST /api/production/room-temp
 * 상온방치 저장
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
          `INSERT INTO PMB410 (
            SAUPJ, WORK_DATE, PROCESS_CODE, LINE_CODE,
            BOX_NO, ITEM_CODE, START_TIME, END_TIME, STATUS,
            REG_USER, REG_DATE
          ) VALUES (
            :saupj, :workDate, :processCode, :lineCode,
            :boxNo, :itemCode, :startTime, :endTime, :status,
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
            status: item.status === 'completed' ? 'C' : 'W',
            userId: userId || 'SYSTEM',
          }
        );

        if (result.success) successCount++;
      } catch (itemErr) {
        console.error('상온방치 항목 처리 오류:', itemErr);
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
    console.error('상온방치 API 오류:', err);
    return serverError('상온방치 저장 중 오류가 발생했습니다.');
  }
}
