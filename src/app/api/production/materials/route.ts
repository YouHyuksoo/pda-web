/**
 * @file src/app/api/production/materials/route.ts
 * @description
 * 투입 자재 조회 API 엔드포인트입니다.
 * 작업지시에 필요한 자재 목록을 조회합니다.
 *
 * @example
 * GET /api/production/materials?workOrder=WO240101001
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';

/**
 * 투입 자재 인터페이스
 */
interface InputMaterial {
  ITEM_CODE: string;
  ITEM_NAME: string;
  REQ_QTY: number;
  INPUT_QTY: number;
  WH_CODE: string;
}

/**
 * GET /api/production/materials
 * 작업지시별 투입 자재 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workOrder = searchParams.get('workOrder');

    if (!workOrder) {
      return error('작업지시번호는 필수입니다.');
    }

    // 투입 자재 조회 쿼리
    // TODO: 실제 테이블/컬럼명에 맞게 수정 필요
    const sql = `
      SELECT
        A.ITEM_CODE,
        B.ITEM_NAME,
        A.REQ_QTY,
        NVL(A.INPUT_QTY, 0) AS INPUT_QTY,
        A.WH_CODE
      FROM SLOT_INPUT A
      LEFT JOIN BOM_MASTER B ON A.ITEM_CODE = B.ITEM_CODE
      WHERE A.WORK_ORDER = :workOrder
      ORDER BY A.SEQ_NO ASC
    `;

    const result = await oracle.query<InputMaterial>(sql, { workOrder });

    if (!result.success) {
      return serverError(result.error || 'DB 조회 실패');
    }

    // 결과 변환
    const materials = (result.data || []).map((item, index) => ({
      no: index + 1,
      itemCode: item.ITEM_CODE,
      itemName: item.ITEM_NAME,
      qty: item.REQ_QTY,
      inputQty: item.INPUT_QTY,
      boxNo: '',
      whCode: item.WH_CODE,
      flag: item.INPUT_QTY > 0 ? 'Y' : 'N',
    }));

    return success(materials);
  } catch (err) {
    console.error('투입 자재 조회 API 오류:', err);
    return serverError('투입 자재 조회 중 오류가 발생했습니다.');
  }
}
