/**
 * @file src/app/api/return/item/route.ts
 * @description
 * 반품입고 품번 검색 API 엔드포인트입니다.
 * C# HS500[반품입고].cs의 DoFind 로직을 구현합니다.
 *
 * @example
 * GET /api/return/item?itemCode=ITEM001
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';


/** 동적 라우트 설정 - 빌드 시 정적 생성 방지 */
export const dynamic = 'force-dynamic';
/**
 * 품번 정보 인터페이스 (BMF100)
 */
interface ItemInfo {
  ITNBR: string;
  ITTYPE: string;
  ITEMGRP: string;
  ITEMGRP2: string;
  ISPEC: string;
}

/**
 * GET /api/return/item
 * 품번 검색
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const itemCode = searchParams.get('itemCode');

    if (!itemCode) {
      return error('P/NO를 입력해주십시오');
    }

    // BMF100에서 품번 검색 (LIKE 검색 지원)
    const sql = `
      SELECT ROWNUM, ITNBR, ITTYPE, ITEMGRP, ITEMGRP2, ISPEC
      FROM BMF100
      WHERE ITNBR LIKE '%' || :itemCode || '%'
        AND USEYN = 'Y'
    `;

    const result = await oracle.query<ItemInfo>(sql, { itemCode: itemCode.toUpperCase() });

    if (!result.success) {
      return serverError(result.error || 'DB 조회 실패');
    }

    const items = (result.data || []).map((item, idx) => ({
      no: idx + 1,
      itemCode: item.ITNBR,
      itemType: item.ITTYPE,
      itemGroup: item.ITEMGRP,
      itemGroup2: item.ITEMGRP2,
      spec: item.ISPEC,
    }));

    return success(items);
  } catch (err) {
    console.error('품번 검색 API 오류:', err);
    return serverError('품번 검색 중 오류가 발생했습니다.');
  }
}
