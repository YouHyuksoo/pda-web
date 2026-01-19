/**
 * @file src/stores/auth-store.ts
 * @description
 * 인증 및 사용자 정보를 관리하는 Zustand 스토어입니다.
 * 기존 C# Common.cs의 전역 변수들을 대체합니다.
 *
 * 초보자 가이드:
 * 1. **useAuthStore**: 컴포넌트에서 사용자 정보 접근
 *    - const { userId, userName } = useAuthStore();
 * 2. **setUser**: 로그인 성공 시 사용자 정보 저장
 *    - useAuthStore.getState().setUser({ userId: 'xxx', ... });
 * 3. **logout**: 로그아웃 시 상태 초기화
 * 4. **persist**: 브라우저 새로고침해도 상태 유지 (localStorage)
 * 5. **세션 만료**: 로그인 후 8시간이 지나면 자동 로그아웃
 *
 * @example
 * // 컴포넌트에서 사용
 * const { userId, userName, saupj } = useAuthStore();
 *
 * // 로그인 처리
 * useAuthStore.getState().setUser({
 *   userId: 'USER001',
 *   userName: '홍길동',
 *   saupj: '10'
 * });
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** 세션 만료 시간 (8시간, 밀리초) */
const SESSION_TIMEOUT = 8 * 60 * 60 * 1000;

/**
 * 사용자 권한 타입
 * 기존 C# Common._Use_Auth 배열 대체
 */
interface UserPermissions {
  /** 자재입고 권한 */
  materialReceive: boolean;
  /** 부품불출 권한 */
  partsRelease: boolean;
  /** 원자재불출 권한 */
  rawRelease: boolean;
  /** 이동이력 권한 */
  transferHistory: boolean;
  /** 재고실사 권한 */
  stocktaking: boolean;
  /** 재공 권한 */
  wip: boolean;
  /** 재공불출 권한 */
  wipRelease: boolean;
}

/**
 * 인증 상태 인터페이스
 */
interface AuthState {
  // === 사용자 정보 (Common.cs 전역변수 대체) ===
  /** 사용자 ID (Common._UserID) */
  userId: string;
  /** 사용자 이름 (Common._UserName) */
  userName: string;
  /** 사업장 코드 (Common._SAUPJ) */
  saupj: string;
  /** 공정 코드 (Common._Opcode) */
  opcode: string;
  /** 라인 코드 (Common._Linecode) */
  linecode: string;
  /** 창고 위치 (Common._Location) */
  location: string;

  // === 화면 정보 ===
  /** 현재 화면 ID (Common._FormID) */
  formId: string;
  /** 현재 화면 이름 (Common._FormName) */
  formName: string;

  // === 권한 정보 ===
  /** 사용자 권한 (Common._Use_Auth) */
  permissions: UserPermissions;

  // === 설정 ===
  /** 언어 설정 (KO/EN/CN) */
  language: 'KO' | 'EN' | 'CN';

  // === 세션 관리 ===
  /** 로그인 시간 (timestamp) */
  loginAt: number | null;
  /** 마지막 활동 시간 (timestamp) */
  lastActivityAt: number | null;

  // === 액션 ===
  /** 사용자 정보 설정 */
  setUser: (user: Partial<AuthState>) => void;
  /** 현재 화면 정보 설정 */
  setForm: (formId: string, formName: string) => void;
  /** 로그아웃 (상태 초기화) */
  logout: () => void;
  /** 인증 여부 확인 */
  isAuthenticated: () => boolean;
  /** 세션 만료 여부 확인 */
  isSessionExpired: () => boolean;
  /** 활동 시간 갱신 */
  updateActivity: () => void;
  /** 세션 체크 및 만료 시 로그아웃 */
  checkSession: () => boolean;
}

/**
 * 초기 권한 상태
 */
const initialPermissions: UserPermissions = {
  materialReceive: false,
  partsRelease: false,
  rawRelease: false,
  transferHistory: false,
  stocktaking: false,
  wip: false,
  wipRelease: false,
};

/**
 * 인증 스토어
 * persist 미들웨어로 localStorage에 자동 저장
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // 초기 상태
      userId: '',
      userName: '',
      saupj: '',
      opcode: '',
      linecode: '',
      location: '',
      formId: '',
      formName: '',
      permissions: initialPermissions,
      language: 'KO',
      loginAt: null,
      lastActivityAt: null,

      // 사용자 정보 설정 (로그인 시간도 함께 저장)
      setUser: (user) =>
        set((state) => ({
          ...state,
          ...user,
          loginAt: Date.now(),
          lastActivityAt: Date.now(),
        })),

      // 현재 화면 정보 설정
      setForm: (formId, formName) =>
        set({
          formId,
          formName,
        }),

      // 로그아웃
      logout: () =>
        set({
          userId: '',
          userName: '',
          saupj: '',
          opcode: '',
          linecode: '',
          location: '',
          formId: '',
          formName: '',
          permissions: initialPermissions,
          loginAt: null,
          lastActivityAt: null,
        }),

      // 인증 여부 확인
      isAuthenticated: () => get().userId !== '',

      // 세션 만료 여부 확인
      isSessionExpired: () => {
        const { loginAt, lastActivityAt } = get();
        if (!loginAt) return true;

        const now = Date.now();
        // 로그인 후 8시간 경과 또는 마지막 활동 후 8시간 경과 시 만료
        const loginExpired = now - loginAt > SESSION_TIMEOUT;
        const activityExpired = lastActivityAt
          ? now - lastActivityAt > SESSION_TIMEOUT
          : true;

        return loginExpired || activityExpired;
      },

      // 활동 시간 갱신
      updateActivity: () =>
        set({ lastActivityAt: Date.now() }),

      // 세션 체크 및 만료 시 로그아웃
      checkSession: () => {
        const { isSessionExpired, logout, userId } = get();
        if (userId && isSessionExpired()) {
          logout();
          return false; // 세션 만료됨
        }
        return true; // 세션 유효
      },
    }),
    {
      name: 'hsgmes-auth', // localStorage 키 이름
    }
  )
);
