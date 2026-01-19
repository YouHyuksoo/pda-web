/**
 * @file src/app/layout.tsx
 * @description
 * 루트 레이아웃 컴포넌트입니다.
 * 전역 스타일, 폰트, Toast 알림 등을 설정합니다.
 *
 * 초보자 가이드:
 * 1. Toaster: 전역 Toast 알림 컴포넌트
 * 2. 폰트: Geist Sans/Mono 로컬 폰트 사용
 */

import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "HSGMES PDA",
  description: "행성 MES PDA 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        {/* 전역 Toast 알림 */}
        <Toaster
          position="top-center"
          richColors
          closeButton
          duration={3000}
        />
      </body>
    </html>
  );
}
