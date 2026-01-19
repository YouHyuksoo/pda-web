/**
 * @file src/app/api/inventory/move/route.ts
 * @description
 * 재고이동 API 엔드포인트입니다.
 * C# HS200[재고이동].cs의 로직을 구현합니다.
 *
 * 주요 테이블:
 * - PMS100: 재고
 * - PMB100: 생산투입
 * - PMB300: 재고이동
 *
 * @example
 * GET /api/inventory/move/box?boxNo=BOX001&whsCode=W01 (BOX 재고 조회)
 * POST /api/inventory/move (재고이동 저장)
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';

/**
 * 재고이동 저장 요청 인터페이스
 */
interface MoveRequest {
  saupj: string;
  moveDate: string;
  fromWhsCode: string;
  toWhsCode: string;
  items: {
    boxNo: string;
    itemCode: string;
    qty: number;
    fromWhsCode: string;
    toWhsCode: string;
  }[];
  userId: string;
}

/**
 * POST /api/inventory/move
 * 재고이동 저장
 */
export async function POST(request: NextRequest) {
  try {
    const body: MoveRequest = await request.json();
    const { saupj, moveDate, fromWhsCode, toWhsCode, items, userId } = body;

    // 입력 검증
    if (!toWhsCode) {
      return error('받는 창고를 선택해주십시오');
    }
    if (!fromWhsCode) {
      return error('주는 창고를 선택해주십시오');
    }
    if (fromWhsCode === toWhsCode) {
      return error('받는 창고와 주는 창고가 같습니다!');
    }
    if (!items || items.length === 0) {
      return error('저장할 BOX 정보가 없습니다.');
    }

    const wkDate = moveDate.replace(/-/g, '');
    const queries = [];

    for (const item of items) {
      const itemFromWhs = item.fromWhsCode || fromWhsCode;
      const itemToWhs = item.toWhsCode || toWhsCode;

      // 1. FROM 창고의 재고 차감 (PMS100 UPDATE)
      queries.push({
        sql: `
          UPDATE PMS100
          SET PQTY = NVL(PQTY, 0) - :qty,
              EDITOR = :userId,
              EDITDATE = SYSDATE
          WHERE SAUPJ = :saupj
            AND WHSCODE = :fromWhsCode
            AND BOXNO = :boxNo
            AND ITEMCODE = :itemCode
        `,
        params: {
          qty: item.qty,
          userId: userId || 'SYSTEM',
          saupj: saupj || '10',
          fromWhsCode: itemFromWhs,
          boxNo: item.boxNo,
          itemCode: item.itemCode
        }
      });

      // 2. TO 창고에 재고 추가 (MERGE INTO PMS100)
      queries.push({
        sql: `
          MERGE INTO PMS100 A
          USING (SELECT :boxNo AS BOXNO, :itemCode AS ITEMCODE, :toWhsCode AS WHSCODE FROM DUAL) B
          ON (A.BOXNO = B.BOXNO AND A.ITEMCODE = B.ITEMCODE AND A.WHSCODE = B.WHSCODE AND A.SAUPJ = :saupj)
          WHEN MATCHED THEN
            UPDATE SET PQTY = NVL(PQTY, 0) + :qty, EDITOR = :userId, EDITDATE = SYSDATE
          WHEN NOT MATCHED THEN
            INSERT (SAUPJ, WHSCODE, BOXNO, ITEMCODE, BOXTYPE, PARTNO, GUBUN, PQTY, DQTY, MAKER)
            VALUES (:saupj, :toWhsCode, :boxNo, :itemCode,
                    UF_PMA900_BTYPE(:boxNo), UF_BMF400_PINBR(:itemCode), 'Y', :qty, 0, :userId)
        `,
        params: {
          boxNo: item.boxNo,
          itemCode: item.itemCode,
          toWhsCode: itemToWhs,
          saupj: saupj || '10',
          qty: item.qty,
          userId: userId || 'SYSTEM'
        }
      });

      // 3. 재고이동 이력 (PMB300 INSERT)
      queries.push({
        sql: `
          INSERT INTO PMB300 (
            SNO, SAUPJ, WKDATE, WHSCODE, BOXNO, ITEMCODE,
            F_WHSCODE, GUBUN, PQTY, MAKER, MAKEDATE
          ) VALUES (
            UF_PMB300_SNO(:wkDate),
            :saupj, :wkDate, :toWhsCode, :boxNo, :itemCode,
            :fromWhsCode, 'Y', :qty, :userId, SYSDATE
          )
        `,
        params: {
          wkDate,
          saupj: saupj || '10',
          toWhsCode: itemToWhs,
          boxNo: item.boxNo,
          itemCode: item.itemCode,
          fromWhsCode: itemFromWhs,
          qty: item.qty,
          userId: userId || 'SYSTEM'
        }
      });
    }

    const result = await oracle.executeTransaction(queries);

    if (!result.success) {
      return serverError(result.error || '재고이동 오류');
    }

    return success({ count: items.length }, '저장되었습니다');
  } catch (err) {
    console.error('재고이동 저장 API 오류:', err);
    return serverError('재고이동 저장 중 오류가 발생했습니다.');
  }
}
