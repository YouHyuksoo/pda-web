/**
 * @file src/app/api/common/processes/route.ts
 * @description
 * 공정 목록 조회 API 엔드포인트입니다.
 *
 * @example
 * GET /api/common/processes
 * GET /api/common/processes?saupj=10
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, serverError } from '@/lib/api/response';


/** 동적 라우트 설정 - 빌드 시 정적 생성 방지 */
export const dynamic = 'force-dynamic';
/**
 * 공정 정보 인터페이스
 */
interface Process {
  OP_CODE: string;
  OP_NAME: string;
  OP_TYPE: string;
  SAUPJ: string;
}

/**
 * GET /api/common/processes
 * 공정 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const saupj = searchParams.get('saupj') || '';

    // 공정 목록 조회
    // TODO: 실제 테이블명과 컬럼명은 DB 스키마에 맞게 수정 필요
    let sql = `
      SELECT
        OP_CODE,
        OP_NAME,
        OP_TYPE,
        SAUPJ
      FROM TB_PROCESS
      WHERE USE_YN = 'Y'
    `;

    const params: Record<string, string> = {};

    if (saupj) {
      sql += ' AND SAUPJ = :saupj';
      params.saupj = saupj;
    }

    sql += ' ORDER BY OP_CODE';

    const result = await oracle.query<Process>(sql, params);

    if (!result.success) {
      return serverError(result.error || 'DB 조회 실패');
    }

    const processes = (result.data || []).map(proc => ({
      code: proc.OP_CODE,
      name: proc.OP_NAME,
      type: proc.OP_TYPE,
      saupj: proc.SAUPJ,
    }));

    return success(processes);
  } catch (err) {
    console.error('공정 목록 조회 API 오류:', err);
    return serverError('공정 목록 조회 중 오류가 발생했습니다.');
  }
}
