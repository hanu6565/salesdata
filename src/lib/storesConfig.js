// src/lib/storesConfig.js
// 7개 매장 마스터 정보 및 POS 사이트 연동 규격 정의

export const POS_SYSTEMS = {
  NICE_OKPOS: {
    id: "NICE_OKPOS",
    name: "NICE OKPOS",
    url: "https://nice.okpos.co.kr/",
    portalName: "NICE OKPOS 가맹점 포털",
    reportsSupported: [
      { id: "daily_summary", name: "일별종합 (매출관리 > 일자별매출)", format: "XLS", verified: true },
      { id: "daily_menu", name: "일자별 상품별 (매출관리 > 상품별매출)", format: "XLS", verified: true },
      { id: "receipt_detail", name: "영수증별 상세 (매출관리 > 영수증별상세)", format: "XLS", verified: true },
      { id: "timeslot", name: "시간대별 매출 (매출분석 > 시간대별)", format: "XLS", verified: true }
    ],
    apiStatus: "API_UNVERIFIED_ACCOUNT_XLS_VERIFIED", // 공식 ERP API 계정지원 미확인, XLS 다운로드 실증 완료
    notes: "신영웅 성서점 계정에서 일별종합, 일자별 상품별, 영수증별 상세 XLS 다운로드 실제 작동 검증 완료"
  },
  OKASP_OKPOS: {
    id: "OKASP_OKPOS",
    name: "OKASP OKPOS",
    url: "https://okasp.okpos.co.kr/",
    portalName: "OKASP 웹 포털",
    reportsSupported: [
      { id: "daily_summary", name: "일별종합 (매출 > 일별매출집계)", format: "XLS", verified: false },
      { id: "daily_menu", name: "일자별 상품별 (매출 > 상품별매출)", format: "XLS", verified: false },
      { id: "receipt_detail", name: "영수증별 상세 (매출 > 영수증상세조회)", format: "XLS", verified: false },
      { id: "timeslot", name: "시간대별 매출", format: "XLS", verified: false }
    ],
    apiStatus: "API_UNVERIFIED_ADAPTER_READY",
    notes: "OKASP 어댑터 파서 개발 완료, 계정 자격증명 등록 대기"
  },
  EASYPOS: {
    id: "EASYPOS",
    name: "EasyPOS",
    url: "https://smart.easypos.net/index.jsp",
    portalName: "EasyPOS 스마트 포털",
    reportsSupported: [
      { id: "daily_summary", name: "일별 매출 (정산 > 일자별집계)", format: "XLS", verified: false },
      { id: "daily_menu", name: "상품별 매출 (정산 > 품목별집계)", format: "XLS", verified: false },
      { id: "receipt_detail", name: "영수증 거래내역", format: "XLS", verified: false }
    ],
    apiStatus: "API_UNVERIFIED_ADAPTER_READY",
    notes: "EasyPOS 스마트 어댑터 준비 완료, Web/API 인증 대기"
  }
};

