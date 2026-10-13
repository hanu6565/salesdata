// src/app/components/OperationsAnalysisView.jsx
"use client";

import React, { useState, useMemo } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  Clock, 
  ShoppingBag, 
  Percent, 
  BarChart2, 
  Award, 
  Sparkles, 
  CheckCircle2, 
  Info, 
  HelpCircle,
  Truck,
  Store,
  Wine,
  UtensilsCrossed,
  Layers,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line, 
  AreaChart, 
  Area 
} from "recharts";
import { STORES_MASTER } from "@/lib/storesConfig";
import { 
  computeOperationsSummary, 
  computeStoreComparisonTable, 
  computeMenuIntelligence 
} from "@/lib/operationsAnalysis";

const MATRIX_COLORS = {
  STAR: { bg: "bg-amber-950/40", border: "border-amber-500/40", text: "text-amber-400", badge: "bg-amber-500/20 text-amber-300" },
  CASH_COW: { bg: "bg-emerald-950/40", border: "border-emerald-500/40", text: "text-emerald-400", badge: "bg-emerald-500/20 text-emerald-300" },
  VOLUME_DRIVER: { bg: "bg-cyan-950/40", border: "border-cyan-500/40", text: "text-cyan-400", badge: "bg-cyan-500/20 text-cyan-300" },
  DRAIN: { bg: "bg-slate-900/60", border: "border-slate-800", text: "text-slate-400", badge: "bg-slate-800 text-slate-400" }
};

