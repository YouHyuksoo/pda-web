/**
 * @file src/components/forms/WarehouseSelect.tsx
 * @description
 * 창고 선택 컴포넌트입니다.
 * BMA100 마스터 코드에서 창고(S1012) 데이터를 조회하여 표시합니다.
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

// 창고 코드 목록 (S1012)
// TODO: API에서 동적으로 가져오기
export const WAREHOUSE_OPTIONS = [
  { value: 'WH01', label: '원자재창고' },
  { value: 'WH02', label: '부품창고' },
  { value: 'WH03', label: '완제품창고' },
  { value: 'WH04', label: '불량창고' },
  { value: 'WH05', label: '반품창고' },
  { value: 'LINE', label: '라인창고' },
];

interface WarehouseSelectProps {
  /** 선택된 창고 코드 */
  value?: string;
  /** 창고 변경 콜백 */
  onChange?: (value: string) => void;
  /** 라벨 */
  label?: string;
  /** placeholder */
  placeholder?: string;
  /** 비활성화 */
  disabled?: boolean;
  /** 추가 클래스 */
  className?: string;
  /** 제외할 창고 코드 */
  excludeValues?: string[];
}

export function WarehouseSelect({
  value,
  onChange,
  label = '창고',
  placeholder = '창고 선택',
  disabled = false,
  className,
  excludeValues = [],
}: WarehouseSelectProps) {
  const filteredOptions = WAREHOUSE_OPTIONS.filter(
    (opt) => !excludeValues.includes(opt.value)
  );

  return (
    <div className={cn('space-y-2', className)}>
      {label && <Label>{label}</Label>}
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {filteredOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
