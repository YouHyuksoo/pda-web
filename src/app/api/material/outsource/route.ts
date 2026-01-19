/**
 * @file src/app/api/material/outsource/route.ts
 * @description
 * 외주출고 API 엔드포인트입니다.
 * 외주업체로 자재를 출고 처리합니다.
 *
 * @example
 * POST /api/material/outsource
 * GET /api/material/outsource/vendors - 외주업체 목록
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';


/** 동적 라우트 설정 - 빌드 시 정적 생성 방지 */
export const dynamic = 'force-dynamic';
/**
 * POST /api/material/outsource
 * 외주출고 저장
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { saupj, whsCode, vendorCode, items, userId } = body;

    if (!whsCode) {
      return error('창고 코드는 필수입니다.');
    }

    if (!vendorCode) {
      return error('외주업체 코드는 필수입니다.');
    }

    if (!items || items.length === 0) {
      return error('출고할 항목이 없습니다.');
    }

    const wkDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    let successCount = 0;

    for (const item of items) {
      try {
        // 재고 차감
        const stockResult = await oracle.execute(
          `UPDATE PMS100
           SET QTY = QTY - :qty,
               UPD_USER = :userId,
               UPD_DATE = SYSDATE
           WHERE BOX_NO = :boxNo
             AND WHS_CODE = :whsCode
             AND QTY >= :qty`,
          {
            boxNo: item.boxNo,
            whsCode: whsCode,
            qty: item.qty,
            userId: userId || 'SYSTEM',
          }
        );

        if (stockResult.success && (stockResult.rowsAffected || 0) > 0) {
          // 외주출고 이력 기록
          await oracle.execute(
            `INSERT INTO PMB330 (
              SAUPJ, OUT_DATE, BOX_NO, ITEM_CODE,
              WHS_CODE, VENDOR_CODE, QTY,
              REG_USER, REG_DATE
            ) VALUES (
              :saupj, :outDate, :boxNo, :itemCode,
              :whsCode, :vendorCode, :qty,
              :userId, SYSDATE
            )`,
            {
              saupj: saupj || '10',
              outDate: wkDate,
              boxNo: item.boxNo,
              itemCode: item.itemCode,
              whsCode: whsCode,
              vendorCode: vendorCode,
              qty: item.qty,
              userId: userId || 'SYSTEM',
            }
          );
          successCount++;
        }
      } catch (itemErr) {
        console.error('외주출고 항목 처리 오류:', itemErr);
      }
    }

    if (successCount === 0) {
      return error('출고된 항목이 없습니다. 재고가 부족할 수 있습니다.');
    }

    return success(
      { count: successCount },
      `${successCount}건 외주출고 처리되었습니다.`
    );
  } catch (err) {
    console.error('외주출고 API 오류:', err);
    return serverError('외주출고 처리 중 오류가 발생했습니다.');
  }
}

/**
 * GET /api/material/outsource
 * 외주업체 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword') || '';

    const sql = `
      SELECT
        VENDOR_CODE,
        VENDOR_NAME,
        TEL_NO,
        ADDR
      FROM VENDOR_MASTER
      WHERE USE_YN = 'Y'
        AND VENDOR_TYPE = 'O'
        AND (VENDOR_CODE LIKE :keyword OR VENDOR_NAME LIKE :keyword)
      ORDER BY VENDOR_NAME
    `;

    const result = await oracle.query(sql, {
      keyword: `%${keyword}%`,
    });

    if (!result.success) {
      return serverError(result.error || 'DB 조회 실패');
    }

    const vendors = (result.data || []).map((row: Record<string, unknown>) => ({
      vendorCode: row.VENDOR_CODE,
      vendorName: row.VENDOR_NAME,
      telNo: row.TEL_NO || '',
      addr: row.ADDR || '',
    }));

    return success(vendors);
  } catch (err) {
    console.error('외주업체 조회 오류:', err);
    return serverError('외주업체 조회 중 오류가 발생했습니다.');
  }
}