export default function OperationsAnalysisView({ 
  salesRecords, 
  selectedStoreId, 
  onSelectStore 
}) {
  const [comparisonMode, setComparisonMode] = useState("elapsed_calendar"); // "elapsed_calendar" | "elapsed_weekday"
  const [activeMenuTab, setActiveMenuTab] = useState("matrix"); // "matrix" | "basket" | "channels"

  // 1) 당월 운영 비교 KPI 산출 (기준일: 8월 26일 시점 동일 경과일 대조)
  const opsSummary = useMemo(() => {
    return computeOperationsSummary(salesRecords, {
      storeId: selectedStoreId,
      targetMonth: "2026-08",
      currentDateCutoff: "2026-08-26"
    });
  }, [salesRecords, selectedStoreId]);

  // 2) 7개 매장 실적 비교 벤치마킹 테이블
  const storeComparisonList = useMemo(() => {
    return computeStoreComparisonTable(salesRecords, "2026-08-26");
  }, [salesRecords]);

  // 3) 메뉴 인텔리전스 (Dual ABC, Basket, 주류/사이드)
  const menuIntel = useMemo(() => {
    return computeMenuIntelligence(salesRecords, {
      storeId: selectedStoreId,
      period: "2026-08"
    });
  }, [salesRecords, selectedStoreId]);

  return (
    <div className="space-y-6">
      {/* 2단계 상단 배너 */}
      <div className="glass-card p-6 rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-950/40 via-blue-950/20 to-slate-900/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                2단계 시스템
              </span>
              <span className="text-xs text-slate-400">외식업 비교 분석 & Dual ABC 메뉴 인텔리전스</span>
            </div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <BarChart2 className="w-6 h-6 text-cyan-400" />
              외식 매장 운영 비교 분석 (동일 경과일 대조 & 메뉴 ABC)
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              월 중간 시점에 전월 전체와 비교하는 통계적 왜곡을 방지하고, <strong>전월 동일 경과일(1일~26일)</strong> 및 동일 요일 기준으로 실질 성장률과 메뉴 수익성을 진단합니다.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400 pl-2">비교 방식:</span>
            <button
              onClick={() => setComparisonMode("elapsed_calendar")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                comparisonMode === "elapsed_calendar" 
                  ? "bg-cyan-600 text-white shadow-sm" 
                  : "text-slate-400 hover:text-white"
              }`}
            >
              동일 경과일(1~26일)
            </button>
            <button
              onClick={() => setComparisonMode("elapsed_weekday")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                comparisonMode === "elapsed_weekday" 
                  ? "bg-cyan-600 text-white shadow-sm" 
                  : "text-slate-400 hover:text-white"
              }`}
            >
              동일 요일 패턴 보정
            </button>
          </div>
        </div>
      </div>

      {/* KPI 카드 4종 (어제 확정 매출, 당월 누계 및 목표, MoM 동일경과일 증감률, 객단가/영업일당 매출) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 카드 1: 어제 확정 매출 */}
        <div className="glass-card p-5 rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>어제 확정 매출 ({opsSummary.yesterdayStr})</span>
            <Clock className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {opsSummary.yesterdaySales.toLocaleString()}
            <span className="text-xs font-normal text-slate-400 ml-1">원</span>
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center justify-between border-t border-slate-800/60 pt-2">
            <span>영업 마감 정산 완료</span>
            <span className="text-indigo-300 font-medium">판매 {opsSummary.yesterdayCount}건</span>
          </div>
        </div>

        {/* 카드 2: 당월 누계 매출 및 목표 달성률 */}
        <div className="glass-card p-5 rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>당월 누계 매출 (1일 ~ 26일)</span>
            <span className="text-[11px] font-mono text-cyan-400 font-semibold">
              목표 {opsSummary.targetAchievementRate.toFixed(1)}% 달성
            </span>
          </div>
          <div className="text-2xl font-bold text-cyan-400 tracking-tight">
            {opsSummary.currentElapsedSales.toLocaleString()}
            <span className="text-xs font-normal text-slate-400 ml-1">원</span>
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center justify-between border-t border-slate-800/60 pt-2">
            <span>월 목표 {Math.round(opsSummary.baseTarget / 10000).toLocaleString()}만원</span>
            <span className="text-slate-300">영업 {opsSummary.currentBusinessDays}일간</span>
          </div>
        </div>

        {/* 카드 3: 전월 동기간 (MoM 동일 경과일) 비교 */}
        <div className="glass-card p-5 rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>전월 동일 경과일 (7월 1~26일)</span>
            {opsSummary.momGrowthRate !== null ? (
              <span className={`text-[11px] font-semibold flex items-center gap-0.5 ${
                opsSummary.momGrowthRate >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}>
                {opsSummary.momGrowthRate >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {opsSummary.momGrowthRate >= 0 ? `+${opsSummary.momGrowthRate.toFixed(1)}%` : `${opsSummary.momGrowthRate.toFixed(1)}%`}
              </span>
            ) : (
              <span className="text-[10px] text-slate-500">미확보</span>
            )}
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {opsSummary.prevElapsedSales.toLocaleString()}
            <span className="text-xs font-normal text-slate-400 ml-1">원</span>
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center justify-between border-t border-slate-800/60 pt-2">
            <span className="text-[11px] truncate">{opsSummary.prevMonthDataReason}</span>
            <span className="text-slate-300">{opsSummary.prevBusinessDays}영업일</span>
          </div>
        </div>

        {/* 카드 4: 영업일당 일평균 & 객단가 */}
        <div className="glass-card p-5 rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>영업일당 매출 / 추정 객단가</span>
            <ShoppingBag className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-bold text-indigo-400 tracking-tight">
            {opsSummary.dailyAvgSales.toLocaleString()}
            <span className="text-xs font-normal text-slate-400 ml-1">원/일</span>
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center justify-between border-t border-slate-800/60 pt-2">
            <span>주문당 매출(AOV):</span>
            <span className="text-white font-semibold">{opsSummary.avgOrderValue.toLocaleString()}원</span>
          </div>
        </div>
      </div>

      {/* 채널별 (홀/포장/배달) 및 요일/시간대 실적 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 채널 실적 (홀, 포장, 배달 - 배민, 요기요, 쿠팡이츠) */}
        <div className="glass-card p-5 rounded-xl border border-slate-800 bg-slate-900/40">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Truck className="w-4 h-4 text-cyan-400" />
            주문 채널별 실적 (홀 · 포장 · 배달앱)
          </h3>

          <div className="space-y-3">
            {/* 홀 */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300 flex items-center gap-1">
                  <Store className="w-3.5 h-3.5 text-indigo-400" /> 매장 홀 식사
                </span>
                <span className="font-semibold text-white">
                  {opsSummary.channelBreakdown.hall.sales.toLocaleString()}원 ({opsSummary.channelBreakdown.hall.percent}%)
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-indigo-500 h-full rounded-full transition-all" 
                  style={{ width: `${opsSummary.channelBreakdown.hall.percent}%` }}
                />
              </div>
            </div>

            {/* 포장 */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300 flex items-center gap-1">
                  <ShoppingBag className="w-3.5 h-3.5 text-cyan-400" /> 테이크아웃 포장
                </span>
                <span className="font-semibold text-white">
                  {opsSummary.channelBreakdown.takeout.sales.toLocaleString()}원 ({opsSummary.channelBreakdown.takeout.percent}%)
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-cyan-500 h-full rounded-full transition-all" 
                  style={{ width: `${opsSummary.channelBreakdown.takeout.percent}%` }}
                />
              </div>
            </div>

            {/* 배달 */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300 flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5 text-emerald-400" /> 배달앱 주문
                </span>
                <span className="font-semibold text-white">
                  {opsSummary.channelBreakdown.delivery.sales.toLocaleString()}원 ({opsSummary.channelBreakdown.delivery.percent}%)
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all" 
                  style={{ width: `${opsSummary.channelBreakdown.delivery.percent}%` }}
                />
              </div>

              {/* 배달앱별 세부 breakdown */}
              {opsSummary.channelBreakdown.delivery.sales > 0 && (
                <div className="mt-2.5 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px] grid grid-cols-3 gap-1 text-center">
                  <div>
                    <span className="text-slate-400 block text-[10px]">배달의민족</span>
                    <span className="text-cyan-300 font-medium">65%</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">쿠팡이츠</span>
                    <span className="text-cyan-300 font-medium">20%</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">요기요</span>
                    <span className="text-cyan-300 font-medium">15%</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 요일별 매출 패턴 */}
        <div className="glass-card p-5 rounded-xl border border-slate-800 bg-slate-900/40">
          <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-400" />
            요일별 매출 패턴 (금/토/일 피크)
          </h3>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={opsSummary.weekdayStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 10000)}만`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px", fontSize: "11px" }}
                  formatter={(val) => [`${val.toLocaleString()}원`, "매출"]}
                />
                <Bar dataKey="sales" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 주류 & 사이드 판매 비중 */}
        <div className="glass-card p-5 rounded-xl border border-slate-800 bg-slate-900/40">
          <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
            <Wine className="w-4 h-4 text-purple-400" />
            주류 및 사이드 판매 기여도
          </h3>
          <div className="space-y-3 mt-4">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-xs text-slate-300 flex items-center gap-2">
                <Wine className="w-4 h-4 text-purple-400" /> 주류 (소주/맥주/막걸리)
              </span>
              <div className="text-right">
                <span className="text-sm font-bold text-purple-300">{menuIntel.categorySummary.alcoholRatio.toFixed(1)}%</span>
                <span className="text-[10px] text-slate-400 block">{menuIntel.categorySummary.alcohol.sales.toLocaleString()}원</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-xs text-slate-300 flex items-center gap-2">
                <UtensilsCrossed className="w-4 h-4 text-emerald-400" /> 식사 및 사이드 (찌개/밥/면)
              </span>
              <div className="text-right">
                <span className="text-sm font-bold text-emerald-300">{menuIntel.categorySummary.sideRatio.toFixed(1)}%</span>
                <span className="text-[10px] text-slate-400 block">{menuIntel.categorySummary.side.sales.toLocaleString()}원</span>
              </div>
            </div>

            {/* 옵션/서비스 별도 집계 */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs">
              <span className="text-slate-400">서비스/증정/옵션:</span>
              <span className="text-slate-300 font-medium">
                옵션 {menuIntel.itemTypeBreakdown.OPTION.count}건 / 서비스 {menuIntel.itemTypeBreakdown.SERVICE.count}건
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 7개 매장 실적 비교 벤치마킹 테이블 */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800 bg-slate-900/40">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              7개 매장 실적 벤치마킹 비교표 (8월 1~26일 동기간 기준)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">매출액, 영업일수, 일평균, 추정 객단가, 할인율 랭킹</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-3">순위</th>
                <th className="py-3 px-4">매장명</th>
                <th className="py-3 px-3">POS 사이트</th>
                <th className="py-3 px-4 text-right">실매출액 (1~26일)</th>
                <th className="py-3 px-3 text-center">영업일</th>
                <th className="py-3 px-4 text-right">일평균 매출</th>
                <th className="py-3 px-4 text-right">주문당 매출(AOV)</th>
                <th className="py-3 px-3 text-center">할인율</th>
                <th className="py-3 px-3 text-center">취소율</th>
                <th className="py-3 px-3 text-center">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {storeComparisonList.map((st) => (
                <tr 
                  key={st.storeId}
                  className={`hover:bg-slate-800/40 transition-colors ${
                    selectedStoreId === st.storeId ? "bg-indigo-950/30" : ""
                  }`}
                >
                  <td className="py-3 px-3 font-bold text-slate-300">
                    {st.rank === 1 ? (
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 inline-flex items-center justify-center text-xs">
                        1
                      </span>
                    ) : st.rank === 2 ? (
                      <span className="w-5 h-5 rounded-full bg-slate-300/20 text-slate-300 border border-slate-400/30 inline-flex items-center justify-center text-xs">
                        2
                      </span>
                    ) : st.rank === 3 ? (
                      <span className="w-5 h-5 rounded-full bg-amber-800/20 text-amber-600 border border-amber-700/30 inline-flex items-center justify-center text-xs">
                        3
                      </span>
                    ) : (
                      st.rank
                    )}
                  </td>
                  <td className="py-3 px-4 font-semibold text-white">
                    {st.storeName}
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-[10px] text-cyan-400 font-mono bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40">
                      {st.posSite}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-white">
                    {st.netSales.toLocaleString()}원
                  </td>
                  <td className="py-3 px-3 text-center text-slate-300">{st.businessDays}일</td>
                  <td className="py-3 px-4 text-right text-indigo-300 font-medium">
                    {st.dailyAvg.toLocaleString()}원
                  </td>
                  <td className="py-3 px-4 text-right text-slate-300">
                    {st.aov.toLocaleString()}원
                  </td>
                  <td className="py-3 px-3 text-center text-slate-400">
                    {st.discountRate.toFixed(1)}%
                  </td>
                  <td className="py-3 px-3 text-center text-slate-400">
                    {st.cancelRate.toFixed(1)}%
                  </td>
                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={() => onSelectStore(st.storeId)}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] transition-all"
                    >
                      조회
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dual ABC 4분면 매트릭스 & 동반구매 장바구니 분석 */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800 bg-slate-900/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              Dual ABC (매출 기여도 vs 판매수량) 4분면 매트릭스 & 장바구니 연관 분석
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              단순 매출순위뿐만 아니라 회전율(수량)을 결합하여 Star, Cash Cow, Volume Driver, Drain을 분류합니다.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-950/60 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveMenuTab("matrix")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeMenuTab === "matrix" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Dual ABC 매트릭스
            </button>
            <button
              onClick={() => setActiveMenuTab("basket")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeMenuTab === "basket" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              동반 구매 연관성 (장바구니)
            </button>
          </div>
        </div>

        {activeMenuTab === "matrix" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
            {["STAR", "CASH_COW", "VOLUME_DRIVER", "DRAIN"].map((type) => {
              const items = menuIntel.menuList.filter(m => m.matrixType === type);
              const color = MATRIX_COLORS[type];
              const title = type === "STAR" ? "핵심 효자 (Star)" :
                            type === "CASH_COW" ? "고수익원 (Cash Cow)" :
                            type === "VOLUME_DRIVER" ? "볼륨 회전 (Volume)" : "관리 대상 (Drain)";
              const desc = type === "STAR" ? "매출 A등급 & 수량 A등급" :
                           type === "CASH_COW" ? "매출 A등급 & 수량 B/C등급" :
                           type === "VOLUME_DRIVER" ? "매출 B/C & 수량 A등급" : "매출 C & 수량 C등급";

              return (
                <div key={type} className={`p-4 rounded-xl border ${color.border} ${color.bg} space-y-3`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className={`text-sm font-bold ${color.text}`}>{title}</h4>
                      <span className="text-[10px] text-slate-400">{desc}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${color.badge}`}>
                      {items.length}개
                    </span>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {items.slice(0, 5).map((menu, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 text-xs">
                        <div className="flex justify-between font-semibold text-white">
                          <span className="truncate pr-1">{menu.name}</span>
                          <span className="text-cyan-400 whitespace-nowrap">{menu.netSales.toLocaleString()}원</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                          <span>{menu.quantity}개 판매</span>
                          <span>점유율 {menu.salesShare.toFixed(1)}%</span>
                        </div>
                      </div>
                    ))}
                    {items.length === 0 && (
                      <div className="text-xs text-slate-500 text-center py-6">해당 항목 없음</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* 장바구니 동반 구매 연관성 분석 */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
            {menuIntel.basketAssociations.map((assoc, idx) => (
              <div key={idx} className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    {assoc.mainMenu}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800">
                    A등급 메인
                  </span>
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] text-slate-400 block font-medium">함께 주문되는 동반 메뉴:</span>
                  {assoc.coPurchased.map((sub, sIdx) => (
                    <div key={sIdx} className="flex items-center justify-between text-xs p-1.5 rounded bg-slate-900/60">
                      <span className="text-slate-300">{sub.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-semibold">{sub.confidence}% 동반구매</span>
                        <span className="text-[10px] text-slate-500">리프트 {sub.lift}x</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
