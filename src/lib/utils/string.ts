/**
 * @file src/lib/utils/string.ts
 * @description
 * 문자열 처리 유틸리티 함수 모음입니다.
 * 기존 C# modClass.cs의 함수들을 대체합니다.
 *
 * 초보자 가이드:
 * 1. **extractCode**: "[WH001]창고A" → "WH001" 코드 추출
 * 2. **extractName**: "[WH001]창고A" → "창고A" 이름 추출
 * 3. **formatComboOption**: 코드와 이름을 "[코드]이름" 형식으로 결합
 * 4. **nvl**: null/undefined/빈문자열 처리 (기본값 반환)
 *
 * @example
 * import { extractCode, extractName, nvl } from '@/lib/utils/string';
 *
 * const text = "[WH001]창고A";
 * extractCode(text);  // "WH001"
 * extractName(text);  // "창고A"
 *
 * nvl(null, '기본값');  // "기본값"
 * nvl('값', '기본값');  // "값"
 */

/**
 * SQL 값 변환 (gSaveNvl 대체)
 * 값이 있으면 'value'형식, 없으면 NULL 반환
 *
 * @param value - 변환할 값
 * @param suffix - 값 뒤에 붙일 문자 (기본: ',')
 * @param quote - 따옴표 감싸기 여부 (기본: true)
 * @returns SQL에 사용할 문자열
 *
 * @example
 * toSqlValue('test', ',', true);   // "'test',"
 * toSqlValue('', ',', true);       // "NULL,"
 * toSqlValue('123', ')', false);   // "123)"
 */
export function toSqlValue(
  value: string | null | undefined,
  suffix: string = ',',
  quote: boolean = true
): string {
  if (!value || value.trim() === '') {
    return `NULL${suffix}`;
  }
  return quote ? `'${value}'${suffix}` : `${value}${suffix}`;
}

/**
 * 코드 추출 (gGetCode 대체)
 * "[WH001]창고A" 형식에서 코드 부분 추출
 *
 * @param text - "[코드]이름" 형식의 문자열
 * @returns 코드 문자열 (없으면 빈 문자열)
 *
 * @example
 * extractCode("[WH001]창고A");  // "WH001"
 * extractCode("창고A");         // ""
 * extractCode("");              // ""
 */
export function extractCode(text: string | null | undefined): string {
  if (!text) return '';
  const match = text.match(/\[([^\]]+)\]/);
  return match ? match[1] : '';
}

/**
 * 이름 추출 (gGetName 대체)
 * "[WH001]창고A" 형식에서 이름 부분 추출
 *
 * @param text - "[코드]이름" 형식의 문자열
 * @returns 이름 문자열 (코드 없으면 원본 반환)
 *
 * @example
 * extractName("[WH001]창고A");  // "창고A"
 * extractName("창고A");         // "창고A"
 * extractName("");              // ""
 */
export function extractName(text: string | null | undefined): string {
  if (!text) return '';
  const match = text.match(/\](.+)$/);
  return match ? match[1] : text;
}

/**
 * NULL 대체 (gNvl 대체)
 * 값이 null/undefined/빈문자열이면 기본값 반환
 *
 * @param value - 검사할 값
 * @param defaultValue - 기본값
 * @returns 값 또는 기본값
 *
 * @example
 * nvl(null, '기본');      // "기본"
 * nvl(undefined, '기본'); // "기본"
 * nvl('', '기본');        // "기본"
 * nvl('값', '기본');      // "값"
 */
export function nvl<T>(value: T | null | undefined, defaultValue: T): T {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return defaultValue;
  }
  return value;
}

/**
 * ComboBox 옵션 포맷
 * 코드와 이름을 "[코드]이름" 형식으로 결합
 *
 * @param code - 코드
 * @param name - 이름
 * @returns "[코드]이름" 형식 문자열
 *
 * @example
 * formatComboOption("WH001", "창고A");  // "[WH001]창고A"
 */
export function formatComboOption(code: string, name: string): string {
  return `[${code}]${name}`;
}

/**
 * ComboBox 옵션을 코드와 이름으로 분리
 *
 * @param option - "[코드]이름" 형식의 문자열
 * @returns { code, name } 객체
 *
 * @example
 * parseComboOption("[WH001]창고A");  // { code: "WH001", name: "창고A" }
 */
export function parseComboOption(option: string): { code: string; name: string } {
  return {
    code: extractCode(option),
    name: extractName(option),
  };
}

/**
 * 바코드 문자열 정리
 * 앞뒤 공백 제거 및 대문자 변환
 *
 * @param barcode - 바코드 문자열
 * @returns 정리된 바코드
 */
export function cleanBarcode(barcode: string | null | undefined): string {
  if (!barcode) return '';
  return barcode.trim().toUpperCase();
}

/**
 * 숫자 포맷팅 (천단위 콤마)
 *
 * @param value - 숫자 또는 숫자 문자열
 * @param decimals - 소수점 자릿수 (기본: 0)
 * @returns 포맷된 문자열
 *
 * @example
 * formatNumber(1234567);     // "1,234,567"
 * formatNumber(1234.567, 2); // "1,234.57"
 */
export function formatNumber(
  value: number | string | null | undefined,
  decimals: number = 0
): string {
  if (value === null || value === undefined || value === '') {
    return '0';
  }
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return num.toLocaleString('ko-KR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * 날짜 포맷팅 (YYYY-MM-DD)
 *
 * @param date - Date 객체 또는 날짜 문자열
 * @returns YYYY-MM-DD 형식 문자열
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 날짜+시간 포맷팅 (YYYY-MM-DD HH:mm:ss)
 *
 * @param date - Date 객체 또는 날짜 문자열
 * @returns YYYY-MM-DD HH:mm:ss 형식 문자열
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  const dateStr = formatDate(d);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${dateStr} ${hours}:${minutes}:${seconds}`;
}
