/**
 * @file src/app/api/production/input/route.ts
 * @description
 * 생산투입 API 엔드포인트입니다.
 * C# HS600[생산투입].cs의 로직을 구현합니다.
 *
 * 주요 테이블:
 * - PMA200: 생산계획
 * - PMB100: 생산투입
 * - PMS100: 재고
 * - BMF200: BOM
 *
 * @example
 * GET /api/production/input?opCode=0100&lineCode=01&planDate=2025-01-16 (작업지시 조회)
 * GET /api/production/input/box?boxNo=BOX001&opCode=0100 (BOX 정보 조회)
 * POST /api/production/input (투입 저장)
 */

import { NextRequest } from 'next/server';
import { oracle } from '@/lib/db/oracle';
import { success, error, serverError } from '@/lib/api/response';


/** 동적 라우트 설정 - 빌드 시 정적 생성 방지 */
export const dynamic = 'force-dynamic';
/**
 * 작업지시 인터페이스 (PMA200)
 */
interface WorkOrder {
  NO: number;
  ORDERNO: string;
  PITEMCODE: string;
  PQTY: number;
  REQTY: number;
  STIME: string;
  ETIME: string;
  INPUTQTY: number;
  WORKORDER: string;
  ITEMCODE: string;
}

/**
 * GET /api/production/input
 * 작업지시 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const opCode = searchParams.get('opCode');
    const lineCode = searchParams.get('lineCode');
    const planDate = searchParams.get('planDate');
    const saupj = searchParams.get('saupj') || '10';

    // 필수 파라미터 체크
    if (!opCode) {
      return error('공정을 선택해 주십시오');
    }
    if (!lineCode) {
      return error('라인을 선택해 주십시오');
    }
    if (!planDate) {
      return error('날짜를 선택해 주십시오');
    }

    // 날짜 유효성 체크 (당일 기준 3일 전까지만 조회 가능)
    const today = new Date();
    const queryDate = new Date(planDate);
    const daysDiff = Math.floor((today.getTime() - queryDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff > 3 || daysDiff < -1) {
      return error('당일 기준으로 3일 전 계획까지 조회 할 수 있습니다.');
    }

    // 작업지시 목록 조회 (PMA200)
    const sql = `
      SELECT ROWNUM AS NO, A.ORDERNO, A.PITEMCODE, A.PQTY,
             (A.PQTY - TO_NUMBER(NVL(UF_PMB100_INPUT_QTY(A.WORKORDER), 0))) AS REQTY,
             TO_CHAR(MIN(A.STIME), 'HH24:MI') AS STIME,
             TO_CHAR(MAX(A.ETIME), 'HH24:MI') AS ETIME,
             NVL(TO_NUMBER(UF_PMB100_INPUT_QTY(A.WORKORDER)), 0) AS INPUTQTY,
             A.WORKORDER,
             A.ITEMCODE
      FROM PMA200 A
      WHERE A.PLANDATE = :planDate
        AND A.OPCODE = :opCode
        AND A.LINECODE = :lineCode
        AND A.SAUPJ = :saupj
      GROUP BY A.PITEMCODE, A.ITEMCODE, A.PQTY, A.STIME, A.ETIME, A.WORKORDER, A.ORDERNO
      ORDER BY A.ORDERNO
    `;

    const result = await oracle.query<WorkOrder>(sql, {
      planDate,
      opCode,
      lineCode,
      saupj
    });

    if (!result.success) {
      return serverError(result.error || 'DB 조회 실패');
    }

    const workOrders = (result.data || []).map((item, idx) => ({
      no: idx + 1,
      orderNo: item.ORDERNO,
      itemCode: item.PITEMCODE,
      itemName: item.ITEMCODE, // 실제로는 품명 조회 필요
      planQty: item.PQTY,
      remainQty: item.REQTY,
      inputQty: item.INPUTQTY,
      startTime: item.STIME || '',
      endTime: item.ETIME || '',
      workOrder: item.WORKORDER,
      // 상태 구분: 완료(blue), 진행중(yellow), 초과(red), 미시작(white)
      status: item.REQTY === 0 ? 'complete' :
              item.REQTY < 0 ? 'over' :
              item.INPUTQTY > 0 ? 'progress' : 'pending'
    }));

    if (workOrders.length === 0) {
      return success([], '생산계획이 없습니다');
    }

    return success(workOrders);
  } catch (err) {
    console.error('작업지시 조회 API 오류:', err);
    return serverError('작업지시 조회 중 오류가 발생했습니다.');
  }
}

/**
 * 투입 저장 요청 인터페이스
 */
