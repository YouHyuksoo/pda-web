/**
 * @file src/app/api/plan/check/route.ts
 * @description
 * 주기검사 API 엔드포인트입니다.
 * 검사 항목 조회 및 검사 결과 저장을 수행합니다.
 *
 * @example
 * GET /api/plan/check?processCode=P01&lineCode=L01
 * POST /api/plan/check
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';

/**
 * GET /api/plan/check
 * 주기검사 항목 조회
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
        A.CHECK_NO AS NO,
        A.CHECK_NAME,
        A.STANDARD
      FROM QMS_CHECK_MASTER A
      WHERE A.CHECK_TYPE = 'PERIODIC'
        AND (A.PROCESS_CODE = :processCode OR A.PROCESS_CODE IS NULL)
        AND A.USE_YN = 'Y'
      ORDER BY A.CHECK_NO
    `;

    const result = await oracle.query(sql, { processCode });

    if (!result.success) {
      return serverError(result.error || 'DB 조회 실패');
    }

    const checkItems = (result.data || []).map((row: Record<string, unknown>) => ({
      no: row.NO,
      checkName: row.CHECK_NAME,
      standard: row.STANDARD || '',
      result: null,
      value: '',
    }));

    // 기본 검사 항목 없으면 기본값 반환
    if (checkItems.length === 0) {
      return success([
        { no: 1, checkName: '온도 점검', standard: '23±2℃', result: null, value: '' },
        { no: 2, checkName: '습도 점검', standard: '50±10%', result: null, value: '' },
        { no: 3, checkName: '압력 점검', standard: '1.0±0.1 MPa', result: null, value: '' },
        { no: 4, checkName: '청정도 점검', standard: 'Class 10000 이하', result: null, value: '' },
        { no: 5, checkName: '설비 이상 유무', standard: '이상 없음', result: null, value: '' },
      ]);
    }

    return success(checkItems);
  } catch (err) {
    console.error('주기검사 항목 조회 오류:', err);
    return serverError('검사 항목 조회 중 오류가 발생했습니다.');
  }
}

/**
 * POST /api/plan/check
 * 주기검사 결과 저장
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { saupj, processCode, lineCode, checkDate, results, remark, userId } = body;

    if (!processCode || !lineCode) {
      return error('공정/라인을 선택해주세요.');
    }

    if (!results || results.length === 0) {
      return error('검사 결과가 없습니다.');
    }

    const wkDate = checkDate?.replace(/-/g, '') || new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const ngCount = results.filter((r: { result: string }) => r.result === 'NG').length;
    const finalResult = ngCount > 0 ? 'NG' : 'OK';

    const queries = [];

    // 검사 헤더 저장
    queries.push({
      sql: `
        INSERT INTO QMS300 (
          SAUPJ, CHECK_DATE, PROCESS_CODE, LINE_CODE,
          CHECK_TYPE, FINAL_RESULT, OK_COUNT, NG_COUNT, REMARK,
          REG_USER, REG_DATE
        ) VALUES (
          :saupj, :checkDate, :processCode, :lineCode,
          'PERIODIC', :finalResult, :okCount, :ngCount, :remark,
          :userId, SYSDATE
        )
      `,
      params: {
        saupj: saupj || '10',
        checkDate: wkDate,
        processCode,
        lineCode,
        finalResult,
        okCount: results.length - ngCount,
        ngCount,
        remark: remark || '',
        userId: userId || 'SYSTEM',
      },
    });

    // 검사 상세 저장
    for (const item of results) {
      queries.push({
        sql: `
          INSERT INTO QMS310 (
            SAUPJ, CHECK_DATE, PROCESS_CODE, LINE_CODE,
            CHECK_NO, CHECK_NAME, STANDARD, RESULT, MEASURE_VALUE,
            REG_USER, REG_DATE
          ) VALUES (
            :saupj, :checkDate, :processCode, :lineCode,
            :checkNo, :checkName, :standard, :result, :value,
            :userId, SYSDATE
          )
        `,
        params: {
          saupj: saupj || '10',
          checkDate: wkDate,
          processCode,
          lineCode,
          checkNo: item.no,
          checkName: item.checkName || '',
          standard: item.standard || '',
          result: item.result,
          value: item.value || '',
          userId: userId || 'SYSTEM',
        },
      });
    }

    const result = await oracle.executeTransaction(queries);

    if (!result.success) {
      return serverError(result.error || '검사 결과 저장 실패');
    }

    return success(
      { finalResult, okCount: results.length - ngCount, ngCount },
      '저장되었습니다.'
    );
  } catch (err) {
    console.error('주기검사 저장 오류:', err);
    return serverError('검사 결과 저장 중 오류가 발생했습니다.');
  }
}
