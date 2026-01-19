/**
 * @file src/app/api/quality/oqc-oracle/route.ts
 * @description
 * OQC 검사(Oracle) API 엔드포인트입니다.
 * 출하 예정 목록을 조회하고 검사 결과를 저장합니다.
 *
 * @example
 * GET /api/quality/oqc-oracle?shipDate=20240115
 * GET /api/quality/oqc-oracle/check-items?itemCode=PROD001
 * POST /api/quality/oqc-oracle
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';


/** 동적 라우트 설정 - 빌드 시 정적 생성 방지 */
export const dynamic = 'force-dynamic';
/**
 * GET /api/quality/oqc-oracle
 * 출하 예정 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shipDate = searchParams.get('shipDate');
    const itemCode = searchParams.get('itemCode');

    // 품목별 검사 항목 조회
    if (itemCode) {
      const sql = `
        SELECT
          A.CHECK_NO AS NO,
          A.CHECK_CODE,
          A.CHECK_NAME,
          A.STANDARD
        FROM QMS_CHECK_MASTER A
        WHERE A.ITEM_CODE = :itemCode
          AND A.USE_YN = 'Y'
        ORDER BY A.CHECK_NO
      `;

      const result = await oracle.query(sql, { itemCode });

      if (!result.success) {
        return serverError(result.error || 'DB 조회 실패');
      }

      const checkItems = (result.data || []).map((row: Record<string, unknown>) => ({
        no: row.NO,
        checkCode: row.CHECK_CODE,
        checkName: row.CHECK_NAME,
        standard: row.STANDARD || '',
        result: null,
      }));

      return success(checkItems);
    }

    // 출하 예정 목록 조회
    const wkDate = shipDate?.replace(/-/g, '') || new Date().toISOString().slice(0, 10).replace(/-/g, '');

    const sql = `
      SELECT
        A.SHIP_NO,
        A.BOX_NO,
        A.ITEM_CODE,
        B.ITEM_NAME,
        A.QTY,
        A.CUSTOMER
      FROM SHP100 A
      LEFT JOIN BOM_MASTER B ON A.ITEM_CODE = B.ITEM_CODE
      WHERE A.SHIP_DATE = :shipDate
        AND A.OQC_YN IS NULL
      ORDER BY A.SHIP_NO
    `;

    const result = await oracle.query(sql, { shipDate: wkDate });

    if (!result.success) {
      return serverError(result.error || 'DB 조회 실패');
    }

    const targets = (result.data || []).map((row: Record<string, unknown>) => ({
      shipNo: row.SHIP_NO,
      boxNo: row.BOX_NO,
      itemCode: row.ITEM_CODE,
      itemName: row.ITEM_NAME || '',
      qty: row.QTY,
      customer: row.CUSTOMER || '',
    }));

    return success(targets);
  } catch (err) {
    console.error('OQC Oracle 조회 오류:', err);
    return serverError('OQC 조회 중 오류가 발생했습니다.');
  }
}

/**
 * POST /api/quality/oqc-oracle
 * OQC 검사 결과 저장 (Oracle)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { saupj, shipNo, boxNo, itemCode, results, remark, userId } = body;

    if (!shipNo) {
      return error('출하번호는 필수입니다.');
    }

    if (!results || results.length === 0) {
      return error('검사 결과가 없습니다.');
    }

    const wkDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const ngCount = results.filter((r: { result: string }) => r.result === 'NG').length;
    const finalResult = ngCount > 0 ? 'NG' : 'OK';

    // OQC 검사 결과 저장
    const insertResult = await oracle.execute(
      `INSERT INTO QMS200 (
        SAUPJ, CHECK_DATE, SHIP_NO, BOX_NO, ITEM_CODE,
        FINAL_RESULT, OK_COUNT, NG_COUNT, REMARK,
        REG_USER, REG_DATE
      ) VALUES (
        :saupj, :checkDate, :shipNo, :boxNo, :itemCode,
        :finalResult, :okCount, :ngCount, :remark,
        :userId, SYSDATE
      )`,
      {
        saupj: saupj || '10',
        checkDate: wkDate,
        shipNo: shipNo,
        boxNo: boxNo || '',
        itemCode: itemCode || '',
        finalResult: finalResult,
        okCount: results.length - ngCount,
        ngCount: ngCount,
        remark: remark || '',
        userId: userId || 'SYSTEM',
      }
    );

    if (!insertResult.success) {
      return error('검사 결과 저장 실패');
    }

    // 출하 테이블에 OQC 완료 표시
    await oracle.execute(
      `UPDATE SHP100
       SET OQC_YN = 'Y',
           OQC_RESULT = :finalResult,
           OQC_DATE = SYSDATE,
           UPD_USER = :userId,
           UPD_DATE = SYSDATE
       WHERE SHIP_NO = :shipNo`,
      {
        finalResult: finalResult,
        shipNo: shipNo,
        userId: userId || 'SYSTEM',
      }
    );

    // 상세 검사 항목 저장
    for (const item of results) {
      await oracle.execute(
        `INSERT INTO QMS210 (
          SAUPJ, CHECK_DATE, SHIP_NO, ITEM_NO,
          CHECK_CODE, CHECK_NAME, STANDARD, RESULT,
          REG_USER, REG_DATE
        ) VALUES (
          :saupj, :checkDate, :shipNo, :itemNo,
          :checkCode, :checkName, :standard, :result,
          :userId, SYSDATE
        )`,
        {
          saupj: saupj || '10',
          checkDate: wkDate,
          shipNo: shipNo,
          itemNo: item.no,
          checkCode: item.checkCode || '',
          checkName: item.checkName || '',
          standard: item.standard || '',
          result: item.result,
          userId: userId || 'SYSTEM',
        }
      );
    }

    return success(
      { finalResult, okCount: results.length - ngCount, ngCount },
      `검사 완료 (${finalResult}) - Oracle DB 저장됨`
    );
  } catch (err) {
    console.error('OQC Oracle 저장 오류:', err);
    return serverError('OQC 검사 저장 중 오류가 발생했습니다.');
  }
}
