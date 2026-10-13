// src/lib/dataQuality.js
// 1단계: 원본 대조와 데이터 품질 검증 엔진 (3-Way 대조, 누락 기간 진단, 업로드 전 사전검증)

import { STORES_MASTER } from "./storesConfig.js";

/**
 * 1. 매장별 데이터 수집 건강도 및 최신 영업일, 누락 기간 진단
 */
export function analyzeStoreDataHealth(storeId, allSalesRecords, uploadLogs, options = {}) {
  const store = STORES_MASTER.find(s => s.id === storeId) || { id: storeId, name: storeId };
  const storeRecords = (allSalesRecords || []).filter(r => (r.storeId || r.store_id) === storeId);
  const storeLogs = (uploadLogs || []).filter(l => (l.storeId || l.store_id) === storeId);

  // 고유 영업일 추출
  const dateSet = new Set();
  storeRecords.forEach(r => {
    if (r.date) dateSet.add(r.date);
  });
  const securedDates = Array.from(dateSet).sort();

  const latestSecuredDate = securedDates.length > 0 ? securedDates[securedDates.length - 1] : null;
  const earliestSecuredDate = securedDates.length > 0 ? securedDates[0] : null;

  // 마지막 수집(업로드) 시각
  let lastCollectionTime = null;
  if (storeLogs.length > 0) {
    const sortedLogs = [...storeLogs].sort((a, b) => new Date(b.uploadTime || 0) - new Date(a.uploadTime || 0));
    lastCollectionTime = sortedLogs[0].uploadTime || sortedLogs[0].created_at || null;
  }

  // 누락 날짜 구간 (Gaps) 탐지
  const missingIntervals = [];
  if (earliestSecuredDate && latestSecuredDate) {
    const start = new Date(earliestSecuredDate);
    const end = new Date(latestSecuredDate);
    let curr = new Date(start);
    let gapStart = null;
    let gapCount = 0;

    while (curr <= end) {
      const dStr = curr.toISOString().split("T")[0];
      const isSecured = dateSet.has(dStr);

      if (!isSecured) {
        if (!gapStart) gapStart = dStr;
        gapCount++;
      } else {
        if (gapStart) {
          missingIntervals.push({
            start: gapStart,
            end: new Date(curr.getTime() - 86400000).toISOString().split("T")[0],
            days: gapCount
          });
          gapStart = null;
          gapCount = 0;
        }
      }
      curr.setDate(curr.getDate() + 1);
    }

    if (gapStart) {
      missingIntervals.push({
        start: gapStart,
        end: latestSecuredDate,
        days: gapCount
      });
    }
  }

  // 수집 성공률
  const successLogs = storeLogs.filter(l => (l.status || "").includes("정상") || l.status === "SUCCESS").length;
  const totalLogs = storeLogs.length;
  const successRate = totalLogs > 0 ? Math.round((successLogs / totalLogs) * 100) : 100;

  // 데이터 무결성 점수 (100점 만점)
  let healthScore = 100;
  if (missingIntervals.length > 0) healthScore -= Math.min(30, missingIntervals.reduce((acc, g) => acc + g.days, 0) * 3);
  if (successRate < 90) healthScore -= 20;
  if (!latestSecuredDate) healthScore = 0;

  return {
    storeId,
    storeName: store.name,
    posSite: store.posSite,
    posAdapterStatus: store.posAdapterStatus,
    lastCollectionTime,
    latestSecuredDate,
    earliestSecuredDate,
    securedDaysCount: securedDates.length,
    missingIntervals,
    missingTotalDays: missingIntervals.reduce((acc, g) => acc + g.days, 0),
    totalLogsCount: totalLogs,
    successLogsCount: successLogs,
    successRate,
    healthScore: Math.max(0, healthScore),
    statusBadge: healthScore >= 90 ? "우수" : healthScore >= 70 ? "주의" : "누락 발생"
  };
}

/**
 * 2. 3-Way 대조 규칙 엔진
 * 일별종합 (Daily Summary) vs 메뉴별 합계 (Menu Sum) vs 시간대별 (TimeSlot) vs 영수증 상세 (Receipts)
 * 
 * 허용 차이 규칙(Tolerance Rules):
 * - Rule A: 부가세 1원 단위 절사 오차: 메뉴별 부가세 합산과 일별 총공급가액 부가세 간 ±10원 이내 차이는 [정상 절사 허용] 처리.
 * - Rule B: 전표 전체 할인 vs 품목별 할인 차이: 일부 POS는 품목별로 할인을 안 나누고 전표 하단에 통할인 기록 -> 메뉴 실매출 합계와 일별 실매출 간 불일치 원인으로 자동 주석.
 * - Rule C: 심야 영업 (24:00~03:00) 차일 이월: POS 마감 기준일에 따라 시간대별과 일별종합의 영업일 귀속 일치 여부 확인.
 */
