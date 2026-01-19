/**
 * @file src/components/forms/BarcodeInput.tsx
 * @description
 * 바코드 입력 컴포넌트입니다.
 * PDA 바코드 스캐너와 연동하여 바코드를 입력받습니다.
 *
 * 초보자 가이드:
 * 1. 키보드 웨지 모드 지원 - Enter 키로 스캔 완료 감지
 * 2. 자동 포커스 및 선택 기능
 * 3. 스캔 후 자동 초기화 옵션
 *
 * @example
 * <BarcodeInput
 *   label="BOX NO"
 *   placeholder="바코드를 스캔하세요"
 *   onScan={(barcode) => handleBarcodeScan(barcode)}
 *   autoFocus
 * />
 */

'use client';

import { forwardRef, useCallback, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface BarcodeInputProps {
  /** 라벨 텍스트 */
  label?: string;
  /** placeholder 텍스트 */
  placeholder?: string;
  /** 바코드 스캔 완료 콜백 */
  onScan?: (barcode: string) => void;
  /** 스캔 후 자동 초기화 */
  clearAfterScan?: boolean;
  /** 자동 포커스 */
  autoFocus?: boolean;
  /** 비활성화 */
  disabled?: boolean;
  /** 추가 클래스 */
  className?: string;
  /** 입력값 (제어 컴포넌트) */
  value?: string;
  /** 입력값 변경 콜백 */
  onChange?: (value: string) => void;
  /** 에러 메시지 */
  error?: string;
}

export const BarcodeInput = forwardRef<HTMLInputElement, BarcodeInputProps>(
  (
    {
      label,
      placeholder = '바코드를 스캔하세요',
      onScan,
      clearAfterScan = true,
      autoFocus = false,
      disabled = false,
      className,
      value: controlledValue,
      onChange,
      error,
    },
    ref
  ) => {
    // 비제어 컴포넌트용 내부 상태
    const [internalValue, setInternalValue] = useState('');
    const value = controlledValue !== undefined ? controlledValue : internalValue;

    // 입력값 변경 처리
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value.toUpperCase(); // 대문자 변환
        if (onChange) {
          onChange(newValue);
        } else {
          setInternalValue(newValue);
        }
      },
      [onChange]
    );

    // 키 입력 처리 (Enter = 스캔 완료)
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const barcode = (e.currentTarget.value || '').trim();

          if (barcode && onScan) {
            onScan(barcode);

            // 스캔 후 초기화
            if (clearAfterScan) {
              if (onChange) {
                onChange('');
              } else {
                setInternalValue('');
              }
            }
          }
        }
      },
      [onScan, clearAfterScan, onChange]
    );

    return (
      <div className={cn('space-y-2', className)}>
        {label && <Label>{label}</Label>}
        <Input
          ref={ref}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={disabled}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          className={cn(
            'font-mono text-lg',
            error && 'border-red-500 focus-visible:ring-red-500'
          )}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    );
  }
);

BarcodeInput.displayName = 'BarcodeInput';
