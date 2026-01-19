/**
 * @file src/hooks/use-session.ts
 * @description
 * 세션 관리 훅입니다.
 * 세션 만료 체크, 자동 로그아웃, 활동 감지 기능을 제공합니다.
 *
 * 초보자 가이드:
 * 1. **useSession**: 세션 상태 관리 및 자동 로그아웃
 *    - 30초마다 세션 만료 체크
 *    - 사용자 활동(클릭, 키입력 등) 시 세션 갱신
 *    - 세션 만료 시 로그인 페이지로 이동
 *
 * @example
 * // 레이아웃에서 사용
 * const { isExpired, remainingTime } = useSession();
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';

/** 세션 체크 간격 (30초) */
const SESSION_CHECK_INTERVAL = 30 * 1000;

/** 활동 감지 디바운스 시간 (1초) */
const ACTIVITY_DEBOUNCE = 1000;

/** 세션 만료 경고 시간 (만료 10분 전) */
const WARNING_BEFORE_EXPIRY = 10 * 60 * 1000;

/**
 * 세션 관리 훅 반환 타입
 */
interface UseSessionReturn {
  /** 세션 만료 여부 */
  isExpired: boolean;
  /** 남은 시간 (밀리초) */
  remainingTime: number;
  /** 만료 임박 경고 여부 */
  isWarning: boolean;
  /** 세션 수동 갱신 */
  refreshSession: () => void;
}

/**
 * 세션 관리 훅
 * 세션 만료 체크 및 자동 로그아웃 처리
 */
export function useSession(): UseSessionReturn {
  const router = useRouter();
  const {
    userId,
    loginAt,
    lastActivityAt,
    isSessionExpired,
    updateActivity,
    logout,
  } = useAuthStore();

  const [isExpired, setIsExpired] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);
  const [isWarning, setIsWarning] = useState(false);

  // 디바운스용 타이머 ref
  const activityTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 세션 만료 시간 (8시간)
  const SESSION_TIMEOUT = 8 * 60 * 60 * 1000;

  /**
   * 남은 세션 시간 계산
   */
  const calculateRemainingTime = useCallback(() => {
    if (!loginAt || !lastActivityAt) return 0;

    const now = Date.now();
    // 마지막 활동 기준으로 남은 시간 계산
    const expiryTime = lastActivityAt + SESSION_TIMEOUT;
    return Math.max(0, expiryTime - now);
  }, [loginAt, lastActivityAt, SESSION_TIMEOUT]);

  /**
   * 세션 수동 갱신
   */
  const refreshSession = useCallback(() => {
    if (userId) {
      updateActivity();
      setIsExpired(false);
      setIsWarning(false);
    }
  }, [userId, updateActivity]);

  /**
   * 사용자 활동 감지 핸들러 (디바운스 적용)
   */
  const handleActivity = useCallback(() => {
    if (!userId) return;

    // 디바운스: 이전 타이머 취소
    if (activityTimerRef.current) {
      clearTimeout(activityTimerRef.current);
    }

    // 새 타이머 설정
    activityTimerRef.current = setTimeout(() => {
      updateActivity();
    }, ACTIVITY_DEBOUNCE);
  }, [userId, updateActivity]);

  /**
   * 세션 만료 시 처리
   */
  const handleSessionExpired = useCallback(() => {
    logout();
    setIsExpired(true);
    // 세션 만료 알림 후 로그인 페이지로 이동
    alert('세션이 만료되었습니다. 다시 로그인해주세요.');
    router.replace('/login');
  }, [logout, router]);

  // 주기적 세션 체크
  useEffect(() => {
    if (!userId) return;

    const checkSessionStatus = () => {
      // 세션 만료 체크
      if (isSessionExpired()) {
        handleSessionExpired();
        return;
      }

      // 남은 시간 계산
      const remaining = calculateRemainingTime();
      setRemainingTime(remaining);

      // 만료 임박 경고 (10분 전)
      if (remaining > 0 && remaining <= WARNING_BEFORE_EXPIRY) {
        setIsWarning(true);
      } else {
        setIsWarning(false);
      }
    };

    // 초기 체크
    checkSessionStatus();

    // 주기적 체크 (30초마다)
    const intervalId = setInterval(checkSessionStatus, SESSION_CHECK_INTERVAL);

    return () => clearInterval(intervalId);
  }, [userId, isSessionExpired, calculateRemainingTime, handleSessionExpired]);

  // 사용자 활동 감지 이벤트 등록
  useEffect(() => {
    if (!userId) return;

    // 활동 감지 이벤트들
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];

    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });

      // 타이머 정리
      if (activityTimerRef.current) {
        clearTimeout(activityTimerRef.current);
      }
    };
  }, [userId, handleActivity]);

  return {
    isExpired,
    remainingTime,
    isWarning,
    refreshSession,
  };
}

/**
 * 남은 시간을 포맷팅하는 유틸리티 함수
 * @param ms 밀리초
 * @returns 포맷된 문자열 (예: "7시간 30분")
 */
export function formatRemainingTime(ms: number): string {
  if (ms <= 0) return '만료됨';

  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));

  if (hours > 0) {
    return `${hours}시간 ${minutes}분`;
  }
  return `${minutes}분`;
}
