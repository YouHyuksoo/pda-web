/**
 * @file src/app/api/return/individual/route.ts
 * @description
 * 반품개별입고 API 엔드포인트입니다.
 * 시리얼 단위 반품입고 처리를 수행합니다.
 *
 * @example
 * GET /api/return/individual?serialNo=SN001 (시리얼 정보 조회)
 * POST /api/return/individual (반품개별입고 저장)
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';

/**
 * GET /api/return/individual
 * 시리얼 정보 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serialNo = searchParams.get('serialNo');

    if (!serialNo) {
      return error('시리얼 번호를 입력해주세요.');
    }

    // 출하된 시리얼 정보 조회
    const sql = `
      SELECT
        A.SERIAL_NO,
        A.ITEM_CODE,
        B.ITEM_NAME,
        A.CUST_CODE,
        C.CUST_NAME AS CUSTOMER,
        A.SHIP_DATE
      FROM SHP_SERIAL A
      LEFT JOIN BOM_MASTER B ON A.ITEM_CODE = B.ITEM_CODE
      LEFT JOIN CUST_MASTER C ON A.CUST_CODE = C.CUST_CODE
      WHERE A.SERIAL_NO = :serialNo
        AND A.STATUS = 'SHIPPED'
    `;

    const result = await oracle.query(sql, { serialNo });

    if (!result.success || !result.data || result.data.length === 0) {
      return error('해당 시리얼의 출하 정보를 찾을 수 없습니다.');
    }

    const row = result.data[0] as Record<string, unknown>;

    return success({
      serialNo: row.SERIAL_NO,
      itemCode: row.ITEM_CODE || '',
      itemName: row.ITEM_NAME || '',
      custCode: row.CUST_CODE || '',
      customer: row.CUSTOMER || '',
    });
  } catch (err) {
    console.error('시리얼 조회 오류:', err);
    return serverError('시리얼 조회 중 오류가 발생했습니다.');
  }
}

/**
 * POST /api/return/individual
 * 반품개별입고 저장
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { saupj, whsCode, reason, condition, remark, items, userId } = body;

    if (!whsCode) {
      return error('입고창고를 선택해주세요.');
    }

    if (!items || items.length === 0) {
      return error('반품입고할 항목이 없습니다.');
    }

    const wkDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const queries = [];

    for (const item of items) {
      // RTN110 (반품개별입고) INSERT
      queries.push({
        sql: `
          INSERT INTO RTN110 (
            SNO, SAUPJ, RETURN_DATE, SERIAL_NO, ITEMCODE,
            WHSCODE, REASON, CONDITION, REMARK,
            MAKER, MAKEDATE
          ) VALUES (
            UF_RTN110_SNO(:wkDate),
            :saupj, :wkDate, :serialNo, :itemCode,
            :whsCode, :reason, :condition, :remark,
            :userId, SYSDATE
          )
        `,
        params: {
          wkDate,
          saupj: saupj || '10',
          serialNo: item.serialNo,
          itemCode: item.itemCode,
          whsCode,
          reason: reason || '',
          condition: condition || '',
          remark: remark || '',
          userId: userId || 'SYSTEM',
        },
      });

      // SHP_SERIAL 상태 변경
      queries.push({
        sql: `
          UPDATE SHP_SERIAL
          SET STATUS = 'RETURNED',
              RETURN_DATE = :wkDate,
              RETURN_REASON = :reason,
              RETURN_CONDITION = :condition,
              UPD_USER = :userId,
              UPD_DATE = SYSDATE
          WHERE SERIAL_NO = :serialNo
        `,
        params: {
          wkDate,
          serialNo: item.serialNo,
          reason: reason || '',
          condition: condition || '',
          userId: userId || 'SYSTEM',
        },
      });

      // PMS110 (시리얼 재고) 상태 변경
      queries.push({
        sql: `
          MERGE INTO PMS110 T
          USING (SELECT :serialNo AS SERIAL_NO FROM DUAL) S
          ON (T.SERIAL_NO = S.SERIAL_NO)
          WHEN MATCHED THEN
            UPDATE SET WHSCODE = :whsCode, STATUS = :condition, UPD_USER = :userId, UPD_DATE = SYSDATE
          WHEN NOT MATCHED THEN
            INSERT (SERIAL_NO, ITEMCODE, WHSCODE, STATUS, MAKER, MAKEDATE)
            VALUES (:serialNo, :itemCode, :whsCode, :condition, :userId, SYSDATE)
        `,
        params: {
          serialNo: item.serialNo,
          itemCode: item.itemCode,
          whsCode,
          condition: condition || 'GOOD',
          userId: userId || 'SYSTEM',
        },
      });
    }

    const result = await oracle.executeTransaction(queries);

    if (!result.success) {
      return serverError(result.error || '반품개별입고 저장 실패');
    }

    return success(
      { count: items.length },
      `${items.length}건 반품입고 처리되었습니다.`
    );
  } catch (err) {
    console.error('반품개별입고 저장 오류:', err);
    return serverError('반품개별입고 저장 중 오류가 발생했습니다.');
  }
}
