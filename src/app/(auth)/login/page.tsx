/**
 * @file src/app/(auth)/login/page.tsx
 * @description
 * 로그인 페이지입니다. (HS010 대체)
 * 사용자 ID, 비밀번호, 사업장 선택 후 로그인 처리합니다.
 *
 * 초보자 가이드:
 * 1. **사업장 선택**: BMA100 테이블의 B1010 코드 사용
 * 2. **로그인 처리**: BMA200 테이블에서 사용자 인증
 * 3. **성공 시**: auth-store에 사용자 정보 저장 후 대시보드 이동
 *
 * @example
 * // 로그인 성공 후 상태
 * useAuthStore.getState() → { userId: 'xxx', userName: '홍길동', ... }
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth-store';
import { showSuccess, showError, handleApiError } from '@/lib/utils/toast';

/**
 * 로그인 폼 유효성 검사 스키마
 */
const loginSchema = z.object({
  userId: z.string().min(1, '사용자 ID를 입력하세요'),
  password: z.string().min(1, '비밀번호를 입력하세요'),
  saupj: z.string().min(1, '사업장을 선택하세요'),
});

type LoginFormData = z.infer<typeof loginSchema>;

/**
 * API 응답 인터페이스
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

/**
 * 콤보 아이템 인터페이스
 */
interface ComboItem {
  code: string;
  name: string;
}

/**
 * 로그인 응답 데이터 인터페이스
 */
interface LoginData {
  userId: string;
  userName: string;
  saupj: string;
  opCode: string;
  lineCode: string;
}

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saupjList, setSaupjList] = useState<ComboItem[]>([]);
  const [isLoadingSaupj, setIsLoadingSaupj] = useState(true);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      userId: '',
      password: '',
      saupj: '',
    },
  });

  /**
   * 사업장 목록 로드 (BMA100, MAJORCODE = 'B1010')
   */
  useEffect(() => {
    const loadSaupjList = async () => {
      try {
        const response = await fetch('/api/common/combo?majorCode=B1010');
        const result: ApiResponse<ComboItem[]> = await response.json();

        if (result.success && result.data) {
          setSaupjList(result.data);
          // 첫 번째 항목 기본 선택
          if (result.data.length > 0) {
            setValue('saupj', result.data[0].code);
          }
        } else {
          // API 실패 시 기본값 사용
          setSaupjList([
            { code: '10', name: '[10] 행성' },
            { code: '20', name: '[20] 인도네시아' },
          ]);
          setValue('saupj', '10');
        }
      } catch (err) {
        console.error('사업장 목록 로드 실패:', err);
        // 에러 시 기본값 사용
        setSaupjList([
          { code: '10', name: '[10] 행성' },
          { code: '20', name: '[20] 인도네시아' },
        ]);
        setValue('saupj', '10');
      } finally {
        setIsLoadingSaupj(false);
      }
    };

    loadSaupjList();
  }, [setValue]);

  /**
   * 로그인 처리 (BMA200 테이블 인증)
   */
  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setFormError(null);

    try {
      // API 호출
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result: ApiResponse<LoginData> = await response.json();

      if (result.success && result.data) {
        // 로그인 성공 - 상태 저장
        setUser({
          userId: result.data.userId,
          userName: result.data.userName,
          saupj: result.data.saupj,
          opcode: result.data.opCode,
          linecode: result.data.lineCode,
          language: 'KO',
        });

        showSuccess(`${result.data.userName}님, 환영합니다!`);

        // 대시보드로 이동
        router.push('/dashboard');
      } else {
        const errorMsg = result.error || '로그인에 실패했습니다.';
        setFormError(errorMsg);
        showError(errorMsg);
      }
    } catch (err) {
      console.error('Login error:', err);
      handleApiError(err, '로그인 중 오류가 발생했습니다.');
      setFormError('로그인 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-blue-600">
            HSGMES PDA
          </CardTitle>
          <p className="text-sm text-gray-500">행성 MES PDA 시스템</p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* 사업장 선택 */}
            <div className="space-y-2">
              <Label htmlFor="saupj">사업장</Label>
              <Select
                disabled={isLoadingSaupj}
                onValueChange={(value) => setValue('saupj', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingSaupj ? '로딩 중...' : '사업장 선택'} />
                </SelectTrigger>
                <SelectContent>
                  {saupjList.map((option) => (
                    <SelectItem key={option.code} value={option.code}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.saupj && (
                <p className="text-sm text-red-500">{errors.saupj.message}</p>
              )}
            </div>

            {/* 사용자 ID */}
            <div className="space-y-2">
              <Label htmlFor="userId">사용자 ID</Label>
              <Input
                id="userId"
                placeholder="아이디 입력"
                autoComplete="username"
                autoCapitalize="characters"
                {...register('userId')}
              />
              {errors.userId && (
                <p className="text-sm text-red-500">{errors.userId.message}</p>
              )}
            </div>

            {/* 비밀번호 */}
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                placeholder="비밀번호 입력"
                autoComplete="current-password"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>

            {/* 에러 메시지 */}
            {formError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                {formError}
              </div>
            )}

            {/* 로그인 버튼 */}
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || isLoadingSaupj}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  로그인 중...
                </>
              ) : (
                '로그인'
              )}
            </Button>
          </form>

          {/* 버전 정보 */}
          <p className="mt-4 text-center text-xs text-gray-400">
            v1.0.0 | © 2026 HSGMES
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