export const STORES_MASTER = [
  {
    id: "store-1",
    name: "포크팬 복현",
    officialName: "포크팬 복현점",
    posSite: "NICE OKPOS",
    posSystemId: "NICE_OKPOS",
    posUrl: "https://nice.okpos.co.kr/",
    posStoreCode: "PP_BOKHYEON_01",
    aliases: ["포크팬 복현", "포크팬 복현점", "포크팬", "복현점", "PP_BOKHYEON_01"],
    category: "고기 무한리필",
    businessHours: "11:00 ~ 23:30 (마감정산 24:00)",
    closedDays: "연중무휴",
    openDate: "2021-04-15",
    posAdapterStatus: "READY", // "VERIFIED" | "READY" | "PENDING_CREDENTIALS"
    hasMidnightShift: false, // 24시 마감
    deliveryChannels: ["홀 82%", "포장 6%", "배달의민족 12%"],
    notes: "NICE 규격 어댑터 장착 완료, 접속 계정 등록 대기"
  },
  {
    id: "store-2",
    name: "고기9단",
    officialName: "고기9단 본점",
    posSite: "OKASP OKPOS",
    posSystemId: "OKASP_OKPOS",
    posUrl: "https://okasp.okpos.co.kr/",
    posStoreCode: "GOGI_9DAN_01",
    aliases: ["고기9단", "고기9단 본점", "고기구단", "GOGI_9DAN_01"],
    category: "소고기 전문점",
    businessHours: "11:30 ~ 22:00",
    closedDays: "매주 월요일",
    openDate: "2020-09-01",
    posAdapterStatus: "READY",
    hasMidnightShift: false,
    deliveryChannels: ["홀 94%", "포장 6%"],
    notes: "OKASP 규격 어댑터 장착 완료, 계정 등록 대기"
  },
  {
    id: "store-3",
    name: "들안길금등어 본점(들안길)",
    officialName: "들안길금등어 본점",
    posSite: "EasyPOS",
    posSystemId: "EASYPOS",
    posUrl: "https://smart.easypos.net/index.jsp",
    posStoreCode: "EASY_GEUMD_01",
    aliases: ["들안길금등어 본점(들안길)", "들안길금등어 본점", "들안길금등어", "들안길", "금등어", "EASY_GEUMD_01"],
    category: "화덕 고등어구이",
    businessHours: "11:00 ~ 21:30",
    closedDays: "연중무휴",
    openDate: "2022-03-10",
    posAdapterStatus: "READY",
    hasMidnightShift: false,
    deliveryChannels: ["홀 78%", "포장 14%", "배달의민족 8%"],
    notes: "EasyPOS 스마트 어댑터 준비 완료, Web/API 인증 대기"
  },
  {
    id: "store-4",
    name: "신영웅청국장해물뚝배기 성서점",
    officialName: "신영웅청국장해물뚝배기 성서점",
    posSite: "NICE OKPOS",
    posSystemId: "NICE_OKPOS",
    posUrl: "https://nice.okpos.co.kr/",
    posStoreCode: "N34995", // POS 매장코드 N34995 및 SYW_SEONGSEO_01 매핑 관리
    aliases: [
      "신영웅청국장해물뚝배기 성서점", 
      "신영웅청국장해물뚝배기", 
      "신영웅성서", 
      "신영웅 성서", 
      "신영웅청국장", 
      "신영웅", 
      "N34995", 
      "SYW_SEONGSEO_01"
    ],
    category: "한식 전문점",
    businessHours: "07:00 ~ 21:00",
    closedDays: "매주 일요일",
    openDate: "2019-11-20",
    posAdapterStatus: "VERIFIED", // 실제 일별종합, 상품별, 영수증별 XLS 다운로드 작동 확인
    hasMidnightShift: false,
    deliveryChannels: ["홀 68%", "배달의민족 22%", "쿠팡이츠 10%"],
    notes: "NICE 계정 실증 완료 (POS 매장코드 N34995, 일별종합, 일자별 상품별, 영수증별 상세 XLS 다운로드 검증 완료)"
  },
  {
    id: "store-5",
    name: "금막창 종로",
    officialName: "금막창 종로점",
    posSite: "OKASP OKPOS",
    posSystemId: "OKASP_OKPOS",
    posUrl: "https://okasp.okpos.co.kr/",
    posStoreCode: "GMC_JONGRO_01",
    aliases: ["금막창 종로", "금막창 종로점", "금막창종로", "종로점", "GMC_JONGRO_01"],
    category: "막창 전문점",
    businessHours: "16:30 ~ 익일 02:00 (심야영업)",
    closedDays: "연중무휴",
    openDate: "2022-07-01",
    posAdapterStatus: "READY",
    hasMidnightShift: true, // 익일 02:00 마감 정산 보정 필요
    deliveryChannels: ["홀 88%", "포장 4%", "배달의민족 8%"],
    notes: "OKASP 규격 연동 준비 완료, 심야영업(익일 02시) 마감반영 규칙 적용"
  },
  {
    id: "store-6",
    name: "금막창 월성",
    officialName: "금막창 월성점",
    posSite: "OKASP OKPOS",
    posSystemId: "OKASP_OKPOS",
    posUrl: "https://okasp.okpos.co.kr/",
    posStoreCode: "GMC_WOLSEONG_01",
    aliases: ["금막창 월성", "금막창 월성점", "금막창월성", "월성점", "GMC_WOLSEONG_01"],
    category: "막창 전문점",
    businessHours: "16:30 ~ 익일 01:30 (심야영업)",
    closedDays: "연중무휴",
    openDate: "2023-01-15",
    posAdapterStatus: "READY",
    hasMidnightShift: true,
    deliveryChannels: ["홀 86%", "포장 5%", "배달의민족 9%"],
    notes: "OKASP 규격 연동 준비 완료"
  },
  {
    id: "store-7",
    name: "금막창 범어점",
    officialName: "금막창 범어점",
    posSite: "NICE OKPOS",
    posSystemId: "NICE_OKPOS",
    posUrl: "https://nice.okpos.co.kr/",
    posStoreCode: "GMC_BEOMEO_01",
    aliases: ["금막창 범어점", "금막창 범어", "금막창범어", "범어점", "GMC_BEOMEO_01"],
    category: "막창 전문점",
    businessHours: "17:00 ~ 익일 02:00 (심야영업)",
    closedDays: "연중무휴",
    openDate: "2023-06-20",
    posAdapterStatus: "READY",
    hasMidnightShift: true,
    deliveryChannels: ["홀 91%", "포장 3%", "배달의민족 6%"],
    notes: "NICE 규격 어댑터 장착 완료"
  }
];

