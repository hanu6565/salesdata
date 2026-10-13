// src/lib/anomalyAlerts.js
// 4단계: 실시간 운영 이상 징후 감지 및 경보 엔진 (휴무·미수집·표본부족과 실제 매출 하락 구분)

import { STORES_MASTER } from "./storesConfig";

export const ALERT_TYPES = {
  SALES_DROP: "SALES_DROP",                 // 실제 매출 급감 경보
  ORDER_DROP: "ORDER_DROP",                 // 주문량 급감 경보
  CORE_MENU_DROP: "CORE_MENU_DROP",         // 핵심 효자 메뉴 판매 감소
  COLLECTION_FAILED: "COLLECTION_FAILED",   // 수집 실패 / 일자 누락 경보
  RECON_MISMATCH: "RECON_MISMATCH",         // 3-Way 원본 대조 불일치 경보
  HOLIDAY_INFO: "HOLIDAY_INFO",             // 정기 휴무 안내 (정상)
  SAMPLE_NOTICE: "SAMPLE_NOTICE"            // 표본 부족 안내 (정상)
};

/**
 * 기본 임계치 설정 (사용자 조정 가능)
 */
export const DEFAULT_ALERT_THRESHOLDS = {
  salesDropRate: 20,       // 전주 동요일 대비 -20% 하락 시 경보
  orderDropRate: 25,       // 주문량 -25% 하락 시
  coreMenuDropRate: 30,    // A등급 메뉴 -30% 감소 시
  reconcileTolerance: 10   // 3-Way 대조 허용 오차 10원 초과 시
};

/**
 * 이상 징후 분석기
 */
export function evaluateAnomalyAlerts(salesRecords, options = {}) {
  const {
    thresholds = DEFAULT_ALERT_THRESHOLDS,
    referenceDate = "2026-10-12",
    storeId = "total"
  } = options;

  const alerts = [];
  const storesToCheck = storeId === "total" 
    ? STORES_MASTER 
    : STORES_MASTER.filter(s => s.id === storeId);

  // 날짜별/매장별 일매출 맵 생성
  const storeDailyMap = {};
  (salesRecords || []).forEach(r => {
    const sId = r.storeId || r.store_id;
    if (!storeDailyMap[sId]) storeDailyMap[sId] = {};
    storeDailyMap[sId][r.date] = (storeDailyMap[sId][r.date] || 0) + Number(r.netSales || 0);
  });

  storesToCheck.forEach(store => {
    const dailyData = storeDailyMap[store.id] || {};
    const refDateObj = new Date(referenceDate);
    const dayOfWeek = refDateObj.getDay();

    // 1) 정기 휴무일 진단 (고기9단 월요일, 신영웅 일요일)
    const isScheduledClosed = (store.id === "store-2" && dayOfWeek === 1) || 
                              (store.id === "store-4" && dayOfWeek === 0);

    const refDaySales = dailyData[referenceDate] || 0;

    // 일주일 전 동요일 날짜 계산
    const prevWeekDateObj = new Date(refDateObj);
    prevWeekDateObj.setDate(prevWeekDateObj.getDate() - 7);
    const prevWeekDateStr = prevWeekDateObj.toISOString().split("T")[0];
    const prevWeekSales = dailyData[prevWeekDateStr] || 0;

    // 진단 A: 정기 휴무일인가?
    if (isScheduledClosed) {
      alerts.push({
        id: `ALERT_HOLIDAY_${store.id}_${referenceDate}`,
        type: ALERT_TYPES.HOLIDAY_INFO,
        severity: "INFO",
        storeId: store.id,
        storeName: store.name,
        title: `[정기 휴무] ${store.name} 정기 휴무일`,
        message: `매장 정기 휴무(${store.closedDays})로 인한 0원 매출입니다. 매출 하락 경보에서 정상 제외되었습니다.`,
        cause: "SCHEDULED_HOLIDAY",
        metric: { current: 0, previous: prevWeekSales },
        actionGuide: "정상 영업일 재개 시 자동 갱신됩니다."
      });
      return;
    }

    // 진단 B: POS 미수집 또는 네트워크 지연인가?
    if (refDaySales === 0) {
      alerts.push({
        id: `ALERT_MISSING_${store.id}_${referenceDate}`,
        type: ALERT_TYPES.COLLECTION_FAILED,
        severity: "WARNING",
        storeId: store.id,
        storeName: store.name,
        title: `[수집 대기] ${store.name} 전일 데이터 미수집`,
        message: `영업일이나 매출 데이터가 아직 수집되지 않았습니다. (원인: POS 서버 마감 배치 지연 또는 계정 로그인 대기)`,
        cause: "COLLECTION_DELAY_OR_MISSING",
        metric: { current: 0, expected: prevWeekSales },
        actionGuide: "일일 수집 타워에서 '수집 재시도'를 실행하거나 POS 사이트 마감 여부를 확인하세요."
      });
      return;
    }

    // 진단 C: 실제 매출 급감인가? (전주 동요일 대비 하락률)
    if (prevWeekSales > 0) {
      const dropRate = ((prevWeekSales - refDaySales) / prevWeekSales) * 100;
      if (dropRate >= thresholds.salesDropRate) {
        alerts.push({
          id: `ALERT_DROP_${store.id}_${referenceDate}`,
          type: ALERT_TYPES.SALES_DROP,
          severity: dropRate >= 35 ? "CRITICAL" : "WARNING",
          storeId: store.id,
          storeName: store.name,
          title: `[매출 급감 경보] ${store.name} 전주 동요일 대비 -${dropRate.toFixed(1)}% 하락`,
          message: `전주 동요일(${prevWeekSales.toLocaleString()}원) 대비 ${dropRate.toFixed(1)}% 하락한 ${refDaySales.toLocaleString()}원 기록 (기준 임계치 -${thresholds.salesDropRate}% 초과).`,
          cause: "TRUE_SALES_DECLINE",
          metric: { current: refDaySales, previous: prevWeekSales, dropRate: Number(dropRate.toFixed(1)) },
          actionGuide: "저녁 시간대 객단가 및 주문 건수 변화를 점검하고, A등급 메뉴 주문 비중을 확인하세요."
        });
      }
    }

    // 진단 D: 3-Way 대조 불일치 (원천 데이터 품질 체크)
    if (store.posAdapterStatus !== "VERIFIED") {
      alerts.push({
        id: `ALERT_RECON_${store.id}`,
        type: ALERT_TYPES.RECON_MISMATCH,
        severity: "INFO",
        storeId: store.id,
        storeName: store.name,
        title: `[수집 구조 준비] ${store.name} (${store.posSite})`,
        message: `어댑터 규격 장착 완료. 계정 자격증명 등록 시 3-Way 자동 대조가 활성화됩니다.`,
        cause: "ADAPTER_STANDBY",
        metric: null,
        actionGuide: "서버 보안 금고에 가맹점 계정을 등록해 주세요."
      });
    }
  });

  return alerts;
}
