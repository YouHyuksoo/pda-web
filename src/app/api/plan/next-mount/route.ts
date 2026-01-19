/**
 * @file src/app/api/plan/next-mount/route.ts
 * @description
 * 차기장착 API 엔드포인트입니다.
 * 차기 작업에 필요한 부품 목록 조회 및 사전 장착 정보를 처리합니다.
 *
 * @example
 * GET /api/plan/next-mount?processCode=P01&lineCode=L01&planDate=20240102
 * POST /api/plan/next-mount (사전 장착 정보 저장)
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';


/** 동적 라우트 설정 - 빌드 시 정적 생성 방지 */
export const dynamic = 'force-dynamic';
/**
 * GET /api/plan/next-mount
 * 차기 작업에 필요한 부품 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const processCode = searchParams.get('processCode');
    const lineCode = searchParams.get('lineCode');
    const planDate = searchParams.get('planDate');

    if (!processCode || !lineCode) {
      return error('공정/라인을 선택해주세요.');
    }

    // 차기 작업 지시 조회
    const orderSql = `
      SELECT
        A.ORDERNO AS ORDER_NO,
        A.ITEMCODE AS ITEM_CODE,
        B.ITEM_NAME
      FROM PMO100 A
      LEFT JOIN BOM_MASTER B ON A.ITEMCODE = B.ITEM_CODE
      WHERE A.OPCODE = :processCode
        AND A.LINECODE = :lineCode
        AND A.WKDATE = NVL(:planDate, TO_CHAR(SYSDATE + 1, 'YYYYMMDD'))
        AND A.STATUS = 'P'
      ORDER BY A.SEQ
      FETCH FIRST 1 ROW ONLY
    `;

    const orderResult = await oracle.query(orderSql, {
      processCode,
      lineCode,
      planDate: planDate?.replace(/-/g, '') || null,
    });

    if (!orderResult.success || !orderResult.data || orderResult.data.length === 0) {
      return success({ orderNo: null, parts: [] }, '차기 작업이 없습니다.');
    }

    const order = orderResult.data[0] as Record<string, unknown>;
    const orderNo = order.ORDER_NO as string;

    // 필요 부품 목록 조회 (BOM 기준)
    const partsSql = `
      SELECT
        A.FEEDER_NO,
        A.PART_CODE,
        B.ITEM_NAME AS PART_NAME,
        A.REQUIRED_QTY,
        C.LOTNO AS PREPARED_LOT,
        C.QTY AS PREPARED_QTY
      FROM PMM_FEEDER_MASTER A
      LEFT JOIN BOM_MASTER B ON A.PART_CODE = B.ITEM_CODE
      LEFT JOIN PMM_NEXT_MOUNT C ON A.FEEDER_NO = C.FEEDER_NO
        AND C.ORDERNO = :orderNo
        AND C.STATUS = 'P'
      WHERE A.OPCODE = :processCode
        AND A.LINECODE = :lineCode
        AND A.USE_YN = 'Y'
      ORDER BY A.FEEDER_NO
    `;

    const partsResult = await oracle.query(partsSql, {
      orderNo,
      processCode,
      lineCode,
    });

    const parts = (partsResult.data || []).map((row: Record<string, unknown>) => ({
      feederNo: row.FEEDER_NO || '',
      partCode: row.PART_CODE || '',
      partName: row.PART_NAME || '',
      requiredQty: row.REQUIRED_QTY || 0,
      preparedLot: row.PREPARED_LOT || null,
      preparedQty: row.PREPARED_QTY || 0,
    }));

    return success({
      orderNo,
      itemCode: order.ITEM_CODE,
      itemName: order.ITEM_NAME,
      parts,
    });
  } catch (err) {
    console.error('차기장착 조회 오류:', err);
    return serverError('차기장착 조회 중 오류가 발생했습니다.');
  }
}

/**
 * POST /api/plan/next-mount
 * 사전 장착 정보 저장
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderNo, mountList, userId } = body;

    if (!orderNo) {
      return error('작업지시번호가 없습니다.');
    }

    if (!mountList || mountList.length === 0) {
      return error('저장할 항목이 없습니다.');
    }

    const queries = [];

    for (const item of mountList) {
      // 기존 데이터 삭제 후 신규 입력
      queries.push({
        sql: `
          MERGE INTO PMM_NEXT_MOUNT A
          USING DUAL
          ON (A.ORDERNO = :orderNo AND A.FEEDER_NO = :feederNo)
          WHEN MATCHED THEN
            UPDATE SET
              LOTNO = :lotNo,
              QTY = :qty,
              STATUS = 'P',
              EDITOR = :userId,
              EDITDATE = SYSDATE
          WHEN NOT MATCHED THEN
            INSERT (ORDERNO, FEEDER_NO, PART_CODE, LOTNO, QTY, STATUS, MAKER, MAKEDATE)
            VALUES (:orderNo, :feederNo, :partCode, :lotNo, :qty, 'P', :userId, SYSDATE)
        `,
        params: {
          orderNo,
          feederNo: item.feederNo,
          partCode: item.partCode,
          lotNo: item.preparedLot,
          qty: item.preparedQty,
          userId: userId || 'SYSTEM',
        },
      });
    }

    const result = await oracle.executeTransaction(queries);

    if (!result.success) {
      return serverError(result.error || '저장 실패');
    }

    return success(
      { count: mountList.length },
      `${mountList.length}건 저장되었습니다.`
    );
  } catch (err) {
    console.error('차기장착 저장 오류:', err);
    return serverError('차기장착 저장 중 오류가 발생했습니다.');
  }
}
