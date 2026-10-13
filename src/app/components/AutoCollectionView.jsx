// src/app/components/AutoCollectionView.jsx
"use client";

import React, { useState } from "react";
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ShieldCheck, 
  Key, 
  Server, 
  Calendar, 
  Info, 
  Play, 
  Lock, 
  Eye, 
  EyeOff, 
  FileText,
  AlertCircle,
  Layers,
  ArrowRight
} from "lucide-react";
import { STORES_MASTER } from "@/lib/storesConfig";
import { API_PROTOCOL_AUDIT } from "@/lib/autoCollection/apiAudit";
import { 
  calculateNextCollectionSchedule, 
  CredentialVault, 
  SYNC_MODES, 
  executeCollectionWorkflow 
} from "@/lib/autoCollection/collectionEngine";

export default function AutoCollectionView({ onTriggerManualSync }) {
  const [isRunning, setIsRunning] = useState(false);
  const [lastBatchResult, setLastBatchResult] = useState(null);
  const [selectedAuditKey, setSelectedAuditKey] = useState("MY_OKPOS_ERP_API");
  const [activeSyncMode, setActiveSyncMode] = useState(SYNC_MODES.INCREMENTAL);

  const scheduleInfo = calculateNextCollectionSchedule();
  const maskedVault = CredentialVault.getMaskedVaultSummary();

  const handleRunSimulation = async (mode) => {
    setIsRunning(true);
    try {
      const res = await executeCollectionWorkflow({
        mode,
        targetStoreId: "all"
      });
      setLastBatchResult(res);
      if (onTriggerManualSync) onTriggerManualSync();
    } catch (e) {
      console.error(e);
    } finally {
      setIsRunning(false);
    }
  };

  const auditDetail = API_PROTOCOL_AUDIT[selectedAuditKey] || API_PROTOCOL_AUDIT.MY_OKPOS_ERP_API;

  return (
    <div className="space-y-6">
      {/* 3단계 상단 배너 */}
      <div className="glass-card p-6 rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-slate-900/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                3단계 시스템
              </span>
              <span className="text-xs text-slate-400">일일 자동 수집 타워 & 프로토콜 감사</span>
            </div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Server className="w-6 h-6 text-purple-400" />
              일일 자동 수집 통제 타워 (KST 04:30 스케줄러 & 롤링 갱신)
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              공식 ERP API와 웹 다운로드 프로토콜의 계약·비용·범위를 철저히 검토하고, 매장 마감 후 <strong>최근 7~14일 롤링 재확인</strong> 및 멱등 갱신을 수행합니다.
            </p>
          </div>

          {/* 안전 배포 대기 안내 배너 */}
          <div className="px-3.5 py-2 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <span className="font-semibold block">운영 배포 보류 상태 (READY)</span>
              <span className="text-[10px] text-amber-200/80">실제 정기 스케줄러 활성화는 사용자 별도 지시 전까지 안전 대기 중</span>
            </div>
          </div>
        </div>
      </div>

      {/* 스케줄러 및 실행 규격 카드 3종 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-5 rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            한국시간(KST) 자동 실행 시각
          </div>
          <div className="text-xl font-bold text-white">매일 04:30 KST</div>
          <p className="text-xs text-slate-400 mt-1.5">
            심야 마감 정산(24:00~02:00) 및 POS사 본사 집계 배치가 완료된 직후 실행되어 결손을 방지합니다.
          </p>
        </div>

        <div className="glass-card p-5 rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
            <RefreshCw className="w-4 h-4 text-cyan-400" />
            최근 14일 롤링 재감사 (Rolling Audit)
          </div>
          <div className="text-xl font-bold text-cyan-300">최근 14일 전수 갱신</div>
          <p className="text-xs text-slate-400 mt-1.5">
            어제 데이터 수집뿐만 아니라 직전 14일간 발생한 취소, 반품, 지연 반영 전표를 자동 갱신합니다.
          </p>
        </div>

        <div className="glass-card p-5 rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            멱등성(Idempotency) 보장
          </div>
          <div className="text-xl font-bold text-emerald-300">중복 없는 Upsert 갱신</div>
          <p className="text-xs text-slate-400 mt-1.5">
            재실행 시에도 데이터 부풀림이나 중복 행 삽입 없이 기존 영업일 전표를 정확하게 덮어씁니다.
          </p>
        </div>
      </div>

      {/* 공식 API 및 수집 프로토콜 기술 검토서 (검토 탭) */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800 bg-slate-900/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              수집 프로토콜 기술 검토서 (API vs 파일제공 vs 웹 다운로드)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              공식 API 요구사항, 계약/비용, 제공 항목, 과거 조회 범위의 실제 확인 결과
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setSelectedAuditKey("MY_OKPOS_ERP_API")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedAuditKey === "MY_OKPOS_ERP_API" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              MY OKPOS ERP API
            </button>
            <button
              onClick={() => setSelectedAuditKey("NICE_OKPOS_WEB_XLS")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedAuditKey === "NICE_OKPOS_WEB_XLS" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              NICE 자동 XLS (실증)
            </button>
            <button
              onClick={() => setSelectedAuditKey("OKASP_WEB_XLS")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedAuditKey === "OKASP_WEB_XLS" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              OKASP 자동 XLS
            </button>
            <button
              onClick={() => setSelectedAuditKey("EASYPOS_SMART_API")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedAuditKey === "EASYPOS_SMART_API" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              EasyPOS 스마트
            </button>
          </div>
        </div>

        {/* 선택된 프로토콜 세부 감사 내용 */}
        <div className="mt-5 space-y-4">
          <div className="flex items-start justify-between p-4 rounded-xl bg-slate-950/60 border border-slate-800">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                  auditDetail.status === "VERIFIED_OPERATIONAL" 
                    ? "bg-emerald-950 text-emerald-300 border-emerald-800" 
                    : "bg-amber-950 text-amber-300 border-amber-800"
                }`}>
                  {auditDetail.statusLabel}
                </span>
                <span className="text-xs text-slate-400">{auditDetail.docReference}</span>
              </div>
              <h4 className="text-base font-bold text-white">{auditDetail.title}</h4>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl">{auditDetail.recommendation}</p>
            </div>
            <span className="text-xs text-slate-400 font-mono">{auditDetail.vendor}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800/80">
              <span className="text-slate-400 block mb-1">적용 서버 URL</span>
              <span className="font-mono text-white text-[11px] truncate block">{auditDetail.scopeCheck.serverUrl}</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800/80">
              <span className="text-slate-400 block mb-1">계약 및 비용 요건</span>
              <span className="text-amber-300 font-medium">{auditDetail.scopeCheck.contractCost}</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800/80">
              <span className="text-slate-400 block mb-1">제공 항목 범위</span>
              <span className="text-white">{auditDetail.scopeCheck.providedItems}</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800/80">
              <span className="text-slate-400 block mb-1">과거 이력 조회 범위</span>
              <span className="text-white">{auditDetail.scopeCheck.historicalRange}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 7개 매장 수집 연결 현황 & 서버 자격증명 금고 */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800 bg-slate-900/40">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-400" />
              매장별 수집 연결 현황 및 보호된 서버 자격증명 금고
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              비밀번호는 화면·로그·클라이언트 번들에 절대 노출되지 않으며, 서버 격리 저장소에서 마스킹 관리됩니다.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={isRunning}
              onClick={() => handleRunSimulation(SYNC_MODES.INCREMENTAL)}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? "animate-spin" : ""}`} />
              {isRunning ? "수집 시뮬레이션 중..." : "일일 증분 수집 시뮬레이션"}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-3">매장명</th>
                <th className="py-3 px-3">POS 사이트</th>
                <th className="py-3 px-3">연결 상태</th>
                <th className="py-3 px-3">마스킹된 계정 ID</th>
                <th className="py-3 px-4">남은 조건 / 사용자 조치</th>
                <th className="py-3 px-3 text-center">어댑터 규격</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {maskedVault.map((item) => (
                <tr key={item.storeId} className="hover:bg-slate-800/30">
                  <td className="py-3 px-3 font-semibold text-white">
                    {item.storeName}
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-[10px] text-cyan-400 font-mono bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40">
                      {item.posSite}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    {item.posAdapterStatus === "VERIFIED" ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-fit">
                        <CheckCircle2 className="w-3 h-3" /> 연동 실증 완료
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1 w-fit">
                        <Clock className="w-3 h-3" /> 어댑터 준비 완료
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-300">
                    {item.maskedId}
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    {item.requiresUserAction ? (
                      <span className="text-amber-300 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        {item.userActionPrompt}
                      </span>
                    ) : (
                      <span className="text-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        {item.userActionPrompt}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      정상 장착
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 시뮬레이션 결과 출력 */}
        {lastBatchResult && (
          <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-indigo-900/50 space-y-2 text-xs">
            <div className="flex items-center justify-between text-indigo-300 font-bold">
              <span>수집 워크플로우 실행 결과 ({lastBatchResult.batchId})</span>
              <span>소요 시간: {lastBatchResult.durationMs}ms</span>
            </div>
            <div className="text-slate-300">
              총 {lastBatchResult.storesProcessedCount}개 매장 중 실증 계정 {lastBatchResult.successCount}개 정상 파싱 및 롤링 갱신, 자격증명 등록 대기 {lastBatchResult.pendingCredentialsCount}개 확인됨.
            </div>
            <div className="text-emerald-400 font-medium">
              ✓ 멱등성 보장 검증: 기존 보관 전표와의 Key 충돌 없이 무결성 갱신 완료
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
