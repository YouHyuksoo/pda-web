/**
 * @file src/app/api/repack/route.ts
 * @description
 * 재포장 API 엔드포인트입니다.
 * BOX 정보 조회 및 재포장 처리를 수행합니다.
 *
 * @example
 * GET /api/repack?boxNo=BOX001 (BOX 정보 조회)
 * POST /api/repack (재포장 처리)
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';

/**
 * GET /api/repack
 * 재포장 원본 BOX 정보 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const boxNo = searchParams.get('boxNo');

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
    console.error('BOX 조회 오류:', err);
    return serverError('BOX 조회 중 오류가 발생했습니다.');
  }
}

/**
 * POST /api/repack
 * 재포장 처리
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { saupj, sourceBox, repackList, userId } = body;

    if (!sourceBox || !sourceBox.boxNo) {
      return error('원본 BOX 정보가 없습니다.');
    }

    if (!repackList || repackList.length === 0) {
      return error('재포장할 항목이 없습니다.');
    }

    const totalRepackQty = repackList.reduce((acc: number, item: { qty: number }) => acc + item.qty, 0);
    if (totalRepackQty > sourceBox.qty) {
      return error('재포장 수량이 원본 수량을 초과합니다.');
    }

    const queries = [];
    const wkDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    // 원본 BOX 재고 차감
    queries.push({
      sql: `
        UPDATE PMS100
        SET PQTY = PQTY - :qty,
            EDITOR = :userId,
            EDITDATE = SYSDATE
        WHERE BOXNO = :boxNo
          AND ITEMCODE = :itemCode
      `,
      params: {
        qty: totalRepackQty,
        boxNo: sourceBox.boxNo,
        itemCode: sourceBox.itemCode,
        userId: userId || 'SYSTEM',
      },
    });

    // 새 BOX 재고 생성
    for (const item of repackList) {
      queries.push({
        sql: `
          INSERT INTO PMS100 (
            SAUPJ, WHSCODE, BOXNO, ITEMCODE, PQTY,
            BOXTYPE, MAKER, MAKEDATE
          ) VALUES (
            :saupj, :whsCode, :newBoxNo, :itemCode, :qty,
            'R', :userId, SYSDATE
          )
        `,
        params: {
          saupj: saupj || '10',
          whsCode: sourceBox.whsCode || 'W01',
          newBoxNo: item.newBoxNo,
          itemCode: sourceBox.itemCode,
          qty: item.qty,
          userId: userId || 'SYSTEM',
        },
      });

      // 재포장 이력 저장
      queries.push({
        sql: `
          INSERT INTO PMB600 (
            SNO, SAUPJ, REPACK_DATE, SOURCE_BOXNO, NEW_BOXNO,
            ITEMCODE, REPACK_QTY, MAKER, MAKEDATE
          ) VALUES (
            UF_PMB600_SNO(:wkDate),
            :saupj, :wkDate, :sourceBoxNo, :newBoxNo,
            :itemCode, :qty, :userId, SYSDATE
          )
        `,
        params: {
          wkDate,
          saupj: saupj || '10',
          sourceBoxNo: sourceBox.boxNo,
          newBoxNo: item.newBoxNo,
          itemCode: sourceBox.itemCode,
          qty: item.qty,
          userId: userId || 'SYSTEM',
        },
      });
    }

    const result = await oracle.executeTransaction(queries);

    if (!result.success) {
      return serverError(result.error || '재포장 처리 실패');
    }

    return success(
      { count: repackList.length },
      `${repackList.length}건 재포장 처리되었습니다.`
    );
  } catch (err) {
    console.error('재포장 처리 오류:', err);
    return serverError('재포장 처리 중 오류가 발생했습니다.');
  }
}
