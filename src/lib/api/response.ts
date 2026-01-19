/**
 * @file src/lib/api/response.ts
 * @description
 * API 응답 유틸리티 함수입니다.
 * 일관된 API 응답 형식을 제공합니다.
 *
 * 초보자 가이드:
 * 1. **success()**: 성공 응답 반환
 * 2. **error()**: 에러 응답 반환
 * 3. **ApiResponse**: 표준 응답 타입
 */

import { NextResponse } from 'next/server';

/**
 * API 응답 인터페이스
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

/**
 * 성공 응답 생성
 * @param data 응답 데이터
 * @param message 성공 메시지
 */
export function success<T>(data?: T, message?: string): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    message,
  });
}

/**
 * 에러 응답 생성
 * @param error 에러 메시지
 * @param status HTTP 상태 코드 (기본값: 400)
 */
export function error(error: string, status = 400): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status }
  );
}

/**
 * 서버 에러 응답 생성
 * @param error 에러 메시지
 */
export function serverError(error: string): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status: 500 }
  );
}

/**
 * 인증 에러 응답 생성
 * @param error 에러 메시지
 */
export function unauthorized(error = '인증이 필요합니다'): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status: 401 }
  );
}
