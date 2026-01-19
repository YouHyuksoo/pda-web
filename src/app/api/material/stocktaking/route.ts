/**
 * @file src/app/api/material/stocktaking/route.ts
 * @description
 * 재고실사 API 엔드포인트입니다.
 * 실사 결과를 저장하고 재고를 조정합니다.
 *
 * @example
 * GET /api/material/stocktaking?boxNo=BOX001&whsCode=WH01
 * POST /api/material/stocktaking
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';


/** 동적 라우트 설정 - 빌드 시 정적 생성 방지 */
export const dynamic = 'force-dynamic';
/**
 * GET /api/material/stocktaking
 * 바코드로 시스템 재고 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const boxNo = searchParams.get('boxNo');
    const whsCode = searchParams.get('whsCode');

    if (!boxNo) {
      return error('바코드는 필수입니다.');
    }

    let sql = `
      SELECT
        A.BOX_NO,
        A.ITEM_CODE,
        B.ITEM_NAME,
        A.QTY AS SYSTEM_QTY,
        A.WHS_CODE,
        A.LOT_NO
      FROM PMS100 A
      LEFT JOIN BOM_MASTER B ON A.ITEM_CODE = B.ITEM_CODE
      WHERE A.BOX_NO = :boxNo
    `;

    const params: Record<string, string> = { boxNo };

    if (whsCode) {
      sql += ' AND A.WHS_CODE = :whsCode';
      params.whsCode = whsCode;
    }

    const result = await oracle.query(sql, params);

    if (!result.success) {
      return serverError(result.error || 'DB 조회 실패');
    }

    if (!result.data || result.data.length === 0) {
      // 시스템 재고 없음 - 신규 재고로 처리할 수 있도록
      return success({
        boxNo: boxNo,
        itemCode: '',
        itemName: '',
        systemQty: 0,
        whsCode: whsCode || '',
        lotNo: '',
        isNew: true,
      });
    }

    const stock = result.data[0] as Record<string, unknown>;

    return success({
      boxNo: stock.BOX_NO,
      itemCode: stock.ITEM_CODE,
      itemName: stock.ITEM_NAME || '',
      systemQty: stock.SYSTEM_QTY || 0,
      whsCode: stock.WHS_CODE,
      lotNo: stock.LOT_NO || '',
      isNew: false,
    });
  } catch (err) {
    console.error('재고 조회 오류:', err);
    return serverError('재고 조회 중 오류가 발생했습니다.');
  }
}

/**
 * POST /api/material/stocktaking
 * 재고실사 저장
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { saupj, whsCode, items, userId } = body;

    if (!whsCode) {
      return error('창고 코드는 필수입니다.');
    }

    if (!items || items.length === 0) {
      return error('실사할 항목이 없습니다.');
    }

    const wkDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    let successCount = 0;

    for (const item of items) {
      try {
        const diff = item.actualQty - item.systemQty;

        // 재고 조정 (실사 수량으로 업데이트)
        const stockResult = await oracle.execute(
          `MERGE INTO PMS100 A
           USING (SELECT :boxNo AS BOX_NO, :whsCode AS WHS_CODE FROM DUAL) B
           ON (A.BOX_NO = B.BOX_NO AND A.WHS_CODE = B.WHS_CODE)
           WHEN MATCHED THEN
             UPDATE SET A.QTY = :actualQty,
                        A.UPD_USER = :userId,
                        A.UPD_DATE = SYSDATE
           WHEN NOT MATCHED THEN
             INSERT (SAUPJ, BOX_NO, ITEM_CODE, WHS_CODE, QTY, REG_USER, REG_DATE)
             VALUES (:saupj, :boxNo, :itemCode, :whsCode, :actualQty, :userId, SYSDATE)`,
          {
            saupj: saupj || '10',
            boxNo: item.boxNo,
            itemCode: item.itemCode,
            whsCode: whsCode,
            actualQty: item.actualQty,
            userId: userId || 'SYSTEM',
          }
        );

        if (stockResult.success) {
          // 실사 이력 기록
          await oracle.execute(
            `INSERT INTO PMB340 (
              SAUPJ, CHECK_DATE, BOX_NO, ITEM_CODE,
              WHS_CODE, SYSTEM_QTY, ACTUAL_QTY, DIFF_QTY,
              REG_USER, REG_DATE
            ) VALUES (
              :saupj, :checkDate, :boxNo, :itemCode,
              :whsCode, :systemQty, :actualQty, :diff,
              :userId, SYSDATE
            )`,
            {
              saupj: saupj || '10',
              checkDate: wkDate,
              boxNo: item.boxNo,
              itemCode: item.itemCode,
              whsCode: whsCode,
              systemQty: item.systemQty,
              actualQty: item.actualQty,
              diff: diff,
              userId: userId || 'SYSTEM',
            }
          );
          successCount++;
        }
      } catch (itemErr) {
        console.error('실사 항목 처리 오류:', itemErr);
      }
    }

    if (successCount === 0) {
      return error('저장된 항목이 없습니다.');
    }

    return success(
      { count: successCount },
      `${successCount}건 실사 처리되었습니다.`
    );
  } catch (err) {
    console.error('재고실사 API 오류:', err);
    return serverError('재고실사 처리 중 오류가 발생했습니다.');
  }
}
