// src/app/components/RoleSwitcher.jsx
"use client";

import React, { useState } from "react";
import { ShieldCheck, User, Lock, Store, Check, ChevronDown } from "lucide-react";
import { ROLES, MOCK_USERS } from "@/lib/permissions";

export default function RoleSwitcher({ currentUser, onSelectUser }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-slate-600 text-xs text-white transition-all shadow-sm"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
        <span className="text-slate-400">권한:</span>
        <span className="font-semibold text-indigo-300">{currentUser.name}</span>
        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
          currentUser.role === ROLES.HQ_MASTER 
            ? "bg-indigo-950 text-indigo-300 border border-indigo-800" 
            : "bg-cyan-950 text-cyan-300 border border-cyan-800"
        }`}>
          {currentUser.role === ROLES.HQ_MASTER ? "본사 총괄" : "매장 점주"}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-2 z-50 text-xs space-y-1">
            <div className="px-3 py-2 border-b border-slate-800 text-[11px] text-slate-400">
              <span className="font-semibold text-white block">서버 및 DB 권한 가드</span>
              로그인 화면 우회 방지: 데이터 쿼리 레벨에서 허가된 매장 외 접근 원천 차단
            </div>

            {MOCK_USERS.map((user) => {
              const isSelected = currentUser.id === user.id;
              return (
                <div
                  key={user.id}
                  onClick={() => {
                    onSelectUser(user);
                    setIsOpen(false);
                  }}
                  className={`p-2.5 rounded-xl cursor-pointer flex items-center justify-between transition-colors ${
                    isSelected ? "bg-indigo-950/60 border border-indigo-500/40 text-white" : "hover:bg-slate-800/60 text-slate-300"
                  }`}
                >
                  <div>
                    <div className="font-semibold flex items-center gap-1.5">
                      {user.name}
                      {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {user.role === ROLES.HQ_MASTER ? "7개 전 매장 데이터 조회 허용" : `지정 매장(${user.authorizedStoreIds.join(", ")}) 전표만 조회`}
                    </span>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    user.role === ROLES.HQ_MASTER ? "bg-indigo-900/60 text-indigo-300" : "bg-cyan-900/60 text-cyan-300"
                  }`}>
                    {user.role === ROLES.HQ_MASTER ? "HQ" : "점주"}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
