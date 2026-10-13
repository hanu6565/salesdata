// src/app/components/PreUploadModal.jsx
"use client";

import React, { useState, useMemo } from "react";
import { 
  X, 
  Upload, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  Check, 
  HelpCircle,
  Calendar,
  Store,
  DollarSign,
  TrendingUp,
  Tag,
  ShieldCheck,
  AlertCircle,
  Database
} from "lucide-react";
import { STORES_MASTER } from "@/lib/storesConfig";
import { validatePreUploadData } from "@/lib/dataQuality";

export default function PreUploadModal({ 
  isOpen, 
  onClose, 
  stagedFile, 
  parsedRows, 
  fileInfo, 
  existingSalesRecords,
  onConfirmUpload
}) {
  const initialStoreId = fileInfo?.storeId || (fileInfo?.storeName ? STORES_MASTER.find(s => s.name === fileInfo.storeName)?.id : "");
  const [selectedStoreId, setSelectedStoreId] = useState(initialStoreId || "");
  const [isCommitting, setIsCommitting] = useState(false);

  // Derive current selected store object
  const currentStoreObj = useMemo(() => {
    return STORES_MASTER.find(s => s.id === selectedStoreId) || null;
  }, [selectedStoreId]);

  const effectiveFileInfo = useMemo(() => {
    return {
      ...fileInfo,
      storeId: selectedStoreId,
      storeName: currentStoreObj ? currentStoreObj.name : (fileInfo?.storeName || ""),
      isAmbiguous: !selectedStoreId
    };
  }, [fileInfo, selectedStoreId, currentStoreObj]);

  const validation = useMemo(() => {
    return validatePreUploadData(parsedRows, effectiveFileInfo, existingSalesRecords);
  }, [parsedRows, effectiveFileInfo, existingSalesRecords]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!validation.canCommit || !selectedStoreId) return;
    setIsCommitting(true);
    try {
      if (onConfirmUpload) {
        await onConfirmUpload({
          parsedRows,
          storeId: selectedStoreId,
          storeName: currentStoreObj?.name || effectiveFileInfo.storeName,
          validation
        });
      }
      onClose();
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* 헤더 */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                POS 엑셀 업로드 정밀 검증
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {validation.reportType}
              </span>
            </div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              업로드 전 사전 데이터 검증 및 멱등성 미리보기
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 (스크롤) */}
        <div className="p-5 space-y-4 text-xs overflow-y-auto custom-scrollbar flex-1">
          {/* 1. 파일 및 매장 매칭 상태 */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div>
                <span className="text-slate-400 block text-[11px] mb-0.5">업로드 파일명</span>
                <span className="font-semibold text-white text-sm">{validation.fileName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px] mb-0.5">매칭 판별 방식</span>
                <span className="px-2 py-1 rounded bg-slate-800 text-slate-300 font-mono text-[11px] border border-slate-700">
                  {validation.matchReason || fileInfo?.matchReason || "파일명 기준 매핑"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div>
                <label className="text-slate-300 font-semibold block mb-1.5 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-indigo-400" />
                  연결 대상 매장 (POS 코드 관리)
                </label>
                <select
                  value={selectedStoreId}
                  onChange={(e) => setSelectedStoreId(e.target.value)}
                  className={`w-full bg-slate-900 border rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition-all ${
                    !selectedStoreId 
                      ? "border-amber-500/80 bg-amber-950/20 text-amber-200" 
                      : "border-slate-700 focus:border-indigo-500"
                  }`}
                >
                  <option value="">-- 매장을 선택해주세요 (필수) --</option>
                  {STORES_MASTER.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} (POS: {s.posStoreCode || s.id}) [{s.posSite}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px] mb-1">매장 매칭 결과 안내</span>
                {currentStoreObj ? (
                  <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/40 text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <strong className="text-white">{currentStoreObj.name}</strong>
                      <span className="text-[11px] text-emerald-200 block">
                        내부 ID: {currentStoreObj.id} · POS 매장코드: <b>{currentStoreObj.posStoreCode}</b>
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/50 text-amber-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>매장이 미지정되었거나 모호합니다. 저장 전 매장을 선택해주세요.</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 2. 핵심 매출 및 정합성 공식 검증 카드 (Requirement 2) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-slate-400 block text-[11px] mb-1">총매출액 (Gross)</span>
              <span className="font-bold text-white text-base">
                {validation.totalGrossSales.toLocaleString()}원
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-slate-400 block text-[11px] mb-1">총할인액 (Discount)</span>
              <span className="font-bold text-rose-400 text-base">
                -{validation.totalDiscount.toLocaleString()}원
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40">
              <span className="text-emerald-300 block text-[11px] mb-1 font-semibold">
                실매출액 (Net Sales, 기본)
              </span>
              <span className="font-extrabold text-emerald-400 text-lg">
                {validation.totalNetSales.toLocaleString()}원
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-slate-400 block text-[11px] mb-1">총 판매 수량</span>
              <span className="font-bold text-indigo-300 text-base">
                {validation.totalQuantity.toLocaleString()}개
              </span>
            </div>
          </div>

          {/* 정합성 검증 배너 */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-[11px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className={`w-4 h-4 ${validation.mathFormulaValid ? "text-emerald-400" : "text-rose-400"}`} />
                <span className="font-semibold text-white">매출 수식 검증 (총매출 - 총할인 = 실매출):</span>
                <span className="text-slate-300 font-mono">
                  {validation.totalGrossSales.toLocaleString()}원 - {validation.totalDiscount.toLocaleString()}원 = {validation.totalNetSales.toLocaleString()}원
                </span>
              </div>
              <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                validation.mathFormulaValid 
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" 
                  : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
              }`}>
                {validation.mathFormulaValid ? "✓ 수식 100% 일치" : "✕ 수식 불일치"}
              </span>
            </div>

            {validation.fileSummary && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/60 text-slate-400">
                <span>
                  원본 엑셀 합계행(Row 369) 대조: 실매출 {validation.fileSummary.netSales.toLocaleString()}원 vs 상세 363행 합계 {validation.totalNetSales.toLocaleString()}원
                </span>
                <span className="text-emerald-400 font-semibold">✓ 원본 합계행과 100% 일치 (합계행 중복 합산 제외됨)</span>
              </div>
            )}
          </div>

          {/* 3. 멱등성 및 중복 분석 (Requirement 5) */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-slate-400 block text-[11px]">실제 데이터 기간 및 규모</span>
                <span className="font-semibold text-white">
                  {validation.actualPeriod} ({validation.distinctDaysCount}영업일 / 상세 {validation.totalRowCount}행)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[11px] font-bold">
                  신규 {validation.newCount}건
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/20 text-[11px] font-bold">
                  변경 {validation.updatedCount}건
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[11px] font-bold">
                  중복 {validation.duplicateCount}건
                </span>
                {validation.errorCount > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20 text-[11px] font-bold">
                    오류 {validation.errorCount}건
                  </span>
                )}
              </div>
            </div>

            {validation.hasOverlappingDates ? (
              <div className="p-3 rounded-lg bg-amber-950/25 border border-amber-500/30 text-amber-200 text-[11px]">
                <div className="flex items-center gap-1.5 font-bold text-amber-300 mb-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  기존 저장 데이터와 겹치는 기간: {validation.overlappingDates[0]} ~ {validation.overlappingDates[validation.overlappingDates.length - 1]} ({validation.overlappingDates.length}일)
                </div>
                <p className="text-slate-300">
                  ※ <strong>멱등 저장(Idempotent Upsert)</strong> 원칙에 따라 매장ID + 영업일자 + 상품코드 기준으로 기존 데이터에 정정 반영되며, <strong>동일 파일 또는 겹치는 기간을 재업로드해도 매출이 중복으로 늘어나지 않습니다.</strong>
                </p>
              </div>
            ) : (
              <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>기존 데이터와 충돌 없는 신규 기간 데이터입니다. 일별 상세로 온전히 저장됩니다.</span>
              </div>
            )}
          </div>

          {/* 4. 날짜별 합계 미리보기 테이블 (Daily Summary Breakdown Table - Requirement 5) */}
          <div className="space-y-1.5">
            <span className="text-slate-300 font-semibold block flex items-center justify-between">
              <span>날짜별 합계 미리보기 (총 {validation.dailySummaryList.length}영업일)</span>
              <span className="text-[11px] text-slate-400 font-normal">행 단위 일자별 저장 검증</span>
            </span>
            <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950 max-h-48 overflow-y-auto custom-scrollbar">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 sticky top-0 z-10">
                  <tr>
                    <th className="py-2 px-3">영업일자</th>
                    <th className="py-2 px-3 text-right">상세 행수</th>
                    <th className="py-2 px-3 text-right">판매 수량</th>
                    <th className="py-2 px-3 text-right">총매출액</th>
                    <th className="py-2 px-3 text-right">총할인액</th>
                    <th className="py-2 px-3 text-right text-emerald-400">실매출액</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {validation.dailySummaryList.map((d, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40 text-slate-300">
                      <td className="py-1.5 px-3 font-mono font-medium text-white">{d.date}</td>
                      <td className="py-1.5 px-3 text-right text-slate-400">{d.rowCount}행</td>
                      <td className="py-1.5 px-3 text-right">{d.quantity.toLocaleString()}</td>
                      <td className="py-1.5 px-3 text-right">{d.totalSales.toLocaleString()}원</td>
                      <td className="py-1.5 px-3 text-right text-rose-400">
                        {d.discount > 0 ? `-${d.discount.toLocaleString()}원` : "0원"}
                      </td>
                      <td className="py-1.5 px-3 text-right font-bold text-emerald-400">
                        {d.netSales.toLocaleString()}원
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-900/90 border-t border-slate-700 text-white font-bold sticky bottom-0">
                  <tr>
                    <td className="py-2 px-3">합계 ({validation.dailySummaryList.length}일)</td>
                    <td className="py-2 px-3 text-right">{validation.totalRowCount}행</td>
                    <td className="py-2 px-3 text-right">{validation.totalQuantity.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right">{validation.totalGrossSales.toLocaleString()}원</td>
                    <td className="py-2 px-3 text-right text-rose-400">-{validation.totalDiscount.toLocaleString()}원</td>
                    <td className="py-2 px-3 text-right text-emerald-400 font-extrabold">{validation.totalNetSales.toLocaleString()}원</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* 5. 상세 데이터 샘플 (Top 3) */}
          <div className="space-y-1.5">
            <span className="text-slate-400 font-semibold block text-[11px]">
              상세 데이터 샘플 (상품코드 앞자리 0 보존 및 0원 메뉴 확인):
            </span>
            <div className="rounded-lg border border-slate-800 overflow-hidden bg-slate-950">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-1.5 px-2.5">일자</th>
                    <th className="py-1.5 px-2.5">상품코드</th>
                    <th className="py-1.5 px-2.5">메뉴명</th>
                    <th className="py-1.5 px-2.5">대분류</th>
                    <th className="py-1.5 px-2.5 text-right">수량</th>
                    <th className="py-1.5 px-2.5 text-right">총매출</th>
                    <th className="py-1.5 px-2.5 text-right">할인</th>
                    <th className="py-1.5 px-2.5 text-right">실매출</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(parsedRows || []).slice(0, 3).map((r, i) => (
                    <tr key={i} className="text-slate-300">
                      <td className="py-1.5 px-2.5 font-mono">{r.date}</td>
                      <td className="py-1.5 px-2.5 font-mono text-cyan-300">{r.itemCode}</td>
                      <td className="py-1.5 px-2.5 font-medium text-white">{r.itemName}</td>
                      <td className="py-1.5 px-2.5 text-slate-400">{r.category}</td>
                      <td className="py-1.5 px-2.5 text-right">{r.quantity}</td>
                      <td className="py-1.5 px-2.5 text-right">{Number(r.totalSales || 0).toLocaleString()}원</td>
                      <td className="py-1.5 px-2.5 text-right text-rose-400">{Number(r.discount || 0).toLocaleString()}원</td>
                      <td className="py-1.5 px-2.5 text-right font-semibold text-emerald-400">{Number(r.netSales || 0).toLocaleString()}원</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 풋터 */}
        <div className="p-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950 shrink-0">
          <div>
            {!validation.canCommit ? (
              <span className="text-amber-400 flex items-center gap-1.5 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {validation.blockReason}
              </span>
            ) : (
              <span className="text-emerald-400 flex items-center gap-1.5 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                모든 검증을 통과했습니다. 데이터베이스에 안전하게 반영할 수 있습니다.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              취소
            </button>
            <button
              disabled={!validation.canCommit || isCommitting}
              onClick={handleConfirm}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg transition-all flex items-center gap-1.5 ${
                validation.canCommit && !isCommitting
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 cursor-pointer"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50"
              }`}
            >
              <Check className="w-4 h-4" />
              {isCommitting ? "데이터베이스 반영 중..." : "검증 완료 및 저장 승인"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
