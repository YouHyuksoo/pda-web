/**
 * @file src/app/page.tsx
 * @description
 * 루트 페이지입니다.
 * 인증 상태에 따라 대시보드 또는 로그인 페이지로 리다이렉트합니다.
 */

import { redirect } from 'next/navigation';

export default function RootPage() {
  // 루트 접속 시 로그인 페이지로 리다이렉트
  // TODO: 인증 상태 확인 후 대시보드 또는 로그인 페이지로 분기
  redirect('/login');
}
