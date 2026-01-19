/**
 * @file src/app/api/shipment/order/route.ts
 * @description
 * 출하주문 조회 API 엔드포인트입니다.
 * 출하번호로 출하주문 정보와 품목 목록을 조회합니다.
 *
 * @example
 * GET /api/shipment/order?shipNo=SH240115001
 * POST /api/shipment/order (출하처리 저장)
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';

/**
 * GET /api/shipment/order
 * 출하주문 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shipNo = searchParams.get('shipNo');

    if (!shipNo) {
      return error('출하번호를 입력해주세요.');
    }

    // 출하 헤더 조회
    const headerSql = `
      SELECT
        A.SHIP_NO,
        A.CUST_CODE,
        B.CUST_NAME AS CUSTOMER,
        A.ORDER_DATE,
        A.SHIP_DATE
      FROM SHP100 A
      LEFT JOIN CUST_MASTER B ON A.CUST_CODE = B.CUST_CODE
      WHERE A.SHIP_NO = :shipNo
    `;

    const headerResult = await oracle.query(headerSql, { shipNo });

    if (!headerResult.success || !headerResult.data || headerResult.data.length === 0) {
      return error('해당 출하번호를 찾을 수 없습니다.');
    }

    const header = headerResult.data[0] as Record<string, unknown>;

    // 출하 상세 품목 조회
    const itemSql = `
      SELECT
        A.ITEM_NO AS NO,
        A.ITEM_CODE,
        B.ITEM_NAME,
        A.ORDER_QTY,
        NVL(A.SHIPPED_QTY, 0) AS SHIPPED_QTY
      FROM SHP110 A
      LEFT JOIN BOM_MASTER B ON A.ITEM_CODE = B.ITEM_CODE
      WHERE A.SHIP_NO = :shipNo
      ORDER BY A.ITEM_NO
    `;

    const itemResult = await oracle.query(itemSql, { shipNo });

    const items = (itemResult.data || []).map((row: Record<string, unknown>) => ({
      no: row.NO,
      itemCode: row.ITEM_CODE,
      itemName: row.ITEM_NAME || '',
      orderQty: row.ORDER_QTY || 0,
      scannedQty: row.SHIPPED_QTY || 0,
      boxList: [],
    }));

    return success({
      shipNo: header.SHIP_NO,
      customer: header.CUSTOMER || '',
      orderDate: header.ORDER_DATE || '',
      items,
    });
  } catch (err) {
    console.error('출하주문 조회 오류:', err);
    return serverError('출하주문 조회 중 오류가 발생했습니다.');
  }
}

/**
 * POST /api/shipment/order
 * 출하주문 기준 출하처리
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { saupj, shipNo, items, userId } = body;

    if (!shipNo) {
      return error('출하번호는 필수입니다.');
    }

    if (!items || items.length === 0) {
      return error('출하할 항목이 없습니다.');
    }

    const wkDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const queries = [];
    let totalQty = 0;

    for (const item of items) {
      // 품목별 BOX 리스트 처리
      for (const boxNo of item.boxList || []) {
        queries.push({
          sql: `
            INSERT INTO PMB900 (
              SNO, SAUPJ, WKDATE, CHASU, BOXNO, ITEMCODE,
              WHSCODE, CUSTCODE, DESTCODE, OUTTYPE, GQTY,
              SHIP_NO, MAKER, MAKEDATE
            ) VALUES (
              UF_PMB900_SNO(:wkDate),
              :saupj, :wkDate, 1, :boxNo, :itemCode,
              'Z01', '', 'OUT', 'S', 1,
              :shipNo, :userId, SYSDATE
            )
          `,
          params: {
            wkDate,
            saupj: saupj || '10',
            boxNo,
            itemCode: item.itemCode,
            shipNo,
            userId: userId || 'SYSTEM',
          },
        });
        totalQty++;
      }

      // SHP110 출하수량 업데이트
      if (item.boxList && item.boxList.length > 0) {
        queries.push({
          sql: `
            UPDATE SHP110
            SET SHIPPED_QTY = NVL(SHIPPED_QTY, 0) + :qty,
                UPD_USER = :userId,
                UPD_DATE = SYSDATE
            WHERE SHIP_NO = :shipNo
              AND ITEM_CODE = :itemCode
          `,
          params: {
            qty: item.boxList.length,
            shipNo,
            itemCode: item.itemCode,
            userId: userId || 'SYSTEM',
          },
        });
      }
    }

    if (queries.length === 0) {
      return error('저장할 데이터가 없습니다.');
    }

    const result = await oracle.executeTransaction(queries);

    if (!result.success) {
      return serverError(result.error || '출하처리 저장 실패');
    }

    return success({ count: totalQty }, `${totalQty}건 출하 처리되었습니다.`);
  } catch (err) {
    console.error('출하주문 저장 오류:', err);
    return serverError('출하처리 저장 중 오류가 발생했습니다.');
  }
}
