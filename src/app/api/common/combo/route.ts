/**
 * @file src/app/api/common/combo/route.ts
 * @description
 * 공통코드 콤보박스 조회 API 엔드포인트입니다.
 * BMA100 테이블에서 MAJORCODE별 코드 목록을 조회합니다.
 *
 * @example
 * GET /api/common/combo?majorCode=B1010 (사업장)
 * GET /api/common/combo?majorCode=B1021 (언어)
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';


/** 동적 라우트 설정 - 빌드 시 정적 생성 방지 */
export const dynamic = 'force-dynamic';
/**
 * 공통코드 인터페이스
 */
interface ComboItem {
  MINORCODE: string;
  CODENAME: string;
}

/**
 * GET /api/common/combo
 * 공통코드 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const majorCode = searchParams.get('majorCode');

    if (!majorCode) {
      return error('majorCode 파라미터가 필요합니다.');
    }

    // BMA100 테이블에서 공통코드 조회
    const sql = `
      SELECT MINORCODE, '[' || MINORCODE || '] ' || CODENAME AS CODENAME
      FROM BMA100
      WHERE MAJORCODE = :majorCode
        AND MINORCODE <> '$'
        AND USEFLAG = '1'
      ORDER BY MINORCODE ASC
    `;

    const result = await oracle.query<ComboItem>(sql, { majorCode });

    if (!result.success) {
      return serverError(result.error || 'DB 조회 실패');
    }

    const items = (result.data || []).map(item => ({
      code: item.MINORCODE,
      name: item.CODENAME,
    }));

    return success(items);
  } catch (err) {
    console.error('공통코드 조회 API 오류:', err);
    return serverError('공통코드 조회 중 오류가 발생했습니다.');
  }
}
