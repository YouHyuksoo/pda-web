/**
 * @file src/lib/utils/toast.ts
 * @description
 * Toast 알림 유틸리티 함수들입니다.
 * sonner 라이브러리를 감싸서 일관된 알림 인터페이스를 제공합니다.
 *
 * 초보자 가이드:
 * 1. **showSuccess**: 성공 메시지 표시 (초록색)
 * 2. **showError**: 에러 메시지 표시 (빨간색)
 * 3. **showWarning**: 경고 메시지 표시 (노란색)
 * 4. **showInfo**: 정보 메시지 표시 (파란색)
 * 5. **showLoading**: 로딩 메시지 표시 (스피너)
 *
 * @example
 * import { showSuccess, showError } from '@/lib/utils/toast';
 *
 * // 성공 메시지
 * showSuccess('저장되었습니다.');
 *
 * // 에러 메시지
 * showError('저장 중 오류가 발생했습니다.');
 *
 * // 로딩 → 완료 패턴
 * const toastId = showLoading('저장 중...');
 * // API 호출 후
 * dismissToast(toastId);
 * showSuccess('저장되었습니다.');
 */

import { toast } from 'sonner';

/** Toast 옵션 타입 */
interface ToastOptions {
  /** 표시 시간 (ms), 기본값 3000 */
  duration?: number;
  /** 설명 텍스트 */
  description?: string;
  /** 액션 버튼 */
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * 성공 메시지 표시
 * @param message 메시지
 * @param options 옵션
 * @returns toast ID
 */
export function showSuccess(message: string, options?: ToastOptions): string | number {
  return toast.success(message, {
    duration: options?.duration ?? 3000,
    description: options?.description,
    action: options?.action,
  });
}

/**
 * 에러 메시지 표시
 * @param message 메시지
 * @param options 옵션
 * @returns toast ID
 */
export function showError(message: string, options?: ToastOptions): string | number {
  return toast.error(message, {
    duration: options?.duration ?? 4000, // 에러는 조금 더 오래 표시
    description: options?.description,
    action: options?.action,
  });
}

/**
 * 경고 메시지 표시
 * @param message 메시지
 * @param options 옵션
 * @returns toast ID
 */
export function showWarning(message: string, options?: ToastOptions): string | number {
  return toast.warning(message, {
    duration: options?.duration ?? 3500,
    description: options?.description,
    action: options?.action,
  });
}

/**
 * 정보 메시지 표시
 * @param message 메시지
 * @param options 옵션
 * @returns toast ID
 */
export function showInfo(message: string, options?: ToastOptions): string | number {
  return toast.info(message, {
    duration: options?.duration ?? 3000,
    description: options?.description,
    action: options?.action,
  });
}

/**
 * 로딩 메시지 표시
 * 작업 완료 후 dismissToast()로 닫아야 함
 * @param message 메시지
 * @returns toast ID
 */
export function showLoading(message: string): string | number {
  return toast.loading(message, {
    duration: Infinity, // 수동으로 닫을 때까지 유지
  });
}

/**
 * Toast 닫기
 * @param toastId toast ID
 */
export function dismissToast(toastId?: string | number): void {
  if (toastId !== undefined) {
    toast.dismiss(toastId);
  } else {
    toast.dismiss(); // 모든 toast 닫기
  }
}

/**
 * 확인 대화상자 표시 (Promise 기반)
 * confirm() 대체용
 * @param message 확인 메시지
 * @param options 옵션
 * @returns 확인 여부 Promise
 */
export function showConfirm(
  message: string,
  options?: { description?: string }
): Promise<boolean> {
  return new Promise((resolve) => {
    toast(message, {
      description: options?.description,
      duration: Infinity,
      action: {
        label: '확인',
        onClick: () => resolve(true),
      },
      cancel: {
        label: '취소',
        onClick: () => resolve(false),
      },
      onDismiss: () => resolve(false),
    });
  });
}

/**
 * API 에러 처리 유틸리티
 * API 응답의 에러를 일관되게 표시
 * @param error 에러 객체 또는 메시지
 * @param fallbackMessage 기본 메시지
 */
export function handleApiError(
  error: unknown,
  fallbackMessage: string = '오류가 발생했습니다.'
): void {
  let message = fallbackMessage;

  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else if (error && typeof error === 'object') {
    // API 응답 에러 형식 처리
    const apiError = error as { message?: string; error?: string };
    message = apiError.message || apiError.error || fallbackMessage;
  }

  showError(message);
  console.error('API Error:', error);
}

/**
 * 스캔 성공 피드백 (사운드 + Toast)
 * @param message 메시지
 */
export function showScanSuccess(message: string = '스캔 완료'): void {
  // TODO: 사운드 재생 기능 추가
  // playSound('scan');
  showSuccess(message, { duration: 1500 });
}

/**
 * 스캔 에러 피드백 (사운드 + Toast)
 * @param message 메시지
 */
export function showScanError(message: string = '스캔 실패'): void {
  // TODO: 사운드 재생 기능 추가
  // playSound('error');
  showError(message, { duration: 2000 });
}
