/**
 * @file src/app/api/repack/ckd-change/route.ts
 * @description
 * CKD 품번변경 API 엔드포인트입니다.
 * BOX의 품번을 변경 처리합니다.
 *
 * @example
 * GET /api/repack/ckd-change?boxNo=BOX001 (BOX 정보 조회)
 * GET /api/repack/ckd-change?itemCode=CKD001 (품목 검색)
 * POST /api/repack/ckd-change (품번 변경 처리)
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';


/** 동적 라우트 설정 - 빌드 시 정적 생성 방지 */
export const dynamic = 'force-dynamic';
/**
 * GET /api/repack/ckd-change
 * BOX 정보 또는 품목 정보 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const boxNo = searchParams.get('boxNo');
    const itemCode = searchParams.get('itemCode');
    const searchType = searchParams.get('type');

    if (searchType === 'item' || itemCode) {
      // 품목 검색
      const sql = `
        SELECT
          ITEM_CODE,
          ITEM_NAME
        FROM BOM_MASTER
        WHERE (ITEM_CODE LIKE '%' || :keyword || '%'
               OR ITEM_NAME LIKE '%' || :keyword || '%')
          AND ITEM_TYPE = 'CKD'
        ORDER BY ITEM_CODE
        FETCH FIRST 20 ROWS ONLY
      `;

      const result = await oracle.query(sql, { keyword: itemCode || '' });

      const items = (result.data || []).map((row: Record<string, unknown>) => ({
        itemCode: row.ITEM_CODE || '',
        itemName: row.ITEM_NAME || '',
      }));

      return success(items);
    }

    // BOX 정보 조회
    if (!boxNo) {
      return error('BOX 번호를 입력해주세요.');
    }

    const sql = `
      SELECT
        A.BOXNO AS BOX_NO,
        A.ITEMCODE AS ITEM_CODE,
        B.ITEM_NAME,
        A.PQTY AS QTY,
        A.WHSCODE AS WHS_CODE
      FROM PMS100 A
      LEFT JOIN BOM_MASTER B ON A.ITEMCODE = B.ITEM_CODE
      WHERE A.BOXNO = :boxNo
        AND A.PQTY > 0
    `;

    const result = await oracle.query(sql, { boxNo });

    if (!result.success || !result.data || result.data.length === 0) {
      return error('해당 BOX를 찾을 수 없거나 재고가 없습니다.');
    }

    const row = result.data[0] as Record<string, unknown>;

    return success({
      boxNo: row.BOX_NO,
      itemCode: row.ITEM_CODE || '',
      itemName: row.ITEM_NAME || '',
      qty: row.QTY || 0,
      whsCode: row.WHS_CODE || '',
    });
  } catch (err) {
    console.error('CKD 품번변경 조회 오류:', err);
    return serverError('조회 중 오류가 발생했습니다.');
  }
}

/**
 * POST /api/repack/ckd-change
 * 품번 변경 처리
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { saupj, changeList, userId } = body;

    if (!changeList || changeList.length === 0) {
      return error('변경할 항목이 없습니다.');
    }

    const queries = [];
    const wkDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    for (const item of changeList) {
      // BOX 품번 변경
      queries.push({
        sql: `
          UPDATE PMS100
          SET ITEMCODE = :newItemCode,
              EDITOR = :userId,
              EDITDATE = SYSDATE
          WHERE BOXNO = :boxNo
            AND ITEMCODE = :oldItemCode
        `,
        params: {
          boxNo: item.boxNo,
          oldItemCode: item.oldItemCode,
          newItemCode: item.newItemCode,
          userId: userId || 'SYSTEM',
        },
      });

      // 품번 변경 이력 저장
      queries.push({
        sql: `
          INSERT INTO PMB610 (
            SNO, SAUPJ, CHANGE_DATE, BOXNO,
            OLD_ITEMCODE, NEW_ITEMCODE, QTY,
            MAKER, MAKEDATE
          ) VALUES (
            UF_PMB610_SNO(:wkDate),
            :saupj, :wkDate, :boxNo,
            :oldItemCode, :newItemCode, :qty,
            :userId, SYSDATE
          )
        `,
        params: {
          wkDate,
          saupj: saupj || '10',
          boxNo: item.boxNo,
          oldItemCode: item.oldItemCode,
          newItemCode: item.newItemCode,
          qty: item.qty,
          userId: userId || 'SYSTEM',
        },
      });
    }

    const result = await oracle.executeTransaction(queries);

    if (!result.success) {
      return serverError(result.error || '품번 변경 실패');
    }

    return success(
      { count: changeList.length },
      `${changeList.length}건 품번 변경 처리되었습니다.`
    );
  } catch (err) {
    console.error('CKD 품번변경 처리 오류:', err);
    return serverError('품번 변경 처리 중 오류가 발생했습니다.');
  }
}
