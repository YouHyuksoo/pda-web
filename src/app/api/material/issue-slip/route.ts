/**
 * @file src/app/api/material/issue-slip/route.ts
 * @description
 * 자재불출(전표O) API 엔드포인트입니다.
 * C# HSJ100[자재불출].cs의 로직을 구현합니다.
 *
 * @example
 * GET /api/material/issue-slip?slipNo=SLIP001
 * POST /api/material/issue-slip (불출 저장)
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';


/** 동적 라우트 설정 - 빌드 시 정적 생성 방지 */
export const dynamic = 'force-dynamic';
/**
 * 전표 품목 인터페이스
 */
interface SlipItem {
  NO: number;
  SLIP_NO: string;
  ITEM_CODE: string;
  ITEM_NAME: string;
  REQ_QTY: number;
  ISSUE_QTY: number;
  LOT_NO: string;
}

/**
 * GET /api/material/issue-slip
 * 전표 품목 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slipNo = searchParams.get('slipNo');

    if (!slipNo) {
      return error('전표번호를 입력하세요.');
    }

    // 전표 품목 조회
    // TODO: 실제 테이블명과 컬럼명은 DB 스키마에 맞게 수정 필요
    const sql = `
      SELECT
        ROWNUM AS NO,
        D.SLIP_NO,
        D.ITEM_CODE,
        I.ITEM_NAME,
        D.REQ_QTY,
        NVL(D.ISSUE_QTY, 0) AS ISSUE_QTY,
        D.LOT_NO
      FROM TB_SLIP_DETAIL D
      LEFT JOIN TB_ITEM I ON D.ITEM_CODE = I.ITEM_CODE
      WHERE D.SLIP_NO = :slipNo
        AND NVL(D.ISSUE_QTY, 0) < D.REQ_QTY
      ORDER BY D.ITEM_CODE
    `;

    const result = await oracle.query<SlipItem>(sql, { slipNo });

    if (!result.success) {
      return serverError(result.error || 'DB 조회 실패');
    }

    const items = (result.data || []).map(item => ({
      no: item.NO,
      slipNo: item.SLIP_NO,
      itemCode: item.ITEM_CODE,
      itemName: item.ITEM_NAME,
      reqQty: item.REQ_QTY,
      issueQty: item.ISSUE_QTY,
      boxNo: item.LOT_NO || '',
    }));

    return success(items);
  } catch (err) {
    console.error('전표 조회 API 오류:', err);
    return serverError('전표 조회 중 오류가 발생했습니다.');
  }
}

/**
 * 불출 저장 요청 인터페이스
 */
interface IssueRequest {
  slipNo: string;
  warehouseCode: string;
  items: {
    itemCode: string;
    issueQty: number;
    boxNo: string;
  }[];
  userId: string;
}

/**
 * POST /api/material/issue-slip
 * 자재불출 저장
 */
export async function POST(request: NextRequest) {
  try {
    const body: IssueRequest = await request.json();
    const { slipNo, warehouseCode, items, userId } = body;

    // 입력 검증
    if (!slipNo) {
      return error('전표번호가 없습니다.');
    }

    if (!warehouseCode) {
      return error('창고를 선택하세요.');
    }

    if (!items || items.length === 0) {
      return error('불출할 항목이 없습니다.');
    }

    // 트랜잭션으로 불출 처리
    const queries = items.map(item => ({
      sql: `
        UPDATE TB_SLIP_DETAIL
        SET ISSUE_QTY = :issueQty,
            LOT_NO = :boxNo,
            WH_CODE = :warehouseCode,
            ISSUE_DATE = SYSDATE,
            ISSUE_USER = :userId,
            UPDATE_DATE = SYSDATE,
            UPDATE_USER = :userId
        WHERE SLIP_NO = :slipNo
          AND ITEM_CODE = :itemCode
      `,
      params: {
        issueQty: item.issueQty,
        boxNo: item.boxNo,
        warehouseCode,
        userId: userId || 'SYSTEM',
        slipNo,
        itemCode: item.itemCode,
      },
    }));

    const result = await oracle.executeTransaction(queries);

    if (!result.success) {
      return serverError(result.error || '불출 저장 실패');
    }

    return success({ count: items.length }, `${items.length}건 저장되었습니다.`);
  } catch (err) {
    console.error('불출 저장 API 오류:', err);
    return serverError('불출 저장 중 오류가 발생했습니다.');
  }
}
