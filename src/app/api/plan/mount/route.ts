/**
 * @file src/app/api/plan/mount/route.ts
 * @description
 * 장착/탈착 API 엔드포인트입니다.
 * 피더 장착 현황 조회 및 탈착 처리를 수행합니다.
 *
 * @example
 * GET /api/plan/mount?processCode=P01&lineCode=L01 (장착 목록 조회)
 * POST /api/plan/mount (장착 처리)
 * DELETE /api/plan/mount (탈착 처리)
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';


/** 동적 라우트 설정 - 빌드 시 정적 생성 방지 */
export const dynamic = 'force-dynamic';
/**
 * GET /api/plan/mount
 * 장착된 부품 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const processCode = searchParams.get('processCode');
    const lineCode = searchParams.get('lineCode');

    if (!processCode || !lineCode) {
      return error('공정/라인을 선택해주세요.');
    }

    const sql = `
      SELECT
        A.FEEDER_NO,
        A.PART_CODE,
        B.PART_NAME,
        A.LOT_NO,
        A.REMAIN_QTY,
        TO_CHAR(A.MOUNT_TIME, 'HH24:MI') AS MOUNT_TIME
      FROM PMM100 A
      LEFT JOIN BOM_MASTER B ON A.PART_CODE = B.ITEM_CODE
      WHERE A.PROCESS_CODE = :processCode
        AND A.LINE_CODE = :lineCode
        AND A.DETACH_YN IS NULL
      ORDER BY A.FEEDER_NO
    `;

    const result = await oracle.query(sql, { processCode, lineCode });

    if (!result.success) {
      return serverError(result.error || 'DB 조회 실패');
    }

    const mounted = (result.data || []).map((row: Record<string, unknown>) => ({
      feederNo: row.FEEDER_NO,
      partCode: row.PART_CODE,
      partName: row.PART_NAME || '',
      lotNo: row.LOT_NO || '',
      remainQty: row.REMAIN_QTY || 0,
      mountTime: row.MOUNT_TIME || '',
    }));

    return success(mounted);
  } catch (err) {
    console.error('장착 목록 조회 오류:', err);
    return serverError('장착 목록 조회 중 오류가 발생했습니다.');
  }
}

/**
 * POST /api/plan/mount
 * 부품 장착 처리
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { processCode, lineCode, feederNo, partCode, lotNo, qty, userId } = body;

    if (!processCode || !lineCode || !feederNo || !partCode) {
      return error('필수 항목을 입력해주세요.');
    }

    const result = await oracle.execute(
      `INSERT INTO PMM100 (
        PROCESS_CODE, LINE_CODE, FEEDER_NO, PART_CODE,
        LOT_NO, REMAIN_QTY, MOUNT_TIME, MAKER, MAKEDATE
      ) VALUES (
        :processCode, :lineCode, :feederNo, :partCode,
        :lotNo, :qty, SYSDATE, :userId, SYSDATE
      )`,
      {
        processCode,
        lineCode,
        feederNo,
        partCode,
        lotNo: lotNo || '',
        qty: qty || 0,
        userId: userId || 'SYSTEM',
      }
    );

    if (!result.success) {
      return serverError(result.error || '장착 처리 실패');
    }

    return success({ feederNo }, '장착 처리되었습니다.');
  } catch (err) {
    console.error('장착 처리 오류:', err);
    return serverError('장착 처리 중 오류가 발생했습니다.');
  }
}

/**
 * DELETE /api/plan/mount
 * 부품 탈착 처리
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { processCode, lineCode, feederNos, userId } = body;

    if (!processCode || !lineCode) {
      return error('공정/라인을 선택해주세요.');
    }

    if (!feederNos || feederNos.length === 0) {
      return error('탈착할 항목을 선택해주세요.');
    }

    const queries = feederNos.map((feederNo: string) => ({
      sql: `
        UPDATE PMM100
        SET DETACH_YN = 'Y',
            DETACH_TIME = SYSDATE,
            UPD_USER = :userId,
            UPD_DATE = SYSDATE
        WHERE PROCESS_CODE = :processCode
          AND LINE_CODE = :lineCode
          AND FEEDER_NO = :feederNo
          AND DETACH_YN IS NULL
      `,
      params: {
        processCode,
        lineCode,
        feederNo,
        userId: userId || 'SYSTEM',
      },
    }));

    const result = await oracle.executeTransaction(queries);

    if (!result.success) {
      return serverError(result.error || '탈착 처리 실패');
    }

    return success({ count: feederNos.length }, `${feederNos.length}건 탈착 처리되었습니다.`);
  } catch (err) {
    console.error('탈착 처리 오류:', err);
    return serverError('탈착 처리 중 오류가 발생했습니다.');
  }
}
