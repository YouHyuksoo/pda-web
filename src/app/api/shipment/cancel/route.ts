/**
 * @file src/app/api/shipment/cancel/route.ts
 * @description
 * 출하취소 API 엔드포인트입니다.
 * 출하 내역 조회 및 취소 처리를 수행합니다.
 *
 * @example
 * GET /api/shipment/cancel?fromDate=20240115&toDate=20240115&shipNo=SH001
 * DELETE /api/shipment/cancel (출하 취소)
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';

/**
 * GET /api/shipment/cancel
 * 출하 내역 조회 (취소 대상)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const shipNo = searchParams.get('shipNo');

    if (!fromDate || !toDate) {
      return error('조회 기간을 선택해주세요.');
    }

    const wkFromDate = fromDate.replace(/-/g, '');
    const wkToDate = toDate.replace(/-/g, '');

    let sql = `
      SELECT
        A.SNO,
        A.SHIP_NO,
        A.BOXNO AS BOX_NO,
        A.ITEMCODE AS ITEM_CODE,
        B.ITEM_NAME,
        A.GQTY AS QTY,
        A.WKDATE AS SHIP_DATE,
        A.CUSTCODE AS CUST_CODE,
        C.CUST_NAME AS CUSTOMER
      FROM PMB900 A
      LEFT JOIN BOM_MASTER B ON A.ITEMCODE = B.ITEM_CODE
      LEFT JOIN CUST_MASTER C ON A.CUSTCODE = C.CUST_CODE
      WHERE A.WKDATE BETWEEN :fromDate AND :toDate
        AND A.DEL_YN IS NULL
    `;

    const params: Record<string, string> = { fromDate: wkFromDate, toDate: wkToDate };

    if (shipNo) {
      sql += ` AND A.SHIP_NO LIKE '%' || :shipNo || '%'`;
      params.shipNo = shipNo;
    }

    sql += ` ORDER BY A.WKDATE DESC, A.SHIP_NO, A.BOXNO`;

    const result = await oracle.query(sql, params);

    if (!result.success) {
      return serverError(result.error || 'DB 조회 실패');
    }

    const items = (result.data || []).map((row: Record<string, unknown>, idx: number) => ({
      no: idx + 1,
      sno: row.SNO,
      shipNo: row.SHIP_NO || '',
      boxNo: row.BOX_NO || '',
      itemCode: row.ITEM_CODE || '',
      itemName: row.ITEM_NAME || '',
      qty: row.QTY || 0,
      shipDate: row.SHIP_DATE || '',
      customer: row.CUSTOMER || '',
    }));

    return success(items);
  } catch (err) {
    console.error('출하 내역 조회 오류:', err);
    return serverError('출하 내역 조회 중 오류가 발생했습니다.');
  }
}

/**
 * DELETE /api/shipment/cancel
 * 출하 취소
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, userId } = body;

    if (!items || items.length === 0) {
      return error('취소할 항목을 선택해주세요.');
    }

    const queries = [];

    for (const item of items) {
      // PMB900 삭제 처리 (논리적 삭제)
      queries.push({
        sql: `
          UPDATE PMB900
          SET DEL_YN = 'Y',
              DEL_USER = :userId,
              DEL_DATE = SYSDATE
          WHERE SNO = :sno
        `,
        params: {
          sno: item.sno,
          userId: userId || 'SYSTEM',
        },
      });

      // 재고 복원 (PMS100)
      queries.push({
        sql: `
          UPDATE PMS100
          SET PQTY = PQTY + :qty,
              UPD_USER = :userId,
              UPD_DATE = SYSDATE
          WHERE BOXNO = :boxNo
            AND ITEMCODE = :itemCode
        `,
        params: {
          qty: item.qty,
          boxNo: item.boxNo,
          itemCode: item.itemCode,
          userId: userId || 'SYSTEM',
        },
      });
    }

    const result = await oracle.executeTransaction(queries);

    if (!result.success) {
      return serverError(result.error || '출하 취소 실패');
    }

    return success({ count: items.length }, `${items.length}건 출하 취소되었습니다.`);
  } catch (err) {
    console.error('출하 취소 오류:', err);
    return serverError('출하 취소 중 오류가 발생했습니다.');
  }
}
