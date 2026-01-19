/**
 * @file src/app/api/return/cancel/route.ts
 * @description
 * 반품취소 API 엔드포인트입니다.
 * 반품 내역 조회 및 취소 처리를 수행합니다.
 *
 * @example
 * GET /api/return/cancel?whsCode=W01&fromDate=20240115&toDate=20240115
 * DELETE /api/return/cancel (반품 취소)
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';


/** 동적 라우트 설정 - 빌드 시 정적 생성 방지 */
export const dynamic = 'force-dynamic';
/**
 * GET /api/return/cancel
 * 반품 내역 조회 (취소 대상)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const whsCode = searchParams.get('whsCode');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    if (!whsCode) {
      return error('창고를 선택해주세요.');
    }

    if (!fromDate || !toDate) {
      return error('조회 기간을 선택해주세요.');
    }

    const wkFromDate = fromDate.replace(/-/g, '');
    const wkToDate = toDate.replace(/-/g, '');

    // BOX 단위 반품 조회
    const boxSql = `
      SELECT
        A.SNO,
        'BOX' AS TYPE,
        A.SNO AS RETURN_NO,
        A.BOXNO AS BOX_NO,
        A.ITEMCODE AS ITEM_CODE,
        B.ITEM_NAME,
        A.RETURN_QTY AS QTY,
        A.RETURN_DATE,
        A.REASON
      FROM RTN100 A
      LEFT JOIN BOM_MASTER B ON A.ITEMCODE = B.ITEM_CODE
      WHERE A.WHSCODE = :whsCode
        AND A.RETURN_DATE BETWEEN :fromDate AND :toDate
        AND A.DEL_YN IS NULL
    `;

    // 시리얼 단위 반품 조회
    const serialSql = `
      SELECT
        A.SNO,
        'SERIAL' AS TYPE,
        A.SNO AS RETURN_NO,
        A.SERIAL_NO AS BOX_NO,
        A.ITEMCODE AS ITEM_CODE,
        B.ITEM_NAME,
        1 AS QTY,
        A.RETURN_DATE,
        A.REASON
      FROM RTN110 A
      LEFT JOIN BOM_MASTER B ON A.ITEMCODE = B.ITEM_CODE
      WHERE A.WHSCODE = :whsCode
        AND A.RETURN_DATE BETWEEN :fromDate AND :toDate
        AND A.DEL_YN IS NULL
    `;

    const params = { whsCode, fromDate: wkFromDate, toDate: wkToDate };

    const [boxResult, serialResult] = await Promise.all([
      oracle.query(boxSql, params),
      oracle.query(serialSql, params),
    ]);

    const allItems = [
      ...(boxResult.data || []),
      ...(serialResult.data || []),
    ].map((row: Record<string, unknown>, idx: number) => ({
      no: idx + 1,
      sno: row.SNO,
      type: row.TYPE,
      returnNo: row.RETURN_NO,
      boxNo: row.BOX_NO || '',
      itemCode: row.ITEM_CODE || '',
      itemName: row.ITEM_NAME || '',
      qty: row.QTY || 0,
      returnDate: row.RETURN_DATE || '',
      reason: row.REASON || '',
    }));

    return success(allItems);
  } catch (err) {
    console.error('반품 내역 조회 오류:', err);
    return serverError('반품 내역 조회 중 오류가 발생했습니다.');
  }
}

/**
 * DELETE /api/return/cancel
 * 반품 취소
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
      if (item.type === 'BOX') {
        // BOX 반품 취소
        queries.push({
          sql: `
            UPDATE RTN100
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

        // 재고 차감
        queries.push({
          sql: `
            UPDATE PMS100
            SET PQTY = PQTY - :qty,
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
      } else {
        // 시리얼 반품 취소
        queries.push({
          sql: `
            UPDATE RTN110
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

        // 시리얼 상태 복원
        queries.push({
          sql: `
            UPDATE SHP_SERIAL
            SET STATUS = 'SHIPPED',
                RETURN_DATE = NULL,
                RETURN_REASON = NULL,
                RETURN_CONDITION = NULL,
                UPD_USER = :userId,
                UPD_DATE = SYSDATE
            WHERE SERIAL_NO = :serialNo
          `,
          params: {
            serialNo: item.boxNo, // serialNo는 boxNo 필드에 저장됨
            userId: userId || 'SYSTEM',
          },
        });
      }
    }

    const result = await oracle.executeTransaction(queries);

    if (!result.success) {
      return serverError(result.error || '반품 취소 실패');
    }

    return success({ count: items.length }, `${items.length}건 반품 취소되었습니다.`);
  } catch (err) {
    console.error('반품 취소 오류:', err);
    return serverError('반품 취소 중 오류가 발생했습니다.');
  }
}
