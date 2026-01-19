/**
 * @file src/app/api/repack/individual/route.ts
 * @description
 * 개별재포장 API 엔드포인트입니다.
 * 시리얼 단위로 재포장 처리합니다.
 *
 * @example
 * GET /api/repack/individual?serialNo=SN001 (시리얼 정보 조회)
 * POST /api/repack/individual (재포장 처리)
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';

/**
 * GET /api/repack/individual
 * 시리얼 정보 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serialNo = searchParams.get('serialNo');

    if (!serialNo) {
      return error('시리얼 번호를 입력해주세요.');
    }

    const sql = `
      SELECT
        A.SERIALNO AS SERIAL_NO,
        A.ITEMCODE AS ITEM_CODE,
        B.ITEM_NAME,
        A.BOXNO AS BOX_NO,
        A.STATUS
      FROM PMS110 A
      LEFT JOIN BOM_MASTER B ON A.ITEMCODE = B.ITEM_CODE
      WHERE A.SERIALNO = :serialNo
        AND A.STATUS = 'A'
    `;

    const result = await oracle.query(sql, { serialNo });

    if (!result.success || !result.data || result.data.length === 0) {
      return error('해당 시리얼을 찾을 수 없거나 재포장할 수 없는 상태입니다.');
    }

    const row = result.data[0] as Record<string, unknown>;

    return success({
      serialNo: row.SERIAL_NO,
      itemCode: row.ITEM_CODE || '',
      itemName: row.ITEM_NAME || '',
      boxNo: row.BOX_NO || '',
      status: row.STATUS || '',
    });
  } catch (err) {
    console.error('시리얼 조회 오류:', err);
    return serverError('시리얼 조회 중 오류가 발생했습니다.');
  }
}

/**
 * POST /api/repack/individual
 * 개별 재포장 처리
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { saupj, repackList, userId } = body;

    if (!repackList || repackList.length === 0) {
      return error('재포장할 항목이 없습니다.');
    }

    const queries = [];
    const wkDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    for (const item of repackList) {
      // 기존 시리얼 비활성화
      queries.push({
        sql: `
          UPDATE PMS110
          SET STATUS = 'R',
              EDITOR = :userId,
              EDITDATE = SYSDATE
          WHERE SERIALNO = :oldSerialNo
            AND STATUS = 'A'
        `,
        params: {
          oldSerialNo: item.oldSerialNo,
          userId: userId || 'SYSTEM',
        },
      });

      // 새 시리얼 등록
      queries.push({
        sql: `
          INSERT INTO PMS110 (
            SAUPJ, SERIALNO, ITEMCODE, BOXNO,
            STATUS, MAKER, MAKEDATE
          )
          SELECT
            :saupj, :newSerialNo, ITEMCODE, BOXNO,
            'A', :userId, SYSDATE
          FROM PMS110
          WHERE SERIALNO = :oldSerialNo
        `,
        params: {
          saupj: saupj || '10',
          oldSerialNo: item.oldSerialNo,
          newSerialNo: item.newSerialNo,
          userId: userId || 'SYSTEM',
        },
      });

      // 재포장 이력 저장
      queries.push({
        sql: `
          INSERT INTO PMB620 (
            SNO, SAUPJ, REPACK_DATE,
            OLD_SERIALNO, NEW_SERIALNO, ITEMCODE,
            MAKER, MAKEDATE
          )
          SELECT
            UF_PMB620_SNO(:wkDate),
            :saupj, :wkDate,
            :oldSerialNo, :newSerialNo, ITEMCODE,
            :userId, SYSDATE
          FROM PMS110
          WHERE SERIALNO = :oldSerialNo
        `,
        params: {
          wkDate,
          saupj: saupj || '10',
          oldSerialNo: item.oldSerialNo,
          newSerialNo: item.newSerialNo,
          userId: userId || 'SYSTEM',
        },
      });
    }

    const result = await oracle.executeTransaction(queries);

    if (!result.success) {
      return serverError(result.error || '재포장 처리 실패');
    }

    return success(
      { count: repackList.length },
      `${repackList.length}건 재포장 처리되었습니다.`
    );
  } catch (err) {
    console.error('개별재포장 처리 오류:', err);
    return serverError('재포장 처리 중 오류가 발생했습니다.');
  }
}