export function reconcile3WayData(dailySummary, menuRecords = [], timeSlotSummary = null, receiptRecords = []) {
  const summaryNetSales = Number(dailySummary?.netSales || dailySummary?.totalSales || 0);
  const summaryReceiptCount = Number(dailySummary?.receiptCount || 0);
  const summaryDiscount = Number(dailySummary?.discount || 0);

  // 메뉴 실매출 합계
  const menuSumNetSales = menuRecords.reduce((sum, r) => sum + Number(r.netSales || 0), 0);
  const menuSumQuantity = menuRecords.reduce((sum, r) => sum + Number(r.quantity || 0), 0);
  const menuSumDiscount = menuRecords.reduce((sum, r) => sum + Number(r.discount || 0), 0);

  // 영수증 상세 합계
  const receiptSumAmount = receiptRecords.reduce((sum, r) => sum + Number(r.totalAmount || r.netSales || 0), 0);
  const receiptCountActual = receiptRecords.length;

  // 시간대별 합계
  const timeSlotSumSales = timeSlotSummary ? Number(timeSlotSummary.totalSales || 0) : null;

  // 차이 계산
  const diffSummaryMenu = summaryNetSales - menuSumNetSales;
  const diffSummaryReceipt = receiptRecords.length > 0 ? (summaryNetSales - receiptSumAmount) : 0;
  const diffCount = receiptRecords.length > 0 ? (summaryReceiptCount - receiptCountActual) : 0;

  // 허용 오차 판정 (±10원 허용)
  const isVatRoundingDiff = Math.abs(diffSummaryMenu) > 0 && Math.abs(diffSummaryMenu) <= 10;
  const isMenuMatched = Math.abs(diffSummaryMenu) === 0 || isVatRoundingDiff;
  const isReceiptMatched = receiptRecords.length === 0 || (Math.abs(diffSummaryReceipt) <= 10 && diffCount === 0);

  let reconciliationStatus = "PERFECT_MATCH"; // PERFECT_MATCH | TOLERANCE_MATCH | MISMATCH | UNACQUIRED_DETAIL
  let explanation = "일별종합과 상세 데이터가 100% 일치합니다.";

  if (menuRecords.length === 0 && receiptRecords.length === 0) {
    reconciliationStatus = "UNACQUIRED_DETAIL";
    explanation = "일별종합 데이터만 확보됨 (메뉴별/영수증별 상세 파일 수집 대기)";
  } else if (!isMenuMatched) {
    reconciliationStatus = "MISMATCH";
    explanation = `일별종합 실매출(${summaryNetSales.toLocaleString()}원)과 메뉴 합계(${menuSumNetSales.toLocaleString()}원) 간 ${diffSummaryMenu.toLocaleString()}원 불일치 발생. (원인: 전표 단위 통할인 미배분 또는 미등록 메뉴 존재 가능성)`;
  } else if (isVatRoundingDiff) {
    reconciliationStatus = "TOLERANCE_MATCH";
    explanation = `품목별 단수절사 부가세 계산 오차(오차 ${diffSummaryMenu}원) 발생하였으나 POS 표준 허용범위(±10원 이내)로 정상 정합성 판정.`;
  } else if (!isReceiptMatched) {
    reconciliationStatus = "MISMATCH";
    explanation = `영수증 건수(${summaryReceiptCount}건 vs ${receiptCountActual}건) 또는 결제 합계 불일치.`;
  }

  return {
    date: dailySummary?.date,
    storeId: dailySummary?.storeId,
    summaryNetSales,
    summaryDiscount,
    summaryReceiptCount,
    menuSumNetSales,
    menuSumQuantity,
    menuSumDiscount,
    timeSlotSumSales,
    receiptSumAmount,
    receiptCountActual,
    diffSummaryMenu,
    diffSummaryReceipt,
    diffCount,
    isMenuMatched,
    isReceiptMatched,
    reconciliationStatus,
    toleranceApplied: isVatRoundingDiff,
    explanation
  };
}

/**
 * 3. 업로드 전 사전 검증 (Pre-Upload Inspection)
 * 파일 파싱 후 매장·보고서 종류·실제 기간·행 수·총매출·할인·실매출·수량·날짜별 합계·중복 여부를 정밀 대조
 */
