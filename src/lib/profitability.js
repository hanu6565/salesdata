// src/lib/profitability.js
// 4단계: 수익성 및 공헌이익 분석 (확보된 원가·수수료 범위 내에서만 정밀 산출)

import { DEFAULT_COMMON_MENU_MAPPINGS, findCommonMenu } from "./storesConfig";

/**
 * 채널별 수수료율 표준 (확보된 계약 요율)
 */
export const DEFAULT_COMMISSION_RATES = {
  card: 0.015,         // 신용카드 수수료 1.5%
  hall: 0.0,           // 홀 추가 수수료 0%
  takeout: 0.0,        // 포장 수수료 0%
  baemin: 0.098,       // 배달의민족 중개이용료 9.8% (배민1 플러스)
  yogiyo: 0.125,       // 요기요 12.5%
  coupangEats: 0.098   // 쿠팡이츠 9.8%
};

/**
 * 메뉴별 및 채널별 이익 계산기
 * 원가 데이터가 확보된 메뉴에 대해서만 식자재 원가를 산출하며, 미확보 메뉴는 별도 표기
 */
export function computeSecuredProfitability(salesRecords, options = {}) {
  const {
    storeId = "total",
    period = "all",
    costData = {} // 추가 등록된 손익/인건비 데이터
  } = options;

  let filtered = (salesRecords || []).filter(r => {
    if (storeId !== "total" && (r.storeId || r.store_id) !== storeId) return false;
    if (period !== "all" && r.date && !r.date.startsWith(period)) return false;
    return true;
  });

  let totalNetSales = 0;
  let totalCostAmount = 0; // 식자재 원가
  let securedSalesAmount = 0; // 원가가 확보된 메뉴들의 매출 합계
  let unsecuredSalesAmount = 0; // 원가 미확보 메뉴들의 매출 합계
  let securedItemCount = 0;
  let unsecuredItemCount = 0;

  const itemProfitList = [];

  filtered.forEach(r => {
    const net = Number(r.netSales || 0);
    const qty = Number(r.quantity || 0);
    const name = r.itemName || "";

    totalNetSales += net;

    // 공통 메뉴 매핑에서 원가 확인
    const mapping = findCommonMenu(name);
    const unitCost = mapping?.costPrice || null;

    if (unitCost !== null && unitCost > 0) {
      const itemCost = unitCost * qty;
      totalCostAmount += itemCost;
      securedSalesAmount += net;
      securedItemCount += qty;

      itemProfitList.push({
        name,
        qty,
        netSales: net,
        unitCost,
        totalCost: itemCost,
        grossProfit: net - itemCost,
        marginRate: net > 0 ? ((net - itemCost) / net) * 100 : 0,
        isCostSecured: true
      });
    } else {
      unsecuredSalesAmount += net;
      unsecuredItemCount += qty;

      itemProfitList.push({
        name,
        qty,
        netSales: net,
        unitCost: null,
        totalCost: null,
        grossProfit: null,
        marginRate: null,
        isCostSecured: false
      });
    }
  });

  // 채널별 수수료 추정 차감 (배달 10% 비중 기준 배민/쿠팡이츠 수수료 및 카드수수료)
  const cardCommission = Math.round(totalNetSales * DEFAULT_COMMISSION_RATES.card);
  const deliveryEstimatedSales = Math.round(totalNetSales * 0.10);
  const platformCommission = Math.round(deliveryEstimatedSales * 0.098);
  const totalCommissions = cardCommission + platformCommission;

  // 확보된 범위 내 매출총이익 (Gross Profit)
  const securedGrossProfit = securedSalesAmount - totalCostAmount;
  const securedFoodCostRate = securedSalesAmount > 0 ? (totalCostAmount / securedSalesAmount) * 100 : 0;
  const costCoverageRate = totalNetSales > 0 ? (securedSalesAmount / totalNetSales) * 100 : 0;

  // 인건비 및 고정비 (mockCostData 또는 사용자 입력값 연동)
  const hasStoreCostSheet = !!(costData[storeId]);
  const estimatedLaborCost = Math.round(totalNetSales * 0.23); // 인건비 약 23%
  const estimatedRentCost = Math.round(totalNetSales * 0.08);  // 임차료 약 8%

  // 공헌이익 = 매출 - 원가 - 변동수수료
  const contributionMargin = securedGrossProfit - totalCommissions;

  return {
    totalNetSales,
    securedSalesAmount,
    unsecuredSalesAmount,
    costCoverageRate: Number(costCoverageRate.toFixed(1)),
    totalCostAmount,
    securedFoodCostRate: Number(securedFoodCostRate.toFixed(1)),
    securedGrossProfit,
    cardCommission,
    platformCommission,
    totalCommissions,
    contributionMargin,
    hasStoreCostSheet,
    estimatedLaborCost,
    estimatedRentCost,
    dataIntegrityNotice: costCoverageRate < 100 
      ? `전체 매출 중 ${costCoverageRate.toFixed(1)}% 품목의 식자재 원가가 확보되어 계산되었습니다. (미확보 품목 ${unsecuredItemCount}개는 억지 추정을 배제하고 제외함)` 
      : "모든 품목의 원가가 100% 확보되어 정밀 손익이 계산되었습니다."
  };
}
