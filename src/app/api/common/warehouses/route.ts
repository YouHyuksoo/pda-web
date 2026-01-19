/**
 * @file src/app/api/common/warehouses/route.ts
 * @description
 * 창고 목록 조회 API 엔드포인트입니다.
 *
 * @example
 * GET /api/common/warehouses
 * GET /api/common/warehouses?saupj=10
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, serverError } from '@/lib/api/response';

/**
 * 창고 정보 인터페이스
 */
interface Warehouse {
  WH_CODE: string;
  WH_NAME: string;
  WH_TYPE: string;
  SAUPJ: string;
}

/**
 * GET /api/common/warehouses
 * 창고 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const saupj = searchParams.get('saupj') || '';

    // 창고 목록 조회
    // TODO: 실제 테이블명과 컬럼명은 DB 스키마에 맞게 수정 필요
    let sql = `
      SELECT
        WH_CODE,
        WH_NAME,
        WH_TYPE,
        SAUPJ
      FROM TB_WAREHOUSE
      WHERE USE_YN = 'Y'
    `;

    const params: Record<string, string> = {};

    if (saupj) {
      sql += ' AND SAUPJ = :saupj';
      params.saupj = saupj;
    }

    sql += ' ORDER BY WH_CODE';

    const result = await oracle.query<Warehouse>(sql, params);

    if (!result.success) {
      return serverError(result.error || 'DB 조회 실패');
    }

    const warehouses = (result.data || []).map(wh => ({
      code: wh.WH_CODE,
      name: wh.WH_NAME,
      type: wh.WH_TYPE,
      saupj: wh.SAUPJ,
    }));

    return success(warehouses);
  } catch (err) {
    console.error('창고 목록 조회 API 오류:', err);
    return serverError('창고 목록 조회 중 오류가 발생했습니다.');
  }
}
