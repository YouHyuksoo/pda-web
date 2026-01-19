/**
 * @file src/app/api/quality/kanban-check/route.ts
 * @description
 * 간판검증 API 엔드포인트입니다.
 * 간판 바코드를 조회하고 유효성을 검증합니다.
 *
 * @example
 * GET /api/quality/kanban-check?kanbanNo=KB001
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';


/** 동적 라우트 설정 - 빌드 시 정적 생성 방지 */
export const dynamic = 'force-dynamic';
/**
 * GET /api/quality/kanban-check
 * 간판 검증
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kanbanNo = searchParams.get('kanbanNo');

    if (!kanbanNo) {
      return error('간판번호는 필수입니다.');
    }

    const sql = `
      SELECT
        A.KANBAN_NO,
        A.ITEM_CODE,
        B.ITEM_NAME,
        A.QTY,
        A.FROM_LOCATION,
        A.TO_LOCATION,
        A.STATUS,
        A.EXPIRE_DATE
      FROM KBN100 A
      LEFT JOIN BOM_MASTER B ON A.ITEM_CODE = B.ITEM_CODE
      WHERE A.KANBAN_NO = :kanbanNo
    `;

    const result = await oracle.query(sql, { kanbanNo });

    if (!result.success) {
      return serverError(result.error || 'DB 조회 실패');
    }

    if (!result.data || result.data.length === 0) {
      // 간판이 없으면 invalid
      return success({
        kanbanNo,
        itemCode: '',
        itemName: '',
        qty: 0,
        fromLocation: '',
        toLocation: '',
        status: 'invalid',
        message: '유효하지 않은 간판입니다.',
      });
    }

    const row = result.data[0] as Record<string, unknown>;
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const expireDate = String(row.EXPIRE_DATE || '99991231');

    let status: 'valid' | 'invalid' | 'expired';
    let message: string;

    if (row.STATUS === 'N' || row.STATUS === 'X') {
      status = 'invalid';
      message = '유효하지 않은 간판입니다.';
    } else if (expireDate < today) {
      status = 'expired';
      message = '만료된 간판입니다.';
    } else {
      status = 'valid';
      message = '정상 간판입니다.';
    }

    const kanban = {
      kanbanNo: row.KANBAN_NO,
      itemCode: row.ITEM_CODE,
      itemName: row.ITEM_NAME || '',
      qty: row.QTY,
      fromLocation: row.FROM_LOCATION || '',
      toLocation: row.TO_LOCATION || '',
      status,
      message,
    };

    return success(kanban);
  } catch (err) {
    console.error('간판 검증 오류:', err);
    return serverError('간판 검증 중 오류가 발생했습니다.');
  }
}
