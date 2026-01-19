/**
 * @file src/components/forms/ProcessLineSelect.tsx
 * @description
 * 공정 및 라인 선택 컴포넌트입니다.
 * BMA100 마스터 코드에서 공정(S1010), 라인(S1011) 데이터를 조회하여 표시합니다.
 *
 * 초보자 가이드:
 * 1. **공정 선택**: S1010 코드 사용
 * 2. **라인 선택**: S1011 코드 사용
 * 3. 사용자 기본값 자동 설정 (Common._Opcode, Common._Linecode)
 */

'use client';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// 공정 코드 목록 (S1010)
// TODO: API에서 동적으로 가져오기
export const PROCESS_OPTIONS = [
  { value: '0100', label: 'SMT' },
  { value: '0200', label: 'DIP' },
  { value: '0300', label: '조립' },
  { value: '0400', label: '검사' },
  { value: '0500', label: '포장' },
  { value: '0600', label: 'ASSY' },
  { value: '0700', label: 'TEST' },
  { value: '0800', label: 'PACK' },
];

// 라인 코드 목록 (S1011)
// TODO: API에서 동적으로 가져오기
export const LINE_OPTIONS = [
  { value: 'L01', label: 'LINE-01' },
  { value: 'L02', label: 'LINE-02' },
  { value: 'L03', label: 'LINE-03' },
  { value: 'L04', label: 'LINE-04' },
  { value: 'L05', label: 'LINE-05' },
];

interface ProcessSelectProps {
  /** 선택된 공정 코드 */
  value?: string;
  /** 공정 변경 콜백 */
  onChange?: (value: string) => void;
  /** 라벨 */
  label?: string;
  /** 비활성화 */
  disabled?: boolean;
  /** 추가 클래스 */
  className?: string;
}

export function ProcessSelect({
  value,
  onChange,
  label = '공정',
  disabled = false,
  className,
}: ProcessSelectProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {label && <Label>{label}</Label>}
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder="공정 선택" />
        </SelectTrigger>
        <SelectContent>
          {PROCESS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface LineSelectProps {
  /** 선택된 라인 코드 */
  value?: string;
  /** 라인 변경 콜백 */
  onChange?: (value: string) => void;
  /** 라벨 */
  label?: string;
  /** 비활성화 */
  disabled?: boolean;
  /** 추가 클래스 */
  className?: string;
}

export function LineSelect({
  value,
  onChange,
  label = '라인',
  disabled = false,
  className,
}: LineSelectProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {label && <Label>{label}</Label>}
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder="라인 선택" />
        </SelectTrigger>
        <SelectContent>
          {LINE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
