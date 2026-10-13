// src/app/components/CommonMenuMappingModal.jsx
"use client";

import React, { useState } from "react";
import { X, Layers, Plus, Check, Edit, Info, UtensilsCrossed } from "lucide-react";
import { DEFAULT_COMMON_MENU_MAPPINGS } from "@/lib/storesConfig";

export default function CommonMenuMappingModal({ isOpen, onClose }) {
  const [mappings, setMappings] = useState(DEFAULT_COMMON_MENU_MAPPINGS);
  const [searchTerm, setSearchTerm] = useState("");

  if (!isOpen) return null;

  const filtered = mappings.filter(m => 
    m.standardName.includes(searchTerm) || 
    m.category.includes(searchTerm) ||
    m.aliases.some(a => a.includes(searchTerm))
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* 헤더 */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 mb-1 inline-block">
              프랜차이즈 체인 표준화
            </span>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <UtensilsCrossed className="w-5 h-5 text-indigo-400" />
              매장별 상이 표기 메뉴 - 공통 메뉴 표준 매핑 사전
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-5 space-y-4 text-xs overflow-y-auto">
          <div className="flex items-center justify-between">
            <p className="text-slate-300">
              포스기마다 다르게 등록된 메뉴명(예: &quot;바삭 돼지막창(150g)&quot;, &quot;돼지막창&quot;, &quot;생돼지막창&quot;)을 하나의 체인 표준 품목으로 자동 연결하여 통합 원가 및 판매량을 비교합니다.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="표준 메뉴명 또는 매장 표기명 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-3">
            {filtered.map((item) => (
              <div key={item.commonId} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40">
                      {item.commonId}
                    </span>
                    <h4 className="text-sm font-bold text-white">{item.standardName}</h4>
                    <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                      {item.category}
                    </span>
                  </div>
                  <div className="text-right text-xs">
                    <span className="text-slate-400">기준 원가: </span>
                    <span className="font-semibold text-emerald-400">{item.costPrice.toLocaleString()}원</span>
                    <span className="text-slate-500 mx-1">|</span>
                    <span className="text-slate-400">판매가: </span>
                    <span className="font-semibold text-white">{item.targetSellingPrice.toLocaleString()}원</span>
                  </div>
                </div>

                <div className="flex items-start gap-1.5 text-slate-400 text-[11px] pt-1 border-t border-slate-900">
                  <span className="shrink-0 text-slate-500 font-medium">연결된 매장별 표기 별칭:</span>
                  <div className="flex flex-wrap gap-1">
                    {item.aliases.map((alias, aIdx) => (
                      <span key={aIdx} className="bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded text-[10px]">
                        {alias}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 풋터 */}
        <div className="p-4 border-t border-slate-800 flex justify-end bg-slate-950/80">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors"
          >
            확인 완료
          </button>
        </div>
      </div>
    </div>
  );
}
