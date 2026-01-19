/**
 * @file src/app/api/quality/oqc/route.ts
 * @description
 * OQC 검사 API 엔드포인트입니다.
 * 제품 바코드 조회 및 검사 결과를 저장합니다.
 *
 * @example
 * GET /api/quality/oqc/product?boxNo=BOX001
 * POST /api/quality/oqc
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';

/**
 * GET /api/quality/oqc
 * 제품 정보 조회 (boxNo 파라미터로)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const boxNo = searchParams.get('boxNo');

    if (!boxNo) {
      return error('BOX NO는 필수입니다.');
    }

    const sql = `
      SELECT
        A.BOX_NO,
        A.ITEM_CODE,
        B.ITEM_NAME,
        A.QTY,
        A.LOT_NO
      FROM PMS100 A
      LEFT JOIN BOM_MASTER B ON A.ITEM_CODE = B.ITEM_CODE
      WHERE A.BOX_NO = :boxNo
    `;

    const result = await oracle.query(sql, { boxNo });

    if (!result.success) {
      return serverError(result.error || 'DB 조회 실패');
    }

    if (!result.data || result.data.length === 0) {
      return error('해당 제품을 찾을 수 없습니다.');
    }

    const row = result.data[0] as Record<string, unknown>;
    const product = {
      boxNo: row.BOX_NO,
      itemCode: row.ITEM_CODE,
      itemName: row.ITEM_NAME || '',
      qty: row.QTY,
      lotNo: row.LOT_NO || '',
    };

    return success(product);
  } catch (err) {
    console.error('OQC 제품 조회 오류:', err);
    return serverError('OQC 제품 조회 중 오류가 발생했습니다.');
  }
}

/**
 * POST /api/quality/oqc
 * OQC 검사 결과 저장
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { saupj, boxNo, itemCode, results, remark, userId } = body;

    if (!boxNo) {
      return error('BOX NO는 필수입니다.');
    }

    if (!results || results.length === 0) {
      return error('검사 결과가 없습니다.');
    }

    const wkDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const ngCount = results.filter((r: { result: string }) => r.result === 'NG').length;
    const finalResult = ngCount > 0 ? 'NG' : 'OK';

    // OQC 검사 결과 저장
    const insertResult = await oracle.execute(
      `INSERT INTO QMS100 (
        SAUPJ, CHECK_DATE, BOX_NO, ITEM_CODE,
        FINAL_RESULT, OK_COUNT, NG_COUNT, REMARK,
        REG_USER, REG_DATE
      ) VALUES (
        :saupj, :checkDate, :boxNo, :itemCode,
        :finalResult, :okCount, :ngCount, :remark,
        :userId, SYSDATE
      )`,
      {
        saupj: saupj || '10',
        checkDate: wkDate,
        boxNo: boxNo,
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

    // 상세 검사 항목 저장
    for (const item of results) {
      await oracle.execute(
        `INSERT INTO QMS110 (
          SAUPJ, CHECK_DATE, BOX_NO, ITEM_NO,
          CHECK_NAME, STANDARD, RESULT, VALUE,
          REG_USER, REG_DATE
        ) VALUES (
          :saupj, :checkDate, :boxNo, :itemNo,
          :checkName, :standard, :result, :value,
          :userId, SYSDATE
        )`,
        {
          saupj: saupj || '10',
          checkDate: wkDate,
          boxNo: boxNo,
          itemNo: item.itemNo,
          checkName: item.checkName || '',
          standard: item.standard || '',
          result: item.result,
          value: item.value || '',
          userId: userId || 'SYSTEM',
        }
      );
    }

    return success(
      { finalResult, okCount: results.length - ngCount, ngCount },
      `검사 완료 (${finalResult})`
    );
  } catch (err) {
    console.error('OQC 검사 저장 오류:', err);
    return serverError('OQC 검사 저장 중 오류가 발생했습니다.');
  }
}