interface InputRequest {
  saupj: string;
  opCode: string;
  lineCode: string;
  planDate: string;
  workOrder: string;
  items: {
    boxNo: string;
    itemCode: string;
    inputQty: number;
    whsCode: string;
  }[];
  userId: string;
}

/**
 * POST /api/production/input
 * 생산투입 저장
 */
export async function POST(request: NextRequest) {
  try {
    const body: InputRequest = await request.json();
    const { saupj, opCode, lineCode, planDate, workOrder, items, userId } = body;

    // 입력 검증
    if (!opCode || !lineCode) {
      return error('공정/라인 정보가 없습니다.');
    }
    if (!items || items.length === 0) {
      return error('저장할 BOX 정보가 없습니다.');
    }

    // 투입번호 생성용 날짜 포맷
    const wkDate = planDate.replace(/-/g, '');

    // 트랜잭션으로 투입 처리
    const queries = [];

    for (const item of items) {
      // 투입번호 조회 (UF_PMB100_SNO 함수 호출)
      const snoResult = await oracle.scalar<string>(
        `SELECT UF_PMB100_SNO(:wkDate) AS SNO FROM DUAL`,
        { wkDate }
      );
      const inputSno = snoResult || `${wkDate}0001`;

      // TO 창고코드 조회
      const whsResult = await oracle.scalar<string>(
        `SELECT UF_BMA100_WHSCODE(:opCode) AS WHSCODE FROM DUAL`,
        { opCode }
      );
      const toWhsCode = whsResult || '';

      // PMB100 (생산투입) INSERT
      queries.push({
        sql: `
          INSERT INTO PMB100 (
            SNO, SAUPJ, WKDATE, OPCODE, LINECODE, BOXNO, ITEMCODE,
            D_ITEMCODE, INPUTQTY, WORKORDER, F_WHSCODE, PLANDATE,
            JUYA, MAKER, MAKEDATE
          ) VALUES (
            TRIM(:sno), TRIM(:saupj), TRIM(:wkDate), TRIM(:opCode), TRIM(:lineCode),
            TRIM(:boxNo), TRIM(:itemCode), '', :inputQty, TRIM(:workOrder),
            TRIM(:fWhsCode), :planDate,
            TRIM(UF_JUYA(:opCode)), :userId, SYSDATE
          )
        `,
        params: {
          sno: inputSno,
          saupj: saupj || '10',
          wkDate,
          opCode,
          lineCode,
          boxNo: item.boxNo,
          itemCode: item.itemCode,
          inputQty: item.inputQty,
          workOrder: workOrder || '****',
          fWhsCode: item.whsCode,
          planDate,
          userId: userId || 'SYSTEM'
        }
      });

      // 창고가 다르면 재고이동 (PMB300) INSERT
      if (item.whsCode !== toWhsCode) {
        const moveSnoResult = await oracle.scalar<string>(
          `SELECT UF_PMB300_SNO(:wkDate) AS SNO FROM DUAL`,
          { wkDate }
        );
        const moveSno = moveSnoResult || `${wkDate}0001`;

        queries.push({
          sql: `
            INSERT INTO PMB300 (
              SNO, SAUPJ, WKDATE, WHSCODE, BOXNO, ITEMCODE,
              F_WHSCODE, GUBUN, PQTY, MAKER, MAKEDATE, INPUT_SNO
            ) VALUES (
              TRIM(:sno), TRIM(:saupj), TRIM(:wkDate),
              TRIM(UF_BMA100_WHSCODE(:opCode)), TRIM(:boxNo), TRIM(:itemCode),
              TRIM(:fWhsCode), 'Y', :pqty, :userId, SYSDATE, TRIM(:inputSno)
            )
          `,
          params: {
            sno: moveSno,
            saupj: saupj || '10',
            wkDate,
            opCode,
            boxNo: item.boxNo,
            itemCode: item.itemCode,
            fWhsCode: item.whsCode,
            pqty: item.inputQty,
            userId: userId || 'SYSTEM',
            inputSno
          }
        });
      }
    }

    const result = await oracle.executeTransaction(queries);

    if (!result.success) {
      return serverError(result.error || '등록오류');
    }

    return success({ count: items.length }, '저장되었습니다');
  } catch (err) {
    console.error('생산투입 저장 API 오류:', err);
    return serverError('생산투입 저장 중 오류가 발생했습니다.');
  }
}