// 공통 메뉴 매핑 마스터 (서로 다른 매장 표기명을 체인 표준 메뉴로 연결)
export const DEFAULT_COMMON_MENU_MAPPINGS = [
  {
    commonId: "CM-001",
    standardName: "돼지막창 (150g)",
    category: "구이류",
    aliases: ["바삭 돼지막창(150g)", "바삭 돼지막창", "돼지막창", "생돼지막창", "원조 돼지막창"],
    costPrice: 4200, // 원가
    targetSellingPrice: 12000
  },
  {
    commonId: "CM-002",
    standardName: "소막창 (150g)",
    category: "구이류",
    aliases: ["쫄깃 소막창(150g)", "쫄깃 소막창", "소막창", "특상 소막창"],
    costPrice: 5800,
    targetSellingPrice: 15000
  },
  {
    commonId: "CM-003",
    standardName: "직화 불막창 (150g)",
    category: "구이류",
    aliases: ["직화 불막창(150g)", "불막창", "매운 불막창"],
    costPrice: 4800,
    targetSellingPrice: 13000
  },
  {
    commonId: "CM-004",
    standardName: "날치알 주먹밥",
    category: "식사류",
    aliases: ["날치알 주먹밥", "셀프 날치알 주먹밥", "주먹밥"],
    costPrice: 900,
    targetSellingPrice: 4000
  },
  {
    commonId: "CM-005",
    standardName: "얼큰 김치말이국수",
    category: "식사류",
    aliases: ["얼큰 김치말이국수", "김치말이국수", "시원한 김치말이국수"],
    costPrice: 1500,
    targetSellingPrice: 6000
  },
  {
    commonId: "CM-006",
    standardName: "참이슬 소주",
    category: "주류",
    aliases: ["참이슬", "참이슬 소주", "참이슬 후레쉬", "소주 (참이슬)"],
    costPrice: 1750,
    targetSellingPrice: 5000
  },
  {
    commonId: "CM-007",
    standardName: "테라 / 켈리 맥주",
    category: "주류",
    aliases: ["테라", "테라 맥주", "켈리", "테라 병맥주"],
    costPrice: 1850,
    targetSellingPrice: 5000
  },
  {
    commonId: "CM-008",
    standardName: "화덕 고등어구이 정식",
    category: "식사/정식",
    aliases: ["화덕 고등어구이 정식", "고등어구이 정식", "고등어 정식"],
    costPrice: 4800,
    targetSellingPrice: 14000
  },
  {
    commonId: "CM-009",
    standardName: "직화 제육볶음 정식",
    category: "식사/정식",
    aliases: ["직화 제육볶음 정식", "제육볶음 정식", "뚝배기 제육볶음"],
    costPrice: 4100,
    targetSellingPrice: 13000
  },
  {
    commonId: "CM-010",
    standardName: "영웅 청국장 정식",
    category: "식사/찌개",
    aliases: ["영웅 청국장 정식", "영웅청국장", "청국장 정식"],
    costPrice: 2800,
    targetSellingPrice: 10000
  },
  {
    commonId: "CM-011",
    standardName: "해물 뚝배기",
    category: "식사/찌개",
    aliases: ["해물 뚝배기", "해물뚝배기 정식", "얼큰 해물뚝배기"],
    costPrice: 3900,
    targetSellingPrice: 12000
  },
  {
    commonId: "CM-012",
    standardName: "삼겹살 무한리필",
    category: "무한리필",
    aliases: ["삼겹살 무한리필", "성인 무한리필", "포크팬 무한리필"],
    costPrice: 9800,
    targetSellingPrice: 24900
  },
  {
    commonId: "CM-013",
    standardName: "9단 꽃갈비살 (200g)",
    category: "구이류",
    aliases: ["9단 꽃갈비살(200g)", "꽃갈비살", "특선 꽃갈비살"],
    costPrice: 13500,
    targetSellingPrice: 32000
  }
];

