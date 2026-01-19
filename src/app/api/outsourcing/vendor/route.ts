/**
 * @file src/app/api/outsourcing/vendor/route.ts
 * @description
 * 외주업체 목록 조회 API 엔드포인트입니다.
 * C# HS100[외주출고].cs의 ComboBoxBind_Cust 로직을 구현합니다.
 *
 * @example
 * GET /api/outsourcing/vendor
 */

import { oracle } from '@/lib/db/oracle';
import { success, serverError } from '@/lib/api/response';

/**
 * 업체 인터페이스 (BMF300)
 */
interface Vendor {
  CVCOD: string;
  CVNAS: string;
}

/**
 * GET /api/outsourcing/vendor
 * 외주업체 목록 조회
 */
export async function GET() {
  try {
    // BMF300 테이블에서 외주업체(OYJUGAYN = 'Y') 조회
    const sql = `
      SELECT CVCOD, CVNAS
      FROM BMF300
      WHERE OYJUGAYN = 'Y'
      ORDER BY CVCOD
    `;

    const result = await oracle.query<Vendor>(sql);

    if (!result.success) {
      return serverError(result.error || 'DB 조회 실패');
    }

    const vendors = (result.data || []).map((item) => ({
      code: item.CVCOD,
      name: `[${item.CVCOD}] ${item.CVNAS}`,
    }));

    return success(vendors);
  } catch (err) {
    console.error('업체 목록 조회 API 오류:', err);
    return serverError('업체 목록 조회 중 오류가 발생했습니다.');
  }
}
