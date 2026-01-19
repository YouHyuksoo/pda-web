/**
 * @file src/app/(auth)/layout.tsx
 * @description
 * 인증 관련 페이지의 레이아웃입니다.
 * 로그인 페이지 등 사이드바 없이 표시되는 페이지용입니다.
 */

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
