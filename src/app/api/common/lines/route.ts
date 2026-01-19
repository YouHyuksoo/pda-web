/**
 * @file src/app/api/common/lines/route.ts
 * @description
 * 라인 목록 조회 API 엔드포인트입니다.
 *
 * @example
 * GET /api/common/lines
 * GET /api/common/lines?saupj=10&opCode=OP01
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, serverError } from '@/lib/api/response';

/**
 * 라인 정보 인터페이스
 */
interface Line {
  LINE_CODE: string;
  LINE_NAME: string;
  OP_CODE: string;
  SAUPJ: string;
}

/**
 * GET /api/common/lines
 * 라인 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const saupj = searchParams.get('saupj') || '';
    const opCode = searchParams.get('opCode') || '';

    // 라인 목록 조회
    // TODO: 실제 테이블명과 컬럼명은 DB 스키마에 맞게 수정 필요
    let sql = `
      SELECT
        LINE_CODE,
        LINE_NAME,
        OP_CODE,
        SAUPJ
      FROM TB_LINE
      WHERE USE_YN = 'Y'
    `;

    const params: Record<string, string> = {};

    if (saupj) {
      sql += ' AND SAUPJ = :saupj';
      params.saupj = saupj;
    }

    if (opCode) {
      sql += ' AND OP_CODE = :opCode';
      params.opCode = opCode;
    }

    sql += ' ORDER BY LINE_CODE';

    const result = await oracle.query<Line>(sql, params);

    if (!result.success) {
      return serverError(result.error || 'DB 조회 실패');
    }

    const lines = (result.data || []).map(line => ({
      code: line.LINE_CODE,
      name: line.LINE_NAME,
      opCode: line.OP_CODE,
      saupj: line.SAUPJ,
    }));

    return success(lines);
  } catch (err) {
    console.error('라인 목록 조회 API 오류:', err);
    return serverError('라인 목록 조회 중 오류가 발생했습니다.');
  }
}
