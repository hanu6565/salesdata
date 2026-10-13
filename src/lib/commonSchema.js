// src/lib/commonSchema.js
// POS별 원본 보관 및 공통 데이터 저장 구조 명세 및 정규화 유틸리티

export const DATA_STATUS = {
  SECURED: "SECURED",           // 확보 완료
  UNACQUIRED: "UNACQUIRED",     // 미확보 (원천 POS에서 제공되지 않거나 수집되지 않음 - 절대 임의 조작 금지)
  TRUE_ZERO: "TRUE_ZERO",       // 실제 0원 / 0건 (영업했으나 해당 결제/메뉴 실적이 없음)
  NOT_APPLICABLE: "NOT_APPLICABLE" // 해당 매장 미운영 (예: 배달 미운영)
};

/**
 * 1. 매장 정보 스키마
 */
export function normalizeStore(raw) {
  return {
    internalId: raw.id || raw.internalId,
    posSite: raw.posSite || raw.posSystemId || "미확보",
    originalStoreCode: raw.posStoreCode || raw.originalStoreCode || "미확보",
    officialStoreName: raw.officialName || raw.name,
    category: raw.category || "일반음식점",
    businessHours: raw.businessHours || "미확보",
    closedDays: raw.closedDays || "미확보",
    openDate: raw.openDate || "미확보",
    posAdapterStatus: raw.posAdapterStatus || "READY"
  };
}

/**
 * 2. 일별종합 스키마
 * 영업일, 총매출, 할인, 실매출, 공급가액, 부가세, 영수증 건수, 결제수단별 금액, 채널별 금액
 */
export function normalizeDailySummary(raw) {
  const isZero = raw.netSales === 0 && raw.receiptCount === 0;
  
  return {
    id: `${raw.storeId}_${raw.date}`,
    date: raw.date, // YYYY-MM-DD
    storeId: raw.storeId,
    storeName: raw.storeName || "",
    
    // 금액 필드
    totalSales: Number(raw.totalSales ?? raw.total_sales ?? 0),
    discount: Number(raw.discount ?? 0),
    netSales: Number(raw.netSales ?? raw.net_sales ?? 0),
    supplyValue: raw.supplyValue !== undefined ? Number(raw.supplyValue) : Math.round((raw.netSales || 0) / 1.1),
    vat: raw.vat !== undefined ? Number(raw.vat) : (raw.netSales || 0) - Math.round((raw.netSales || 0) / 1.1),
    receiptCount: Number(raw.receiptCount ?? raw.receipt_count ?? 0),

    // 결제수단별 금액 (제공되지 않으면 UNACQUIRED 표시)
    payments: {
      card: raw.payments?.card !== undefined ? Number(raw.payments.card) : (raw.cardSales !== undefined ? Number(raw.cardSales) : null),
      cash: raw.payments?.cash !== undefined ? Number(raw.payments.cash) : (raw.cashSales !== undefined ? Number(raw.cashSales) : null),
      easyPay: raw.payments?.easyPay !== undefined ? Number(raw.payments.easyPay) : (raw.easyPaySales !== undefined ? Number(raw.easyPaySales) : null),
      other: raw.payments?.other !== undefined ? Number(raw.payments.other) : null,
      isCardSecured: raw.payments?.card !== undefined || raw.cardSales !== undefined,
      isCashSecured: raw.payments?.cash !== undefined || raw.cashSales !== undefined
    },

    // 주문 채널별 (홀, 포장, 배달 - 배민, 요기요, 쿠팡이츠)
    channels: {
      hall: raw.channels?.hall !== undefined ? Number(raw.channels.hall) : null,
      takeout: raw.channels?.takeout !== undefined ? Number(raw.channels.takeout) : null,
      delivery: raw.channels?.delivery !== undefined ? Number(raw.channels.delivery) : null,
      deliveryApps: raw.channels?.deliveryApps || {
        baemin: null,
        yogiyo: null,
        coupangEats: null
      },
      isChannelSecured: !!raw.channels
    },

    // 상태 메타데이터: 실제 0원 vs 미확보 vs 정상 확보
    dataStatus: isZero ? DATA_STATUS.TRUE_ZERO : (raw.isUnacquired ? DATA_STATUS.UNACQUIRED : DATA_STATUS.SECURED),
    sourceType: raw.sourceType || "POS_DAILY_REPORT",
    updatedAt: raw.updatedAt || new Date().toISOString()
  };
}

/**
 * 3. 일자별 메뉴 스키마
 * 원본 메뉴 코드·명, 분류, 수량, 총매출, 할인, 실매출, 공통메뉴 매핑, 아이템 분류
 */