export function getStoreById(storeId) {
  return STORES_MASTER.find(s => s.id === storeId) || null;
}

export function findCommonMenu(rawMenuName) {
  if (!rawMenuName) return null;
  const cleanName = rawMenuName.trim();
  for (const mapping of DEFAULT_COMMON_MENU_MAPPINGS) {
    if (mapping.standardName === cleanName) return mapping;
    if (mapping.aliases.some(alias => cleanName.includes(alias) || alias.includes(cleanName))) {
      return mapping;
    }
  }
  return null;
}

/**
 * Accurately matches store by POS code, official name, store name, or registered aliases.
 * E.g. "신영웅성서_2026-10-01_2026-10-11_메뉴매출.xls" -> store-4 (신영웅청국장해물뚝배기 성서점)
 */
export function matchStoreFromFileName(fileName, storesList = STORES_MASTER) {
  if (!fileName) return { store: null, matchReason: "파일명 없음" };
  const cleanName = String(fileName).replace(/\.[^/.]+$/, "").trim();

  // 1. Exact POS Code match
  for (const s of storesList) {
    if (s.posStoreCode && cleanName.includes(s.posStoreCode)) {
      return { store: s, matchReason: `POS 매장코드(${s.posStoreCode}) 일치` };
    }
  }

  // 2. Full official name match
  for (const s of storesList) {
    if (s.officialName && cleanName.includes(s.officialName)) {
      return { store: s, matchReason: `정식 매장명(${s.officialName}) 일치` };
    }
    if (s.name && cleanName.includes(s.name)) {
      return { store: s, matchReason: `매장명(${s.name}) 일치` };
    }
  }

  // 3. Aliases match (sorted by length descending for specificity)
  const allAliases = [];
  storesList.forEach(s => {
    const list = s.aliases || [];
    // Also check STORES_MASTER if s from state doesn't have aliases
    const masterStore = STORES_MASTER.find(m => m.id === s.id || m.name === s.name);
    const combinedAliases = Array.from(new Set([...list, ...(masterStore?.aliases || [])]));
    combinedAliases.forEach(alias => {
      allAliases.push({ alias, store: s });
    });
  });
  allAliases.sort((a, b) => b.alias.length - a.alias.length);

  for (const item of allAliases) {
    if (cleanName.includes(item.alias)) {
      return { store: item.store, matchReason: `매장 별칭(${item.alias}) 일치` };
    }
  }

  return { store: null, matchReason: "일치하는 매장 없음 (수동 선택 필요)" };
}

