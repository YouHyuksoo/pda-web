/**
 * @file src/app/api/material/receive/route.ts
 * @description
 * 자재입고 API 엔드포인트입니다.
 * 창고에 자재를 입고 처리합니다.
 *
 * @example
 * POST /api/material/receive
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';

/**
 * POST /api/material/receive
 * 자재입고 저장
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { saupj, receiveDate, whsCode, items, userId } = body;

    if (!whsCode) {
      return error('창고 코드는 필수입니다.');
    }

    if (!items || items.length === 0) {
      return error('입고할 항목이 없습니다.');
    }

    const wkDate = receiveDate?.replace(/-/g, '') || new Date().toISOString().slice(0, 10).replace(/-/g, '');
    let successCount = 0;

    for (const item of items) {
      try {
        // 재고 테이블에 입고 처리 (MERGE: 있으면 UPDATE, 없으면 INSERT)
        const result = await oracle.execute(
          `MERGE INTO PMS100 A
           USING (SELECT :boxNo AS BOX_NO, :whsCode AS WHS_CODE FROM DUAL) B
           ON (A.BOX_NO = B.BOX_NO AND A.WHS_CODE = B.WHS_CODE)
           WHEN MATCHED THEN
             UPDATE SET A.QTY = A.QTY + :qty,
                        A.UPD_USER = :userId,
                        A.UPD_DATE = SYSDATE
           WHEN NOT MATCHED THEN
             INSERT (SAUPJ, BOX_NO, ITEM_CODE, WHS_CODE, QTY, LOT_NO, REG_USER, REG_DATE)
             VALUES (:saupj, :boxNo, :itemCode, :whsCode, :qty, :lotNo, :userId, SYSDATE)`,
          {
            saupj: saupj || '10',
            boxNo: item.boxNo,
            itemCode: item.itemCode,
            whsCode: whsCode,
            qty: item.qty,
            lotNo: item.lotNo || '',
            userId: userId || 'SYSTEM',
          }
        );

        if (result.success) {
          // 입고 이력 기록
          await oracle.execute(
            `INSERT INTO PMB310 (
              SAUPJ, RECEIVE_DATE, BOX_NO, ITEM_CODE,
              WHS_CODE, QTY, RECEIVE_TYPE,
              REG_USER, REG_DATE
            ) VALUES (
              :saupj, :receiveDate, :boxNo, :itemCode,
              :whsCode, :qty, 'R',
              :userId, SYSDATE
            )`,
            {
              saupj: saupj || '10',
              receiveDate: wkDate,
              boxNo: item.boxNo,
              itemCode: item.itemCode,
              whsCode: whsCode,
              qty: item.qty,
              userId: userId || 'SYSTEM',
            }
          );
          successCount++;
        }
      } catch (itemErr) {
        console.error('입고 항목 처리 오류:', itemErr);
      }
    }

    if (successCount === 0) {
      return error('저장된 항목이 없습니다.');
    }

    return success(
      { count: successCount },
      `${successCount}건 입고 처리되었습니다.`
    );
  } catch (err) {
    console.error('자재입고 API 오류:', err);
    return serverError('자재입고 처리 중 오류가 발생했습니다.');
  }
}

/**
 * GET /api/material/receive
 * 입고 내역 조회 (취소용)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const whsCode = searchParams.get('whsCode');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    if (!whsCode) {
      return error('창고 코드는 필수입니다.');
    }

    const sql = `
      SELECT
        A.BOX_NO,
        A.ITEM_CODE,
        B.ITEM_NAME,
        A.QTY,
        A.RECEIVE_DATE,
        A.WHS_CODE
      FROM PMB310 A
      LEFT JOIN BOM_MASTER B ON A.ITEM_CODE = B.ITEM_CODE
      WHERE A.WHS_CODE = :whsCode
        AND A.RECEIVE_TYPE = 'R'
        AND A.RECEIVE_DATE BETWEEN :fromDate AND :toDate
        AND A.CANCEL_YN IS NULL
      ORDER BY A.RECEIVE_DATE DESC, A.REG_DATE DESC
    `;

    const result = await oracle.query(sql, {
      whsCode,
      fromDate: fromDate?.replace(/-/g, '') || '',
      toDate: toDate?.replace(/-/g, '') || '',
    });

    if (!result.success) {
      return serverError(result.error || 'DB 조회 실패');
    }

    const items = (result.data || []).map((row: Record<string, unknown>, idx: number) => ({
      no: idx + 1,
      boxNo: row.BOX_NO,
      itemCode: row.ITEM_CODE,
      itemName: row.ITEM_NAME || '',
      qty: row.QTY,
      receiveDate: row.RECEIVE_DATE,
      selected: false,
    }));

    return success(items);
  } catch (err) {
    console.error('입고 내역 조회 오류:', err);
    return serverError('입고 내역 조회 중 오류가 발생했습니다.');
  }
}
