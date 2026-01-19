/**
 * @file src/app/api/return/route.ts
 * @description
 * 반품입고 API 엔드포인트입니다.
 * C# HS500[반품입고].cs의 로직을 구현합니다.
 *
 * 주요 테이블:
 * - PMB500: 반품입고 이력
 * - PMS100: 재고
 * - PMB300: 재고이동 (불량인 경우)
 *
 * @example
 * GET /api/return/item?itemCode=ITEM001 (품번 검색)
 * POST /api/return (반품입고 저장)
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';

/**
 * GET /api/return
 * 반품 대상 BOX 정보 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const boxNo = searchParams.get('boxNo');

    if (!boxNo) {
      return error('BOX 번호를 입력해주세요.');
    }

    // 출하된 BOX 정보 조회
    const sql = `
      SELECT
        A.BOXNO AS BOX_NO,
        A.ITEMCODE AS ITEM_CODE,
        B.ITEM_NAME,
        A.GQTY AS QTY,
        A.CUSTCODE AS CUST_CODE,
        C.CUSTNAME AS CUSTOMER
      FROM PMB900 A
      LEFT JOIN BOM_MASTER B ON A.ITEMCODE = B.ITEM_CODE
      LEFT JOIN CMA100 C ON A.CUSTCODE = C.CUSTCODE
      WHERE A.BOXNO = :boxNo
        AND A.DELGUBUN IS NULL
      ORDER BY A.WKDATE DESC
      FETCH FIRST 1 ROWS ONLY
    `;

    const result = await oracle.query(sql, { boxNo });

    if (!result.success || !result.data || result.data.length === 0) {
      return error('해당 BOX의 출하 정보를 찾을 수 없습니다.');
    }

    const row = result.data[0] as Record<string, unknown>;

    return success({
      boxNo: row.BOX_NO,
      itemCode: row.ITEM_CODE || '',
      itemName: row.ITEM_NAME || '',
      qty: row.QTY || 0,
      custCode: row.CUST_CODE || '',
      customer: row.CUSTOMER || '',
    });
  } catch (err) {
    console.error('반품 BOX 조회 오류:', err);
    return serverError('BOX 조회 중 오류가 발생했습니다.');
  }
}

/**
 * 반품입고 저장 요청 인터페이스
 */
interface ReturnRequest {
  saupj: string;
  returnDate: string;
  returnWhsCode: string; // 반품입고 창고
  defectWhsCode?: string; // 불량반품입고 창고 (불량인 경우만)
  destCode: string; // 출고처
  custCode: string; // 업체
  items: {
    boxNo: string;
    itemCode: string;
    qty: number;
    gubun: 'Y' | 'N'; // Y: 양품, N: 불량
  }[];
  userId: string;
}

/**
 * POST /api/return
 * 반품입고 저장
 */