export function normalizeDailyMenu(raw, commonMapping = null) {
  return {
    id: `${raw.storeId}_${raw.date}_${raw.itemCode || raw.itemName}`,
    date: raw.date,
    storeId: raw.storeId,
    storeName: raw.storeName || "",
    originalItemCode: raw.itemCode || raw.originalItemCode || "미확보",
    originalItemName: raw.itemName || raw.originalItemName,
    category: raw.category || "기타",
    
    // 수량 및 금액
    quantity: Number(raw.quantity || 0),
    totalSales: Number(raw.totalSales ?? raw.total_sales ?? 0),
    discount: Number(raw.discount ?? 0),
    netSales: Number(raw.netSales ?? raw.net_sales ?? 0),
    
    // 아이템 성격 분류 (정상메뉴 / 옵션 / 서비스 / 증정)
    itemType: raw.itemType || (
      (raw.itemName || "").includes("옵션") || (raw.itemName || "").includes("추가") ? "OPTION" :
      (raw.itemName || "").includes("서비스") || (raw.discount > 0 && raw.netSales === 0) ? "SERVICE" :
      (raw.itemName || "").includes("증정") || (raw.totalSales === 0 && raw.quantity > 0) ? "GIVEAWAY" : "NORMAL"
    ),

    // 체인 공통 메뉴 매핑
    commonMenuId: commonMapping ? commonMapping.commonId : (raw.commonMenuId || null),
    commonMenuName: commonMapping ? commonMapping.standardName : (raw.commonMenuName || null),
    hasCommonMapping: !!commonMapping || !!raw.commonMenuId,

    // 단가 (실판매 평균단가)
    avgUnitPrice: (raw.quantity > 0) ? Math.round((raw.netSales || 0) / raw.quantity) : 0,

    timeSlot: raw.timeSlot || "all",
    grade: raw.grade || null // A, B, C (ABC분석 시)
  };
}

/**
 * 4. 영수증 상세 스키마
 * 영업일, POS번호, 영수증번호, 주문·결제 시각, 거래 상태, 메뉴 상세
 */
export function normalizeReceiptDetail(raw) {
  return {
    receiptId: raw.receiptId || `${raw.storeId}_${raw.date}_${raw.posNo || '01'}_${raw.receiptNo}`,
    date: raw.date,
    storeId: raw.storeId,
    storeName: raw.storeName || "",
    posNo: raw.posNo || "01",
    receiptNo: String(raw.receiptNo || "0001"),
    orderTime: raw.orderTime || null, // HH:mm:ss 또는 ISO
    payTime: raw.payTime || null,
    
    // 거래 상태 (NORMAL: 정상승인, CANCELED: 취소, PARTIAL_REFUND: 부분취소)
    status: raw.status || "NORMAL",
    originalReceiptId: raw.originalReceiptId || null,

    // 결제 총액
    totalAmount: Number(raw.totalAmount || raw.netSales || 0),
    paymentType: raw.paymentType || "신용카드",
    channel: raw.channel || "홀", // 홀 / 포장 / 배달

    // 메뉴 상세 목록
    items: Array.isArray(raw.items) ? raw.items.map(item => ({
      itemCode: item.code || item.itemCode || "미확보",
      itemName: item.name || item.itemName,
      quantity: Number(item.quantity || item.qty || 1),
      unitPrice: Number(item.price || item.unitPrice || 0),
      netSales: Number(item.netSales || (item.quantity * item.price) || 0),
      isOption: !!item.isOption,
      isService: !!item.isService
    })) : []
  };
}

/**
 * 5. 취소·반품 스키마
 * 원거래 연결, 처리 시각, 수량·금액, 전체·부분 취소 구분
 */
export function normalizeCancelReturn(raw) {
  return {
    cancelId: raw.cancelId || `CANCEL_${raw.originalReceiptId || raw.receiptId}_${Date.now()}`,
    date: raw.date,
    storeId: raw.storeId,
    originalReceiptId: raw.originalReceiptId || "미확보",
    processedTime: raw.processedTime || raw.cancelTime || new Date().toISOString(),
    cancelType: raw.cancelType || (raw.isPartial ? "PARTIAL" : "FULL"), // FULL(전체취소) | PARTIAL(부분취소)
    quantity: Number(raw.quantity || 1),
    amount: Number(raw.amount || raw.cancelAmount || 0),
    reason: raw.reason || "고객 단순변심 또는 결제수단 변경"
  };
}

/**
 * 6. 수집 이력 스키마
 * 원본 파일 또는 API 출처, 수집 시각, 조회 기간, 성공·실패·불완전 상태
 */
export function normalizeCollectionHistory(raw) {
  return {
    historyId: raw.historyId || `HIST_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    storeId: raw.storeId,
    storeName: raw.storeName,
    sourceType: raw.sourceType, // "FILE_UPLOAD" | "NICE_XLS_AUTO" | "OKASP_XLS_AUTO" | "EASYPOS_XLS_AUTO" | "MY_OKPOS_ERP_API"
    collectedAt: raw.collectedAt || new Date().toISOString(),
    queryPeriod: {
      start: raw.queryPeriod?.start || raw.period || "",
      end: raw.queryPeriod?.end || raw.period || ""
    },
    // SUCCESS (성공), FAILURE (실패), INCOMPLETE (불완전 - 일부 일자/필드 미확보)
    status: raw.status || "SUCCESS",
    errorMessage: raw.errorMessage || null,
    userActionRequired: raw.userActionRequired || null, // 예: "2차 인증(OTP) 필요", "비밀번호 만료"
    rowCount: Number(raw.rowCount || 0),
    unacquiredFields: raw.unacquiredFields || [], // 미확보된 필드 목록
    rawFileStoragePath: raw.rawFileStoragePath || null // 원본 파일 보관 경로
  };
}
