/**
 * @file src/lib/constants/menu.ts
 * @description
 * 메뉴 구조 상수 정의입니다.
 * 기존 C# HS020 메인메뉴의 메뉴 구조를 웹용으로 변환했습니다.
 *
 * 초보자 가이드:
 * 1. **MENU_ITEMS**: 전체 메뉴 구조
 * 2. 각 메뉴는 formId (기존 HS코드)와 매핑됨
 * 3. path는 Next.js 라우트 경로
 */

/**
 * 메뉴 아이템 타입
 */
export interface MenuItem {
  /** 메뉴 ID (기존 Form ID: HS010, HS020 등) */
  formId: string;
  /** 메뉴 이름 */
  name: string;
  /** 라우트 경로 */
  path: string;
  /** 아이콘 이름 (lucide-react) */
  icon?: string;
  /** 하위 메뉴 */
  children?: MenuItem[];
  /** 표시 여부 */
  visible?: boolean;
}

/**
 * 전체 메뉴 구조
 */
export const MENU_ITEMS: MenuItem[] = [
  {
    formId: 'MATERIAL',
    name: '자재관리',
    path: '/material',
    icon: 'Package',
    children: [
      { formId: 'HM100', name: '자재불출', path: '/material/issue' },
      { formId: 'HSJ100', name: '자재불출(전표O)', path: '/material/issue-slip' },
      { formId: 'HSJ110', name: '자재불출(전표X)', path: '/material/issue-no-slip' },
      { formId: 'HSJ120', name: '자재출고', path: '/material/release' },
      { formId: 'HSJ200', name: '자재입고', path: '/material/receive' },
      { formId: 'HSJ210', name: '자재입고취소', path: '/material/receive-cancel' },
      { formId: 'HSJ220', name: '바코드병합', path: '/material/barcode-merge' },
      { formId: 'HSJ240', name: '바코드분할', path: '/material/barcode-split' },
      { formId: 'HS200', name: '재고이동', path: '/material/transfer' },
      { formId: 'HS100', name: '외주출고', path: '/material/outsource' },
      { formId: 'HS800', name: '재고실사', path: '/material/stocktaking' },
    ],
  },
  {
    formId: 'PRODUCTION',
    name: '생산관리',
    path: '/production',
    icon: 'Factory',
    children: [
      { formId: 'HS600', name: '생산투입', path: '/production/input' },
      { formId: 'HS601', name: '부품투입', path: '/production/parts-input' },
      { formId: 'HS610', name: '생산투입취소', path: '/production/input-cancel' },
      { formId: 'HS620', name: 'SMD오삽체크', path: '/production/smd-check' },
      { formId: 'HS630', name: '상온방치등록', path: '/production/room-temp' },
      { formId: 'HS631', name: '교반등록', path: '/production/stirring' },
      { formId: 'HS632', name: '폐기등록', path: '/production/disposal' },
      { formId: 'HS700', name: '실적등록', path: '/production/result' },
      { formId: 'HS810', name: '대차재고현황', path: '/production/cart-stock' },
      { formId: 'HS900', name: '조립실적등록', path: '/production/assembly' },
    ],
  },
  {
    formId: 'PLAN',
    name: '생산계획',
    path: '/plan',
    icon: 'Calendar',
    children: [
      { formId: 'HP120', name: '생산계획 시작종료', path: '/plan/start-end' },
      { formId: 'HP130', name: '장착 및 교체', path: '/plan/mount-replace' },
      { formId: 'HP140', name: '탈착', path: '/plan/detach' },
      { formId: 'HP150', name: '주기검사등록', path: '/plan/periodic-check' },
      { formId: 'HP190', name: '다음생산계획', path: '/plan/next-start-end' },
      { formId: 'HP200', name: '다음장착 및 교체', path: '/plan/next-mount' },
      { formId: 'HP210', name: '다음탈착', path: '/plan/next-detach' },
    ],
  },
  {
    formId: 'QUALITY',
    name: '품질관리',
    path: '/quality',
    icon: 'CheckCircle',
    children: [
      { formId: 'HS250', name: 'OQC검사', path: '/quality/oqc' },
      { formId: 'HS251', name: 'OQC검사(ORACLE)', path: '/quality/oqc-oracle' },
      { formId: 'HS260', name: '간판 품번검사', path: '/quality/kanban-check' },
    ],
  },
  {
    formId: 'SHIPMENT',
    name: '출하관리',
    path: '/shipment',
    icon: 'Truck',
    children: [
      { formId: 'HS400', name: '출하처리', path: '/shipment/process' },
      { formId: 'HS401', name: '출하처리 상세', path: '/shipment/process-detail' },
      { formId: 'HS402', name: '출하처리[개별]', path: '/shipment/process-individual' },
      { formId: 'HS410', name: '출하취소', path: '/shipment/cancel' },
    ],
  },
  {
    formId: 'RETURN',
    name: '반품관리',
    path: '/return',
    icon: 'RotateCcw',
    children: [
      { formId: 'HS500', name: '반품입고', path: '/return/receive' },
      { formId: 'HS505', name: '반품입고[개별]', path: '/return/receive-individual' },
      { formId: 'HS510', name: '반품취소', path: '/return/cancel' },
    ],
  },
  {
    formId: 'REPACK',
    name: '재포장/변경',
    path: '/repack',
    icon: 'RefreshCw',
    children: [
      { formId: 'HS300', name: '재포장', path: '/repack/basic' },
      { formId: 'HS310', name: '재포장[개별]', path: '/repack/individual' },
      { formId: 'HS320', name: 'CKD품번변경', path: '/repack/ckd-change' },
    ],
  },
];

/**
 * Form ID로 메뉴 아이템 찾기
 * @param formId - 검색할 Form ID (예: 'HS700')
 * @returns 메뉴 아이템 또는 undefined
 */
export function findMenuByFormId(formId: string): MenuItem | undefined {
  for (const menu of MENU_ITEMS) {
    if (menu.formId === formId) return menu;
    if (menu.children) {
      const child = menu.children.find((c) => c.formId === formId);
      if (child) return child;
    }
  }
  return undefined;
}

/**
 * 경로로 메뉴 아이템 찾기
 * @param path - 검색할 경로 (예: '/production/result')
 * @returns 메뉴 아이템 또는 undefined
 */
export function findMenuByPath(path: string): MenuItem | undefined {
  for (const menu of MENU_ITEMS) {
    if (menu.path === path) return menu;
    if (menu.children) {
      const child = menu.children.find((c) => c.path === path);
      if (child) return child;
    }
  }
  return undefined;
}
