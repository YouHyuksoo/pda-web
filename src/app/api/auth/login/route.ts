/**
 * @file src/app/api/auth/login/route.ts
 * @description
 * 로그인 API 엔드포인트입니다.
 * C# HS010[로그인].cs의 DoLogin() 로직을 구현합니다.
 * BMA200 테이블에서 사용자 인증을 수행합니다.
 *
 * @example
 * POST /api/auth/login
 * Body: { userId: string, password: string, saupj: string }
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';


/** 동적 라우트 설정 - 빌드 시 정적 생성 방지 */
export const dynamic = 'force-dynamic';
/**
 * 사용자 정보 인터페이스 (BMA200 테이블)
 */
interface UserInfo {
  USER_PW: string;
  USER_NAME: string;
  SAUPJ: string;
  OPCODE: string;
  LINECODE: string;
}

/**
 * POST /api/auth/login
 * 로그인 처리
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, password, saupj } = body;

    // 입력 검증
    if (!userId) {
      return error('계정을 입력하세요.');
    }
    if (!password) {
      return error('비밀번호를 입력하세요.');
    }
    if (!saupj) {
      return error('사업장을 선택하세요.');
    }

    // 사용자 조회 (BMA200 테이블)
    const sql = `
      SELECT USER_PW, USER_NAME, SAUPJ, OPCODE, LINECODE
      FROM BMA200
      WHERE USER_ID = :userId
        AND SAUPJ = :saupj
    `;

    const result = await oracle.query<UserInfo>(sql, {
      userId: userId.toUpperCase(),
      saupj
    });

    if (!result.success) {
      return serverError(result.error || 'DB 조회 실패');
    }

    if (!result.data || result.data.length === 0) {
      return error('사용자정보를 찾을 수 없습니다.', 401);
    }

    const user = result.data[0];

    // 비밀번호 확인 (대문자 변환 후 비교)
    if (user.USER_PW !== password.toUpperCase()) {
      return error('비밀번호를 확인하세요.', 401);
    }

    return success({
      userId: userId.toUpperCase(),
      userName: user.USER_NAME,
      saupj: saupj,
      opCode: user.OPCODE || '',
      lineCode: user.LINECODE || '',
    }, '로그인 되었습니다.');
  } catch (err) {
    console.error('로그인 API 오류:', err);
    return serverError('로그인 처리 중 오류가 발생했습니다.');
  }
}
