// src/lib/permissions.js
// 본사 전체 조회 및 매장별 조회 권한 분리 및 서버/DB 접근 제한 가드

export const ROLES = {
  HQ_MASTER: "HQ_MASTER",           // 본사 전체 조회 및 관리 권한 (7개 전 매장)
  STORE_MANAGER: "STORE_MANAGER"     // 특정 단일 매장 점주/매니저 권한
};

export const MOCK_USERS = [
  {
    id: "user-hq",
    name: "본사 총괄 관리자",
    role: ROLES.HQ_MASTER,
    authorizedStoreIds: ["*"], // 전 매장 접근 허용
    email: "hq_admin@allyou.co.kr"
  },
  {
    id: "user-store-4",
    name: "신영웅 성서점 점주",
    role: ROLES.STORE_MANAGER,
    authorizedStoreIds: ["store-4"],
    email: "syw_manager@allyou.co.kr"
  },
  {
    id: "user-store-1",
    name: "포크팬 복현점 점주",
    role: ROLES.STORE_MANAGER,
    authorizedStoreIds: ["store-1"],
    email: "forkpan_manager@allyou.co.kr"
  },
  {
    id: "user-store-5",
    name: "금막창 종로점 점주",
    role: ROLES.STORE_MANAGER,
    authorizedStoreIds: ["store-5"],
    email: "gmc_jr_manager@allyou.co.kr"
  }
];

/**
 * 매장 접근 권한 검증 (화면 및 API 라우트 공통 가드)
 */
export function canAccessStore(user, targetStoreId) {
  if (!user) return false;
  if (user.role === ROLES.HQ_MASTER) return true;
  if (user.authorizedStoreIds && user.authorizedStoreIds.includes("*")) return true;
  return user.authorizedStoreIds && user.authorizedStoreIds.includes(targetStoreId);
}

/**
 * 데이터 레코드 필터링 (서버 쿼리 및 클라이언트 공통 강제)
 * 매장 점주는 본인 매장 데이터 외의 타 매장/종합 데이터 접근 원천 차단
 */
export function enforceDataPermission(records, user) {
  if (!user) return [];
  if (user.role === ROLES.HQ_MASTER || user.authorizedStoreIds?.includes("*")) {
    return records;
  }
  const allowed = new Set(user.authorizedStoreIds || []);
  return (records || []).filter(r => allowed.has(r.storeId || r.store_id));
}
