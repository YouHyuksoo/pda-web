/**
 * @file src/app/api/plan/next-detach/route.ts
 * @description
 * 차기탈착 API 엔드포인트입니다.
 * 차기 작업에서 사용하지 않는 부품(탈착 대상) 목록 조회 및 탈착 예정 등록을 처리합니다.
 *
 * @example
 * GET /api/plan/next-detach?processCode=P01&lineCode=L01&planDate=20240102
 * POST /api/plan/next-detach (탈착 예정 등록)
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';

/**
 * GET /api/plan/next-detach
 * 탈착 대상 부품 목록 조회 (현재 장착 중인데 차기 작업에서 불필요한 부품)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const processCode = searchParams.get('processCode');
    const lineCode = searchParams.get('lineCode');
    const planDate = searchParams.get('planDate');

    if (!processCode || !lineCode) {
      return error('공정/라인을 선택해주세요.');
    }

    // 현재 장착 부품 중 차기 작업에서 미사용 부품 조회
    const sql = `
      SELECT
        A.FEEDER_NO,
        A.PART_CODE,
        B.ITEM_NAME AS PART_NAME,
        A.LOTNO AS LOT_NO,
        A.REMAIN_QTY,
        CASE
          WHEN A.REMAIN_QTY < 100 THEN '잔량 부족'
          WHEN NOT EXISTS (
            SELECT 1 FROM PMM_FEEDER_MASTER C
            WHERE C.OPCODE = :processCode
              AND C.LINECODE = :lineCode
              AND C.PART_CODE = A.PART_CODE
              AND C.USE_YN = 'Y'
          ) THEN '차기 작업 미사용'
          ELSE '품목 변경'
        END AS REASON
      FROM PMM100 A
      LEFT JOIN BOM_MASTER B ON A.PART_CODE = B.ITEM_CODE
      WHERE A.OPCODE = :processCode
        AND A.LINECODE = :lineCode
        AND A.DETACH_YN = 'N'
        AND (
          A.REMAIN_QTY < 100
          OR NOT EXISTS (
            SELECT 1 FROM PMO100 D
            WHERE D.OPCODE = :processCode
              AND D.LINECODE = :lineCode
              AND D.WKDATE = NVL(:planDate, TO_CHAR(SYSDATE + 1, 'YYYYMMDD'))
              AND D.STATUS = 'P'
              AND EXISTS (
                SELECT 1 FROM BOM_DETAIL E
                WHERE E.PARENT_CODE = D.ITEMCODE
                  AND E.CHILD_CODE = A.PART_CODE
              )
          )
        )
      ORDER BY A.FEEDER_NO
    `;

    const result = await oracle.query(sql, {
      processCode,
      lineCode,
      planDate: planDate?.replace(/-/g, '') || null,
    });

    const candidates = (result.data || []).map((row: Record<string, unknown>) => ({
      feederNo: row.FEEDER_NO || '',
      partCode: row.PART_CODE || '',
      partName: row.PART_NAME || '',
      lotNo: row.LOT_NO || '',
      remainQty: row.REMAIN_QTY || 0,
      reason: row.REASON || '',
      selected: false,
    }));

    return success(candidates);
  } catch (err) {
    console.error('차기탈착 조회 오류:', err);
    return serverError('차기탈착 조회 중 오류가 발생했습니다.');
  }
}

/**
 * POST /api/plan/next-detach
 * 탈착 예정 등록
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { processCode, lineCode, feederNos, userId } = body;

    if (!feederNos || feederNos.length === 0) {
      return error('탈착할 항목을 선택해주세요.');
    }

    const queries = [];

    for (const feederNo of feederNos) {
      queries.push({
        sql: `
          UPDATE PMM100
          SET DETACH_PLAN_YN = 'Y',
              DETACH_PLAN_DATE = SYSDATE,
              EDITOR = :userId,
              EDITDATE = SYSDATE
          WHERE OPCODE = :processCode
            AND LINECODE = :lineCode
            AND FEEDER_NO = :feederNo
            AND DETACH_YN = 'N'
        `,
        params: {
          processCode,
          lineCode,
          feederNo,
          userId: userId || 'SYSTEM',
        },
      });
    }

    const result = await oracle.executeTransaction(queries);

    if (!result.success) {
      return serverError(result.error || '등록 실패');
    }

    return success(
      { count: feederNos.length },
      `${feederNos.length}건 탈착 예정 등록되었습니다.`
    );
  } catch (err) {
    console.error('차기탈착 등록 오류:', err);
    return serverError('차기탈착 등록 중 오류가 발생했습니다.');
  }
}
