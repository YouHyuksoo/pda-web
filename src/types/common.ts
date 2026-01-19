/**
 * @file src/types/common.ts
 * @description
 * 공통으로 사용되는 TypeScript 타입 정의입니다.
 *
 * 초보자 가이드:
 * 1. **ComboOption**: 드롭다운/셀렉트 박스 옵션
 * 2. **ApiResponse**: API 응답 표준 형식
 * 3. **TableColumn**: 테이블 컬럼 정의
 */

/**
 * ComboBox 옵션 타입
 * Select, Dropdown 등에서 사용
 */
export interface ComboOption {
  /** 옵션 값 (코드) */
  value: string;
  /** 표시 텍스트 */
  label: string;
  /** 비활성화 여부 */
  disabled?: boolean;
}

/**
 * API 응답 표준 타입
 */
export interface ApiResponse<T = unknown> {
  /** 성공 여부 */
  success: boolean;
  /** 응답 메시지 */
  message: string;
  /** 응답 데이터 */
  data?: T;
  /** 에러 상세 (실패 시) */
  errors?: Array<{
    field?: string;
    message: string;
  }>;
}

/**
 * 페이징 요청 파라미터
 */
export interface PaginationParams {
  /** 페이지 번호 (1부터 시작) */
  page: number;
  /** 페이지당 항목 수 */
  pageSize: number;
  /** 정렬 컬럼 */
  sortBy?: string;
  /** 정렬 방향 */
  sortOrder?: 'asc' | 'desc';
}

/**
 * 페이징 응답 타입
 */
export interface PaginatedResponse<T> {
  /** 데이터 목록 */
  items: T[];
  /** 전체 항목 수 */
  total: number;
  /** 현재 페이지 */
  page: number;
  /** 페이지당 항목 수 */
  pageSize: number;
  /** 전체 페이지 수 */
  totalPages: number;
}

/**
 * 마스터 코드 타입 (BMA100 테이블)
 */
export interface MasterCode {
  /** 대분류 코드 */
  majorCode: string;
  /** 소분류 코드 */
  minorCode: string;
  /** 코드명 */
  codeName: string;
  /** 사용 여부 */
  useFlag: string;
  /** 관련 코드 1~5 */
  relCode1?: string;
  relCode2?: string;
  relCode3?: string;
  relCode4?: string;
  relCode5?: string;
}

/**
 * 바코드 스캔 결과 타입
 */
export interface BarcodeData {
  /** 바코드 원본 값 */
  barcode: string;
  /** 품목코드 */
  itemCode?: string;
  /** 품목명 */
  itemName?: string;
  /** 박스번호 */
  boxNo?: string;
  /** 수량 */
  qty?: number;
  /** 창고코드 */
  whsCode?: string;
  /** 위치 */
  location?: string;
}

/**
 * 사운드 타입
 */
export type SoundType = 'scan' | 'error' | 'success' | 'complete';

/**
 * 테마 타입
 */
export type ThemeType = 'light' | 'dark' | 'system';

/**
 * 언어 타입
 */
export type LanguageType = 'KO' | 'EN' | 'CN';