export async function POST(request: NextRequest) {
  try {
    const body: ReturnRequest = await request.json();
    const { saupj, returnDate, returnWhsCode, defectWhsCode, destCode, items, userId } = body;

    // 입력 검증
    if (!returnWhsCode) {
      return error('입고창고를 선택해주십시오');
    }
    if (!destCode) {
      return error('출고처를 선택해주십시오');
    }
    if (!items || items.length === 0) {
      return error('저장할 품목이 없습니다.');
    }

    const wkDate = returnDate.replace(/-/g, '');
    const queries = [];

    for (const item of items) {
      // 1. PMB500 (반품입고 이력) INSERT
      queries.push({
        sql: `
          INSERT INTO PMB500 (
            SNO, SAUPJ, WKDATE, WHSCODE, IOTYPE, BOXNO, ITEMCODE,
            GUBUN, PQTY, DESTCODE, F_ITEMCODE, F_WHSCODE,
            MAKER, MAKEDATE
          ) VALUES (
            UF_PMB500_SNO(TO_CHAR(SYSDATE, 'YYYY-MM-DD')),
            :saupj, TO_CHAR(SYSDATE, 'YYYY-MM-DD'), :whsCode, 'O05', :boxNo, :itemCode,
            :gubun, :pqty, :destCode, :itemCode, :fWhsCode,
            :userId, SYSDATE
          )
        `,
        params: {
          saupj: saupj || '10',
          whsCode: returnWhsCode,
          boxNo: item.boxNo,
          itemCode: item.itemCode,
          gubun: item.gubun,
          pqty: item.qty,
          destCode,
          fWhsCode: destCode,
          userId: userId || 'SYSTEM'
        }
      });

      // 2. PMS100 (재고) MERGE - 양품/불량 모두 해당
      if (item.gubun === 'N') {
        // 불량인 경우: PQTY, DQTY 모두 증가
        queries.push({
          sql: `
            MERGE INTO PMS100 A
            USING (SELECT :boxNo AS BOXNO, :itemCode AS ITEMCODE, :whsCode AS WHSCODE FROM DUAL) B
            ON (A.BOXNO = B.BOXNO AND A.ITEMCODE = B.ITEMCODE AND A.WHSCODE = B.WHSCODE AND A.SAUPJ = :saupj)
            WHEN MATCHED THEN
              UPDATE SET PQTY = NVL(PQTY, 0) + :qty, DQTY = NVL(DQTY, 0) + :qty, EDITOR = :userId, EDITDATE = SYSDATE
            WHEN NOT MATCHED THEN
              INSERT (SAUPJ, WHSCODE, BOXNO, ITEMCODE, BOXTYPE, PARTNO, GUBUN, PQTY, DQTY, MAKER, MAKEDATE)
              VALUES (:saupj, :whsCode, :boxNo, :itemCode,
                      UF_PMA900_BTYPE(:boxNo), UF_BMF400_PINBR(:itemCode), :gubun, :qty, :qty, :userId, SYSDATE)
          `,
          params: {
            boxNo: item.boxNo,
            itemCode: item.itemCode,
            whsCode: returnWhsCode,
            saupj: saupj || '10',
            qty: item.qty,
            gubun: item.gubun,
            userId: userId || 'SYSTEM'
          }
        });
      } else {
        // 양품인 경우: PQTY만 증가
        queries.push({
          sql: `
            MERGE INTO PMS100 A
            USING (SELECT :boxNo AS BOXNO, :itemCode AS ITEMCODE, :whsCode AS WHSCODE FROM DUAL) B
            ON (A.BOXNO = B.BOXNO AND A.ITEMCODE = B.ITEMCODE AND A.WHSCODE = B.WHSCODE AND A.SAUPJ = :saupj)
            WHEN MATCHED THEN
              UPDATE SET PQTY = NVL(PQTY, 0) + :qty, EDITOR = :userId, EDITDATE = SYSDATE
            WHEN NOT MATCHED THEN
              INSERT (SAUPJ, WHSCODE, BOXNO, ITEMCODE, BOXTYPE, PARTNO, GUBUN, PQTY, DQTY, MAKER, MAKEDATE)
              VALUES (:saupj, :whsCode, :boxNo, :itemCode,
                      UF_PMA900_BTYPE(:boxNo), UF_BMF400_PINBR(:itemCode), :gubun, :qty, 0, :userId, SYSDATE)
          `,
          params: {
            boxNo: item.boxNo,
            itemCode: item.itemCode,
            whsCode: returnWhsCode,
            saupj: saupj || '10',
            qty: item.qty,
            gubun: item.gubun,
            userId: userId || 'SYSTEM'
          }
        });
      }

      // 3. 불량인 경우 추가 처리: 완제품창고 -> 불량창고 재고이동
      if (item.gubun === 'N' && defectWhsCode) {
        // 3-1. PMB300 (재고이동 이력) INSERT
        queries.push({
          sql: `
            INSERT INTO PMB300 (
              SNO, SAUPJ, WKDATE, WHSCODE, BOXNO, ITEMCODE,
              F_WHSCODE, GUBUN, PQTY, MAKER, MAKEDATE
            ) VALUES (
              UF_PMB300_SNO(:wkDate),
              :saupj, :wkDate, :toWhsCode, :boxNo, :itemCode,
              :fromWhsCode, :gubun, :pqty, :userId, SYSDATE
            )
          `,
          params: {
            wkDate,
            saupj: saupj || '10',
            toWhsCode: defectWhsCode,
            boxNo: item.boxNo,
            itemCode: item.itemCode,
            fromWhsCode: returnWhsCode,
            gubun: item.gubun,
            pqty: item.qty,
            userId: userId || 'SYSTEM'
          }
        });

        // 3-2. 불량창고 재고 증가
        queries.push({
          sql: `
            MERGE INTO PMS100 A
            USING (SELECT :boxNo AS BOXNO, :itemCode AS ITEMCODE, :whsCode AS WHSCODE FROM DUAL) B
            ON (A.BOXNO = B.BOXNO AND A.ITEMCODE = B.ITEMCODE AND A.WHSCODE = B.WHSCODE AND A.SAUPJ = :saupj)
            WHEN MATCHED THEN
              UPDATE SET PQTY = NVL(PQTY, 0) + :qty, DQTY = NVL(DQTY, 0) + :qty, EDITOR = :userId, EDITDATE = SYSDATE
            WHEN NOT MATCHED THEN
              INSERT (SAUPJ, WHSCODE, BOXNO, ITEMCODE, BOXTYPE, PARTNO, GUBUN, PQTY, DQTY, MAKER, MAKEDATE)
              VALUES (:saupj, :whsCode, :boxNo, :itemCode,
                      UF_PMA900_BTYPE(:boxNo), UF_BMF400_PINBR(:itemCode), :gubun, :qty, :qty, :userId, SYSDATE)
          `,
          params: {
            boxNo: item.boxNo,
            itemCode: item.itemCode,
            whsCode: defectWhsCode,
            saupj: saupj || '10',
            qty: item.qty,
            gubun: item.gubun,
            userId: userId || 'SYSTEM'
          }
        });

        // 3-3. 완제품창고 재고 차감
        queries.push({
          sql: `
            UPDATE PMS100
            SET PQTY = NVL(PQTY, 0) - :qty,
                DQTY = NVL(DQTY, 0) - :qty,
                EDITOR = :userId,
                EDITDATE = SYSDATE
            WHERE SAUPJ = :saupj
              AND WHSCODE = :whsCode
              AND BOXNO = :boxNo
              AND ITEMCODE = :itemCode
          `,
          params: {
            qty: item.qty,
            userId: userId || 'SYSTEM',
            saupj: saupj || '10',
            whsCode: returnWhsCode,
            boxNo: item.boxNo,
            itemCode: item.itemCode
          }
        });
      }
    }

    const result = await oracle.executeTransaction(queries);

    if (!result.success) {
      return serverError(result.error || '반품입고 오류');
    }

    return success({ count: items.length }, '저장되었습니다');
  } catch (err) {
    console.error('반품입고 저장 API 오류:', err);
    return serverError('반품입고 저장 중 오류가 발생했습니다.');
  }
}