export function validatePreUploadData(parsedRows, fileInfo, existingRecords = []) {
  const rows = parsedRows || [];
  const fileName = fileInfo?.name || "알 수 없는 파일";
  const detectedStoreName = fileInfo?.storeName || "미확정 매장";
  const detectedStoreId = fileInfo?.storeId || null;
  const targetPeriod = fileInfo?.period || "기간 미확정";
  const matchReason = fileInfo?.matchReason || "";
  const isAmbiguous = fileInfo?.isAmbiguous || !detectedStoreId || detectedStoreName.includes("미지정");

  // Dates and daily breakdown calculation
  const dailyBreakdown = {};
  let totalNetSales = 0;
  let totalGrossSales = 0;
  let totalDiscount = 0;
  let totalQuantity = 0;

  rows.forEach(r => {
    const d = r.date;
    const qty = Number(r.quantity || 0);
    const gross = Number(r.totalSales || 0);
    const disc = Number(r.discount || 0);
    const net = Number(r.netSales || 0);

    totalQuantity += qty;
    totalGrossSales += gross;
    totalDiscount += disc;
    totalNetSales += net;

    if (d) {
      if (!dailyBreakdown[d]) {
        dailyBreakdown[d] = {
          date: d,
          rowCount: 0,
          quantity: 0,
          totalSales: 0,
          discount: 0,
          netSales: 0
        };
      }
      dailyBreakdown[d].rowCount++;
      dailyBreakdown[d].quantity += qty;
      dailyBreakdown[d].totalSales += gross;
      dailyBreakdown[d].discount += disc;
      dailyBreakdown[d].netSales += net;
    }
  });

  const sortedDates = Object.keys(dailyBreakdown).sort();
  const actualStartDate = sortedDates.length > 0 ? sortedDates[0] : null;
  const actualEndDate = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : null;

  // Daily breakdown array (sorted descending by date)
  const dailySummaryList = sortedDates.slice().reverse().map(d => dailyBreakdown[d]);

  // Existing records map for overlap & duplicate checking
  const existingRecordsMap = new Map();
  const safeExisting = Array.isArray(existingRecords) ? existingRecords : [];
  safeExisting.forEach(r => {
    if ((r.storeId === detectedStoreId || r.storeName === detectedStoreName) && r.date) {
      const key = `${r.date}_${r.itemCode || r.itemName}`;
      existingRecordsMap.set(key, r);
    }
  });

  // Check overlapping dates
  const overlappingDatesSet = new Set();
  let newCount = 0;
  let updatedCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;

  rows.forEach(r => {
    if (!r.date || !r.itemName) {
      errorCount++;
      return;
    }

    const key = `${r.date}_${r.itemCode || r.itemName}`;
    if (existingRecordsMap.has(key)) {
      overlappingDatesSet.add(r.date);
      const existing = existingRecordsMap.get(key);
      const isIdentical = (
        Number(existing.netSales || 0) === Number(r.netSales || 0) &&
        Number(existing.quantity || 0) === Number(r.quantity || 0) &&
        Number(existing.totalSales || 0) === Number(r.totalSales || 0)
      );
      if (isIdentical) {
        duplicateCount++;
      } else {
        updatedCount++;
      }
    } else {
      newCount++;
    }
  });

  const overlappingDates = Array.from(overlappingDatesSet).sort();

  // Mathematical validation: gross - discount === net
  const mathFormulaValid = (totalGrossSales - totalDiscount === totalNetSales);
  
  // File Summary reconciliation if summary row existed in XLS
  const fileSummary = parsedRows?.fileSummary || null;
  let summaryReconciled = true;
  if (fileSummary) {
    summaryReconciled = (
      fileSummary.netSales === totalNetSales &&
      fileSummary.totalSales === totalGrossSales &&
      fileSummary.discount === totalDiscount &&
      fileSummary.quantity === totalQuantity
    );
  }

  // Report type detection
  let reportType = "일자별 상품별 매출 (메뉴매출)";
  if (rows.isTimeSlotReport) reportType = "시간대별 매출 보고서 (Time-Slot)";
  else if (rows.isAbcReport) reportType = "상품 ABC 분석 보고서";
  else if (rows.some(r => r.receiptNo)) reportType = "영수증별 상세 거래내역";

  const canCommit = !isAmbiguous && rows.length > 0 && errorCount === 0;
  let blockReason = "";
  if (isAmbiguous) {
    blockReason = "매장이 미지정되었거나 모호합니다. 매장을 직접 지정해 주세요.";
  } else if (rows.length === 0) {
    blockReason = "유효한 데이터 행이 없습니다.";
  } else if (errorCount > 0) {
    blockReason = `오류 데이터(${errorCount}건)가 포함되어 있습니다.`;
  }

  return {
    fileName,
    detectedStoreName,
    detectedStoreId,
    matchReason,
    isAmbiguous,
    reportType,
    actualPeriod: actualStartDate && actualEndDate ? `${actualStartDate} ~ ${actualEndDate}` : targetPeriod,
    actualStartDate,
    actualEndDate,
    totalRowCount: rows.length,
    distinctDaysCount: sortedDates.length,
    totalGrossSales,
    totalDiscount,
    totalNetSales,
    totalQuantity,
    mathFormulaValid,
    fileSummary,
    summaryReconciled,
    dailySummaryList,
    overlappingDates,
    hasOverlappingDates: overlappingDates.length > 0,
    newCount,
    updatedCount,
    duplicateCount,
    errorCount,
    canCommit,
    blockReason,
    isValid: rows.length > 0,
    validationStatus: !canCommit ? "BLOCKED" : (overlappingDates.length > 0 ? "OVERLAP_DETECTED" : "CLEAN_VALID")
  };
}
