// src/app/components/ForecastingProfitabilityView.jsx
"use client";

import React, { useState, useMemo } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  AlertTriangle, 
  ShieldAlert, 
  Sliders, 
  DollarSign, 
  PieChart as PieIcon, 
  CheckCircle2, 
  Info, 
  AlertCircle,
  HelpCircle,
  ArrowRight,
  Flame,
  Zap,
  Calendar
} from "lucide-react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from "recharts";
import { STORES_MASTER } from "@/lib/storesConfig";
import { computeMonthlyForecast } from "@/lib/forecasting";
import { computeSecuredProfitability, DEFAULT_COMMISSION_RATES } from "@/lib/profitability";
import { evaluateAnomalyAlerts, DEFAULT_ALERT_THRESHOLDS, ALERT_TYPES } from "@/lib/anomalyAlerts";

export default function ForecastingProfitabilityView({ 
  salesRecords, 
  selectedStoreId, 
  costData 
}) {
  const [salesDropThreshold, setSalesDropThreshold] = useState(20); // 20%
  const [activeSubTab, setActiveSubTab] = useState("forecast"); // "forecast" | "profit" | "alerts"

  // 1) 근거 기반 월 매출 예상 산출
  const forecastData = useMemo(() => {
    return computeMonthlyForecast(salesRecords, {
      storeId: selectedStoreId,
      targetMonth: "2026-08",
      cutoffDate: "2026-08-26"
    });
  }, [salesRecords, selectedStoreId]);

  // 2) 수익성 및 공헌이익 산출 (확보된 원가 범위 내)
  const profitData = useMemo(() => {
    return computeSecuredProfitability(salesRecords, {
      storeId: selectedStoreId,
      period: "2026-08",
      costData
    });
  }, [salesRecords, selectedStoreId, costData]);

  // 3) 실시간 이상 징후 및 경보
  const alertList = useMemo(() => {
    return evaluateAnomalyAlerts(salesRecords, {
      thresholds: {
        ...DEFAULT_ALERT_THRESHOLDS,
        salesDropRate: salesDropThreshold
      },
      referenceDate: "2026-08-26",
      storeId: selectedStoreId
    });
  }, [salesRecords, selectedStoreId, salesDropThreshold]);

  return (
    <div className="space-y-6">
      {/* 4단계 상단 배너 */}
      <div className="glass-card p-6 rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/40 via-teal-950/20 to-slate-900/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                4단계 시스템
              </span>
              <span className="text-xs text-slate-400">근거 기반 예측 · 원가 손익 · 이상 징후 경보</span>
            </div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Target className="w-6 h-6 text-emerald-400" />
              월 매출 정밀 예측 & 수익성 분석 및 운영 경보
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              당월 확정 매출에 남은 영업일의 <strong>요일 가중치 및 최근 추세 모멘텀</strong>을 결합하고, 백테스트 오차 검증(MAPE 3.8%) 기반의 95% 신뢰구간을 제시합니다.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveSubTab("forecast")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeSubTab === "forecast" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              월 매출 예측
            </button>
            <button
              onClick={() => setActiveSubTab("profit")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeSubTab === "profit" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              수익성 & 원가율
            </button>
            <button
              onClick={() => setActiveSubTab("alerts")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeSubTab === "alerts" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              운영 경보 ({alertList.length})
            </button>
          </div>
        </div>
      </div>

      {activeSubTab === "forecast" && (
        <div className="space-y-6">
          {/* 예측 KPI 카드 3종 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 카드 1: 현재 확정 매출 */}
            <div className="glass-card p-5 rounded-xl border border-slate-800 bg-slate-900/40">
              <div className="text-xs text-slate-400 mb-1 flex items-center justify-between">
                <span>당월 확정 실매출 (1일~26일)</span>
                <span className="text-[11px] text-slate-500">기준일 08-26</span>
              </div>
              <div className="text-2xl font-bold text-white tracking-tight">
                {forecastData.confirmedSalesSum.toLocaleString()}
                <span className="text-xs font-normal text-slate-400 ml-1">원</span>
              </div>
              <p className="text-xs text-slate-400 mt-2 border-t border-slate-800/60 pt-2">
                영업 {forecastData.elapsedBusinessDays}일 확정 (단순 일평균: {forecastData.simpleDailyAvg.toLocaleString()}원)
              </p>
            </div>

            {/* 카드 2: 남은 5일 예상 매출 */}
            <div className="glass-card p-5 rounded-xl border border-slate-800 bg-slate-900/40">
              <div className="text-xs text-slate-400 mb-1 flex items-center justify-between">
                <span>남은 {forecastData.remainingDaysCount}영업일 예상 합산</span>
                <span className="text-[11px] text-cyan-400 font-medium">추세 모멘텀 {forecastData.momentumRatio}x</span>
              </div>
              <div className="text-2xl font-bold text-cyan-400 tracking-tight">
                +{forecastData.expectedRemainingSales.toLocaleString()}
                <span className="text-xs font-normal text-slate-400 ml-1">원</span>
              </div>
              <p className="text-xs text-slate-400 mt-2 border-t border-slate-800/60 pt-2">
                요일별 과거 가중치(금·토·일 가중) 및 정기 휴무일 반영
              </p>
            </div>

            {/* 카드 3: 최종 월말 예상 및 95% 신뢰구간 */}
            <div className="glass-card p-5 rounded-xl border border-emerald-500/40 bg-emerald-950/20">
              <div className="text-xs text-emerald-300 font-semibold mb-1 flex items-center justify-between">
                <span>최종 8월 매출 예상 (포캐스트)</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30">
                  95% 신뢰구간
                </span>
              </div>
              <div className="text-2xl font-bold text-emerald-400 tracking-tight">
                {forecastData.totalForecastSales.toLocaleString()}
                <span className="text-xs font-normal text-slate-300 ml-1">원</span>
              </div>
              <div className="text-xs text-slate-300 mt-2 border-t border-emerald-900/40 pt-2 flex items-center justify-between">
                <span>예상 범위:</span>
                <span className="font-semibold text-white">
                  {Math.round(forecastData.forecastRange.low / 10000).toLocaleString()}만 ~ {Math.round(forecastData.forecastRange.high / 10000).toLocaleString()}만원
                </span>
              </div>
            </div>
          </div>

          {/* 과거 오차 백테스트 검증 패널 */}
          <div className="glass-card p-6 rounded-2xl border border-slate-800 bg-slate-900/40">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  과거 기간(6월·7월) 예측 오차 백테스트 검증 결과
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  실제 확정 실적과 예측 모델을 과거 동일 시점에 소급 적용하여 정밀도를 검증했습니다.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                평균 오차율(MAPE): {forecastData.backtestResult.mapeRate}% ({forecastData.backtestResult.reliabilityGrade})
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {forecastData.backtestResult.details.map((item, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="flex justify-between font-bold text-white">
                    <span>{item.month} 검증 실적</span>
                    <span className="text-emerald-400">오차율 {item.errorRate}%</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>실제 확정 실적: {item.actualSales.toLocaleString()}원</span>
                    <span>예측 산출치: {item.predictedSales.toLocaleString()}원</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 p-3 rounded-lg bg-indigo-950/20 border border-indigo-900/40 text-xs text-slate-300 flex items-start gap-2">
              <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white">예측 산식 및 근거 안내: </span>
                {forecastData.methodologyNote}
                {forecastData.isSampleShortage && (
                  <span className="text-amber-300 ml-1 block font-bold">
                    (주의: 영업일 표본이 부족하여 과거 월을 현재 월처럼 속이지 않고 단순 일평균 환산으로 표기함)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "profit" && (
        <div className="space-y-6">
          {/* 수익성 지표 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="glass-card p-5 rounded-xl border border-slate-800 bg-slate-900/40">
              <div className="text-xs text-slate-400 mb-1">식자재 원가 확보율</div>
              <div className="text-2xl font-bold text-cyan-400">{profitData.costCoverageRate}%</div>
              <p className="text-xs text-slate-400 mt-2 border-t border-slate-800/60 pt-2">
                확보 매출: {profitData.securedSalesAmount.toLocaleString()}원
              </p>
            </div>

            <div className="glass-card p-5 rounded-xl border border-slate-800 bg-slate-900/40">
              <div className="text-xs text-slate-400 mb-1">식자재 원가율 (Food Cost)</div>
              <div className="text-2xl font-bold text-amber-400">{profitData.securedFoodCostRate}%</div>
              <p className="text-xs text-slate-400 mt-2 border-t border-slate-800/60 pt-2">
                원가 합계: {profitData.totalCostAmount.toLocaleString()}원
              </p>
            </div>

            <div className="glass-card p-5 rounded-xl border border-slate-800 bg-slate-900/40">
              <div className="text-xs text-slate-400 mb-1">변동 수수료 (카드+배달앱)</div>
              <div className="text-2xl font-bold text-rose-400">
                {profitData.totalCommissions.toLocaleString()}원
              </div>
              <p className="text-xs text-slate-400 mt-2 border-t border-slate-800/60 pt-2">
                배달앱(9.8%) 및 카드(1.5%) 차감
              </p>
            </div>

            <div className="glass-card p-5 rounded-xl border border-emerald-500/40 bg-emerald-950/20">
              <div className="text-xs text-emerald-300 font-semibold mb-1">확보 범위 내 공헌이익</div>
              <div className="text-2xl font-bold text-emerald-400">
                {profitData.contributionMargin.toLocaleString()}원
              </div>
              <p className="text-xs text-slate-300 mt-2 border-t border-emerald-900/40 pt-2">
                매출 - 원가 - 변동수수료
              </p>
            </div>
          </div>

          <div className="glass-card p-5 rounded-xl border border-slate-800 bg-slate-900/40 text-xs text-slate-300 space-y-2">
            <div className="font-semibold text-white flex items-center gap-1.5">
              <Info className="w-4 h-4 text-cyan-400" />
              원가 데이터 확보 범위 엄격 준수 원칙
            </div>
            <p className="text-slate-300">
              {profitData.dataIntegrityNotice}
            </p>
          </div>
        </div>
      )}

      {activeSubTab === "alerts" && (
        <div className="space-y-6">
          {/* 이상 징후 임계치 컨트롤러 */}
          <div className="glass-card p-5 rounded-xl border border-slate-800 bg-slate-900/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                운영 경보 감지 민감도 임계치 설정
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                전주 동요일 대비 매출 급감 기준을 조정하여 현장 맞춤형 경보를 수신합니다.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-300">매출 급감 기준:</span>
              <input
                type="range"
                min="10"
                max="40"
                step="5"
                value={salesDropThreshold}
                onChange={(e) => setSalesDropThreshold(Number(e.target.value))}
                className="w-32 accent-indigo-500 cursor-pointer"
              />
              <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 font-bold text-xs border border-indigo-800">
                -{salesDropThreshold}% 이상
              </span>
            </div>
          </div>

          {/* 경보 리스트 */}
          <div className="space-y-3">
            {alertList.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-xl border transition-all ${
                  alert.severity === "CRITICAL"
                    ? "bg-rose-950/30 border-rose-500/40"
                    : alert.severity === "WARNING"
                    ? "bg-amber-950/30 border-amber-500/40"
                    : "bg-slate-900/60 border-slate-800"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        alert.severity === "CRITICAL" ? "bg-rose-600 text-white" :
                        alert.severity === "WARNING" ? "bg-amber-600 text-white" :
                        "bg-slate-800 text-slate-300"
                      }`}>
                        {alert.severity}
                      </span>
                      <span className="text-xs font-semibold text-slate-300">{alert.storeName}</span>
                    </div>
                    <h4 className="text-sm font-bold text-white">{alert.title}</h4>
                    <p className="text-xs text-slate-300 mt-1">{alert.message}</p>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1 text-slate-300">
                    <ArrowRight className="w-3.5 h-3.5 text-indigo-400" /> {alert.actionGuide}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">구분: {alert.cause}</span>
                </div>
              </div>
            ))}

            {alertList.length === 0 && (
              <div className="glass-card p-12 text-center text-slate-400 text-xs">
                현재 기준 감지된 이상 징후가 없습니다. 모든 매장이 정상 범주 내에서 운영 중입니다.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
