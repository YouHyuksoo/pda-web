/**
 * @file src/types/auth.ts
 * @description
 * 인증 관련 TypeScript 타입 정의입니다.
 *
 * 초보자 가이드:
 * 1. **LoginRequest**: 로그인 요청 데이터
 * 2. **LoginResponse**: 로그인 응답 데이터
 * 3. **User**: 사용자 정보
 */

/**
 * 로그인 요청 타입
 */
export interface LoginRequest {
  /** 사용자 ID */
  userId: string;
  /** 비밀번호 */
  password: string;
  /** 사업장 코드 */
  saupj: string;
  /** 언어 */
  language?: 'KO' | 'EN' | 'CN';
}

/**
 * 로그인 응답 타입
 */
export interface LoginResponse {
  /** 성공 여부 */
  success: boolean;
  /** 메시지 */
  message: string;
  /** 사용자 정보 (성공 시) */
  user?: User;
}

/**
 * 사용자 정보 타입 (BMA200 테이블 기반)
 */
export interface User {
  /** 사용자 ID */
  userId: string;
  /** 사용자 이름 */
  userName: string;
  /** 사업장 코드 */
  saupj: string;
  /** 공정 코드 */
  opcode: string;
  /** 라인 코드 */
  linecode: string;
  /** 창고 위치 */
  location?: string;
  /** 권한 정보 */
  permissions: UserPermissions;
}

/**
 * 사용자 권한 타입
 */
export interface UserPermissions {
  /** 자재입고 */
  materialReceive: boolean;
  /** 부품불출 */
  partsRelease: boolean;
  /** 원자재불출 */
  rawRelease: boolean;
  /** 이동이력 */
  transferHistory: boolean;
  /** 재고실사 */
  stocktaking: boolean;
  /** 재공 */
  wip: boolean;
  /** 재공불출 */
  wipRelease: boolean;
}

/**
 * 세션 정보 타입
 */
export interface SessionInfo {
  /** 사용자 정보 */
  user: User | null;
  /** 로그인 여부 */
  isAuthenticated: boolean;
  /** 세션 만료 시간 */
  expiresAt?: string;
}
