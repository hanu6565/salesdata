// src/app/page.js
"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  Clock, 
  Upload, 
  Trash2, 
  Plus, 
  Edit, 
  RefreshCw, 
  X, 
  Download, 
  Filter, 
  Store, 
  ChevronRight, 
  BarChart2, 
  Table, 
  Award, 
  AlertCircle, 
  CheckCircle, 
  Search, 
  FileText, 
  Info, 
  PlusCircle,
  HelpCircle,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  User,
  Sparkles,
  Bot,
  Send,
  Brain
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
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  ReferenceLine,
  ZAxis
} from "recharts";
import { INITIAL_STORES, generateMockSalesData } from "./mockData";
import { parseOKPOSExcel, parseFileNameInfo, parseCostExcel } from "./excelParser";
import { DEFAULT_COST_DATA } from "./mockCostData";
import * as XLSX from "xlsx";

// Helper to filter out unwanted cost vendors (cards, green hygiene, Lotte kitchen, etc.)
const cleanCostData = (data) => {
  if (!data) return {};
  const EXCLUDED_NAMES = [
    "삼성카드", "신한카드", "국민카드", "그린위생", "샐러드", "네이버쇼핑", 
    "새우튀김", "외식중앙회쌀", "외식중앙회 쌀", "롯데주방", 
    "클레오파트라소금", "클레오소금"
  ];

  const shouldExclude = (name) => {
    if (!name) return false;
    const cleanName = name.trim().replace(/\s+/g, "");
    return EXCLUDED_NAMES.some(ex => {
      const cleanEx = ex.replace(/\s+/g, "");
      return cleanName.includes(cleanEx) || cleanEx.includes(cleanName);
    });
  };

  const cleaned = JSON.parse(JSON.stringify(data)); // Deep clone
  
  Object.keys(cleaned).forEach(storeId => {
    const storeData = cleaned[storeId];
    if (!storeData) return;
    
    // Clean initialCost
    if (storeData.initialCost) {
      let newTotalSum = 0;
      Object.keys(storeData.initialCost.categories || {}).forEach(catName => {
        const cat = storeData.initialCost.categories[catName];
        if (cat && cat.items) {
          cat.items = cat.items.filter(item => item && item.name && !shouldExclude(item.name));
          cat.sum = cat.items.reduce((sum, item) => sum + (item.value || 0), 0);
          newTotalSum += cat.sum;
        }
      });
      storeData.initialCost.totalSum = newTotalSum;
      // Recalculate ratios
      Object.keys(storeData.initialCost.categories || {}).forEach(catName => {
        const cat = storeData.initialCost.categories[catName];
        cat.ratio = newTotalSum > 0 ? cat.sum / newTotalSum : 0;
        if (cat.items) {
          cat.items.forEach(item => {
            if (item) {
              item.ratio = newTotalSum > 0 ? (item.value || 0) / newTotalSum : 0;
            }
          });
        }
      });
    }
    
    // Clean months
    if (storeData.months) {
      Object.keys(storeData.months).forEach(period => {
        const mData = storeData.months[period];
        if (!mData) return;
        const sales = mData.sales || 0;
        let totalExpenses = 0;
        
        Object.keys(mData.categories || {}).forEach(catName => {
          if (catName === "손익") return;
          const cat = mData.categories[catName];
          if (cat && cat.items) {
            cat.items = cat.items.filter(item => item && item.name && !shouldExclude(item.name));
            cat.sum = cat.items.reduce((sum, item) => sum + (item.value || 0), 0);
            totalExpenses += cat.sum;
          }
        });
        
        // Recalculate netProfit
        mData.netProfit = sales - totalExpenses;
        mData.netProfitRatio = sales > 0 ? mData.netProfit / sales : 0;
        
        // Update categories ratios
        Object.keys(mData.categories || {}).forEach(catName => {
          const cat = mData.categories[catName];
          if (!cat) return;
          if (catName === "손익") {
            cat.sum = mData.netProfit;
            cat.ratio = mData.netProfitRatio;
            if (cat.items) {
              cat.items = cat.items.filter(item => item && item.name && !shouldExclude(item.name));
              const nonProfitItems = cat.items.filter(item => item && item.name && !item.name.includes("최종수익") && !item.name.includes("손익"));
              const loanSum = nonProfitItems.reduce((sum, item) => sum + (item.value || 0), 0);
              const finalProfit = mData.netProfit - loanSum;
              cat.items.forEach(item => {
                if (!item) return;
                if (item.name.includes("최종수익") || item.name.includes("손익")) {
                  item.value = finalProfit;
                  item.ratio = sales > 0 ? finalProfit / sales : 0;
                } else {
                  item.ratio = sales > 0 ? (item.value || 0) / sales : 0;
                }
              });
            }
          } else {
            cat.ratio = sales > 0 ? cat.sum / sales : 0;
            if (cat.items) {
              cat.items.forEach(item => {
                if (item) {
                  item.ratio = sales > 0 ? (item.value || 0) / sales : 0;
                }
              });
            }
          }
        });
      });
    }
  });
  
  return cleaned;
};


// Native IndexedDB wrapper to store the giant sales array as a single object, avoiding 5MB localStorage limits
const initIndexedDB = () => {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("IndexedDB is only available in browser"));
      return;
    }
    const request = indexedDB.open("OKPOS_SalesData_DB", 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("sales_store")) {
        db.createObjectStore("sales_store");
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
};

const saveSalesToIndexedDB = async (salesArray) => {
  const db = await initIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["sales_store"], "readwrite");
    const store = transaction.objectStore("sales_store");
    const request = store.put(salesArray, "all_sales");
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
};

const loadSalesFromIndexedDB = async () => {
  const db = await initIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["sales_store"], "readonly");
    const store = transaction.objectStore("sales_store");
    const request = store.get("all_sales");
    request.onsuccess = (e) => resolve(e.target.result || []);
    request.onerror = (e) => reject(e.target.error);
  });
};

// Pure helper to generate context-aware AI chatbot responses based on the active store data
const generateAIChatResponse = (userInput, storeName, totalSummary, menuData, weekdayData) => {
  const text = userInput.trim().toLowerCase();
  
  const formatRawWon = (value) => {
    if (value === undefined || value === null) return "0원";
    return `${Math.round(value).toLocaleString()}원`;
  };

  // Helper: Extract top 3 best menus & bottom 2 worst menus
  const top3 = menuData && menuData.length > 0 ? menuData.slice(0, 3) : [];
  const bottom2 = menuData && menuData.length > 2 ? menuData.slice(-2).reverse() : [];
  const bestDay = weekdayData && weekdayData.length > 0 ? [...weekdayData].sort((a, b) => b.sales - a.sales)[0] : null;
  const worstDay = weekdayData && weekdayData.length > 0 ? [...weekdayData].sort((a, b) => a.sales - b.sales)[0] : null;

  // Intent 1: Weekday/Time patterns
  if (text.includes("요일") || text.includes("주말") || text.includes("평일") || text.includes("언제") || text.includes("바쁜") || text.includes("한가한") || text.includes("바빠") || text.includes("금요일") || text.includes("토요일") || text.includes("일요일")) {
    if (!weekdayData || weekdayData.length === 0) {
      return `📊 **${storeName}의 요일별 매출 분석**\n현재 분석할 수 있는 요일별 매출 내역이 충분하지 않습니다. 포스 데이터를 더 업로드 해주세요.`;
    }
    const sorted = [...weekdayData].sort((a, b) => b.sales - a.sales);
    const topDays = sorted.slice(0, 2);
    const lowDays = sorted.slice(-2).reverse();
    
    let advice = "";
    if (storeName.includes("고기9단") || storeName.includes("포크팬")) {
      advice = `주말 매출 비중이 높은 고기 업종 특성상, 주말에는 단체 패밀리 고객 단가를 끌어올리기 위한 프리미엄 결합 메뉴(예: 한우 육회 세트, 모듬 구이 구성) 배치가 핵심이며, 주간 중 한가한 **${lowDays[0].name}요일**에는 직장인/인근 주민 점심 방문 특선을 활성화해 평일 매출 기저를 확보하셔야 합니다.`;
    } else if (storeName.includes("막창") || storeName.includes("금막창")) {
      advice = `저녁 안주 메뉴 중심의 매장이므로 목/금/토의 야간(20시 이후) 테이블 회전율이 전체 실적을 지배합니다. 가장 취약한 **${lowDays[0].name}요일**에는 18시~20시 이른 시간대에 방문하는 고객에게 '사이드 껍데기 증정' 등의 타임 세일로 얼리버드 손님을 모으는 전략이 주효합니다.`;
    } else {
      advice = `평일 한식 식사 수요가 균등하게 나오는 지점으로 보입니다. 주간 최고 요일인 **${bestDay.name}요일**의 주류/사이드 결합 주문 비율을 모니터링하시고, 가장 저조한 **${worstDay.name}요일**에는 카카오톡 친구 채널을 통해 점심 '2인 주문 시 사이드 두부구이 서비스' 같은 모바일 쿠폰을 발행해 보시길 권장합니다.`;
    }

    return `📊 **${storeName} 지점 요일별 매출 정밀 진단 결과입니다.**

*   **최고 매출 요일**: **${bestDay.name}요일** (요일 평균 매출 약 **${bestDay.sales.toFixed(1)}만원**)
*   **두 번째로 바쁜 날**: **${topDays[1].name}요일** (요일 평균 매출 약 **${topDays[1].sales.toFixed(1)}만원**)
*   **가장 한가한 요일**: **${worstDay.name}요일** (요일 평균 매출 약 **${worstDay.sales.toFixed(1)}만원**)

---
💡 **AI 컨설턴트의 요일별 영업 제안**:
${advice}`;
  }

  // Intent 2: Menu / Best / Worst
  if (text.includes("메뉴") || text.includes("상품") || text.includes("인기") || text.includes("음식") || text.includes("팔리") || text.includes("판매") || text.includes("베스트") || text.includes("추천") || text.includes("효자") || text.includes("시그니처")) {
    if (top3.length === 0) {
      return `🍽️ **${storeName}의 메뉴 성과 분석**\n현재 업로드된 상품 매출 데이터가 없습니다. OKPOS 엑셀 파일을 업로드 하시면 메뉴 분석 리포트가 즉각 개설됩니다.`;
    }
    const top3List = top3.map((m, idx) => `    ${idx + 1}. **${m.name}** (등급: ${m.grade} | 판매량: ${m.quantity}개 | 점유율: ${m.sharePercent.toFixed(1)}%)`).join("\n");
    const bottomList = bottom2.map((m, idx) => `    • **${m.name}** (등급: ${m.grade} | 판매량: ${m.quantity}개 | 점유율: ${m.sharePercent.toFixed(1)}%)`).join("\n");
    const topRatio = top3.reduce((sum, m) => sum + m.sharePercent, 0).toFixed(1);

    let menuAdvice = "";
    if (storeName.includes("금등어")) {
      menuAdvice = `주력 메뉴인 고등어구이의 매출 지지율이 압도적입니다. 다만 사이드 메뉴의 매출 비중이 낮으므로, 고등어구이 주문 시 마진이 우수한 '특제 제육볶음'이나 '화덕 삼치구이'를 미니 단품 세트로 구성하여 세트 주문율을 유도하시는 것이 매출 극대화의 핵심 전략입니다.`;
    } else if (storeName.includes("고기9단")) {
      menuAdvice = `A등급 시그니처 구이 메뉴의 단골 기여도가 훌륭합니다. 이와 결합도가 높은 고마진 식사(냉면, 차돌 된장찌개)의 주문율을 높이기 위해 구이 메뉴 주문 태블릿 화면 상단에 사이드 결합 상품을 번들로 적극 배치하십시오.`;
    } else {
      menuAdvice = `상위 3개 베스트 메뉴가 전체 매출의 무려 **${topRatio}%**를 차지하고 있어 특정 품목에 대한 매출 쏠림 현상이 관찰됩니다. 매출 기여도가 극히 저조한 하위 C등급 메뉴들은 식자재 관리 코스트만 높일 수 있으므로, 과감히 메뉴판에서 정리(Diet)하시고 주력 메뉴에 집중(Focus)하시는 메뉴 슬림화 전략을 검토해 보시기 바랍니다.`;
    }

    return `🍽️ **${storeName} 지점 인기 및 비인기 메뉴 포트폴리오 분석 결과입니다.**

🏆 **매장 매출을 견인하는 상위 3대 인기 메뉴 (A등급)**:
${top3List}
*(상위 3개 핵심 메뉴의 매출 기여도 합계는 매장 전체의 **${topRatio}%**입니다.)*

⚠️ **가장 판매 기여도가 저조한 비인기 메뉴 (C등급 예시)**:
${bottomList}

---
💡 **AI 컨설턴트의 메뉴 재구성 제안**:
${menuAdvice}`;
  }

  // Intent 3: Sales Performance & Forecast
  if (text.includes("매출") || text.includes("실적") || text.includes("돈") || text.includes("벌었") || text.includes("전망") || text.includes("예상") || text.includes("목표") || text.includes("추이") || text.includes("성장") || text.includes("하루") || text.includes("평균")) {
    const progressPercent = totalSummary.currentMonthDays > 0 ? ((totalSummary.currentMonthDays / totalSummary.currentMonthTotalDays) * 100).toFixed(1) : "0";
    
    let targetMsg = "";
    if (totalSummary.currentMonthEstimatedSales > 0) {
      targetMsg = `\n*   **8월 달성 페이스**: 현재 8월은 총 ${totalSummary.currentMonthTotalDays}일 중 **${totalSummary.currentMonthDays}일**까지 영업이 집계되었으며, 진행율은 **${progressPercent}%**입니다. 이 기세를 유지한다면 이번 달 말 총 예상 매출은 **${formatRawWon(Math.round(totalSummary.currentMonthEstimatedSales))}** 선에 도달할 것으로 확실시됩니다.`;
    }

    return `💰 **${storeName} 지점 당월 매출 상태 및 미래 실적 시뮬레이션 리포트입니다.**

*   **현재 8월 실매출 합계**: **${formatRawWon(totalSummary.currentMonthSalesSum)}**
*   **지점 일평균 매출액**: **${formatRawWon(Math.round(totalSummary.currentMonthAvgSales))}**
*   **8월 예상 총매출액**: **${formatRawWon(Math.round(totalSummary.currentMonthEstimatedSales))}**${targetMsg}
*   **최고 일일 실적 기록**: **${totalSummary.peakDay}**에 기록한 **${formatRawWon(totalSummary.peakSales)}** 입니다.

---
💡 **AI 컨설턴트의 실적 튜닝 가이드**:
이번 달 매출 환산 예측치인 **${formatRawWon(Math.round(totalSummary.currentMonthEstimatedSales))}**를 돌파하기 위해서는 주중 남은 영업일에 하루 평균 **${formatRawWon(Math.round(totalSummary.currentMonthAvgSales * 1.05))}** (현재 일평균 대비 5% 상향)의 일 매출을 지속 방어해야 합니다. 저녁 메인 시간대의 주류 매출 또는 단체 예약을 1팀씩만 더 확보해도 목표 달성이 가능합니다.`;
  }

  // Intent 4: Marketing / Promotion / Issue matching
  if (text.includes("마케팅") || text.includes("프로모션") || text.includes("이벤트") || text.includes("홍보") || text.includes("여름") || text.includes("폭염") || text.includes("더워") || text.includes("원가") || text.includes("원재료") || text.includes("이슈") || text.includes("대비") || text.includes("방안") || text.includes("아이디어")) {
    let categoryTitle = "";
    let issueContext = "";
    let solutionSet = "";

    if (storeName.includes("금등어")) {
      categoryTitle = "화덕 생선구이 전문점 시즌 대응 전략";
      issueContext = "8월 기록적인 장기 폭염으로 외식 소비자들이 열기 강한 고기 구이류 매장을 일시 기피하는 성향이 발생합니다. 이는 조리가 완전히 끝난 상태로 서빙되어 즉시 취식할 수 있는 '화덕 고등어구이' 매장에 큰 기회 요인입니다.";
      solutionSet = "• **점심 러시 타임 묶음 마케팅**: 직장인 2~3인 동반 시 '고등어구이 + 삼치구이 + 음료' 결합 할인 쿠폰을 카카오톡 채널로 발행해 객단가 상승 유도\n• **위생 안심 바이럴**: 고온 화덕 살균 조리를 전면 배치한 배너 홍보로 여름철 어패류 기피 심리 원천 차단";
    } else if (storeName.includes("고기9단")) {
      categoryTitle = "소고기 패밀리 다이닝 시즌 대응 전략";
      issueContext = "수입육 및 한우 등 도매 유통 단가 인플레이션이 지속되는 가운데, 8월 열대야로 평일 저녁 소비가 소폭 둔화되었습니다. 특히 상추, 깻잎 등 구이류 쌈채소의 여름 폭염 급등세로 매장 마진율 방어가 절실합니다.";
      solutionSet = "• **고마진 사이드 메뉴 번들링**: 대표 메뉴 주문 시 마진율 80% 이상의 여름철 시원한 냉면/찌개류를 추천 상품으로 강제 노출해 식재료비율 완화\n• **주말 가족 고객 락인(Lock-in)**: '3대 동반 가족 방문 시 한우 육회 50% 할인' 등 고부가가치 서브 메뉴 증정으로 주말 객단가 집중 확보";
    } else if (storeName.includes("포크팬")) {
      categoryTitle = "가성비 무한리필 지점 마켓 대응 전략";
      issueContext = "대학생 여름 방학 시즌 및 야외 단체 활동 둔화로 인해 평일 단체 고객 빈도가 하락하고 원재료(삼겹살, 목살) 단가는 상승하고 있습니다. 젊은 소비층의 가성비 니즈가 그 어느 때보다 높은 상황입니다.";
      solutionSet = "• **청년 바이럴 이벤트**: 'SNS 방문 챌린지' 참여 시 음료 무제한 또는 평일 4인 이상 방문 예약 시 '단체 찌개 무료 서빙' 쿠폰을 발행해 평일 공백 최소화\n• **에어컨 냉각 온도 홍보**: 무더운 여름철 고기 굽는 열기를 이길 '얼음장 매장 에어컨 온도 최적 가동' 마케팅으로 쾌적한 환경 소구";
    } else if (storeName.includes("막창") || storeName.includes("금막창")) {
      categoryTitle = "야간 주류 특화 막창 지점 대응 전략";
      issueContext = "열대야 지속에 따른 밤 20시 이후 슬리퍼족 및 야식/소주 맥주 모임이 강세를 띱니다. 다만 알코올 음용 비율 감소 트렌드에 대응한 캐주얼 주류 기획이 필요합니다.";
      solutionSet = "• **트렌디 주류 하이볼 출시**: 젊은 세대 타겟의 피치/레몬 하이볼 번들을 막창 세트 주문 시 할인해 주류 마진액 극대화\n• **2차 고객 타임세일**: '21시 이후 입장 고객 소주 1+1' 또는 '라면 뷔페 서비스 무상 지원'으로 야간 집객 강제 유도";
    } else {
      categoryTitle = "한식 및 일반 F&B 지점 위기 대응 전략";
      issueContext = "고물가 장기화에 따른 서민 외식 소비 심리 위축이 한식 카테고리에도 반영되고 있습니다. 안정적인 단골 고객의 재방문 주기를 단축하는 것이 우선 과제입니다.";
      solutionSet = "• **재방문 캐시백 쿠폰**: 결제 금액의 10%를 '3주 이내 재방문 시 사용 가능한 식사 할인권'으로 모바일 발송하여 고착화 고객 유치\n• **식사 + 사이드 결합 프로모션**: 찌개류 단품 주문 시 2,000원 상당의 '사이드 곁들임 전/두부구이 추가 결합' 권유 판매 교육 실행";
    }

    return `💡 **${storeName}의 [${categoryTitle}] 제언서입니다.**

🌡️ **최신 시장 동향 및 사회 이슈 진단**:
${issueContext}

🛠️ **올이유 AI 실행 가능한 즉각 조치 솔루션 (Action Items)**:
${solutionSet}

---
🤖 **컨설턴트 코멘트**:
해당 마케팅은 무작정 가격을 깎아주는 것이 아닌, 매장의 베스트 인기 메뉴(A등급)의 가치를 훼손하지 않으면서 마진이 우수한 사이드 제품군을 끼워 파는 형태여야 마진율 수호가 가능합니다.`;
  }

  // Fallback: 360-degree comprehensive diagnostic report instead of generic reply!
  const topMenusDesc = top3.map((m, i) => `${i+1}위 ${m.name}(${m.sharePercent.toFixed(1)}%)`).join(", ");
  return `🤖 **(주)올이유 AI 비즈니스 종합 컨설팅 보고서입니다.**

질문하신 내용에 대해 **${storeName}** 매장의 매출 통계 장부 및 메뉴 등급 분석 데이터를 바탕으로 정밀 진단 브리핑을 준비했습니다.

---
### 📊 1. 8월 영업 실적 스냅샷
*   **누계 매출 총합**: **${formatRawWon(totalSummary.currentMonthSalesSum)}** (영업 ${totalSummary.currentMonthDays}일차 기준)
*   **월말 최종 예상 매출**: **${formatRawWon(Math.round(totalSummary.currentMonthEstimatedSales))}**
*   **주간 매출 트렌드**: 이번 달 가장 매출 집중도가 높은 날은 **${bestDay ? bestDay.name : "금/토/일"}요일**이며, 가장 유휴 시간대가 많은 날은 **${worstDay ? worstDay.name : "월/화"}요일**입니다.

---
### 🍽️ 2. 핵심 메뉴 성과
*   **매장 견인 시그니처 메뉴**: **${topMenusDesc || "데이터 없음"}**
*   **경영 조언**: 상위 3대 메뉴가 매출의 대부분을 주도하고 있으므로, 식자재 유통 코스트를 줄이기 위해 잘 판매되지 않는 하위 C등급 메뉴의 비중을 축소하고 베스트 메뉴에 마케팅 리소스를 집중하십시오.

---
### 💡 3. AI 추천 대화 가이드
더 알고 싶으신 지표가 있으시다면 대화창 아래의 단추를 누르시거나 아래와 같이 자유롭게 질문해 주시면 데이터를 실시간 분석해 고품질 보고서를 즉시 요약해 드립니다:
*   *예시 1)* **"가장 잘 팔리는 대표 메뉴 순위는?"**
*   *예시 2)* **"요일별로 언제 매출이 제일 잘 나와?"**
*   *예시 3)* **"폭염이나 물가 대비해서 마케팅 아이디어 추천해줘"**`;
};

export default function Home() {
  const [mounted, setMounted] = useState(false);

  // Core data states
  const [stores, setStores] = useState([]);
  const [salesRecords, setSalesRecords] = useState([]);
  const [uploadLogs, setUploadLogs] = useState([]);
  const [costData, setCostData] = useState({});

  // UI Navigation states
  const [globalTab, setGlobalTab] = useState("dashboard"); // "dashboard" | "pivot" | "upload" | "cost"
  const [selectedStoreId, setSelectedStoreId] = useState("total"); // "total" | storeId
  const [costTab, setCostTab] = useState("trend"); // "trend" | "breakdown" | "setup"
  const [costSelectedPeriod, setCostSelectedPeriod] = useState("");
  
  // Filters
  const [selectedPeriod, setSelectedPeriod] = useState("all"); // Default to "all" (전체 기간)
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const handlePeriodDropdownChange = (value) => {
    setSelectedPeriod(value);
    if (value === "all") {
      setStartDate("");
      setEndDate("");
    } else if (value === "custom") {
      if (!startDate && !endDate && salesRecords.length > 0) {
        let minD = "";
        let maxD = "";
        salesRecords.forEach(r => {
          if (r.date) {
            if (!minD || r.date < minD) minD = r.date;
            if (!maxD || r.date > maxD) maxD = r.date;
          }
        });
        setStartDate(minD);
        setEndDate(maxD);
      }
    } else {
      const year = value.split("-")[0];
      const month = value.split("-")[1];
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      setStartDate(`${value}-01`);
      setEndDate(`${value}-${lastDay.toString().padStart(2, "0")}`);
    }
  };

  const handleStartDateChange = (value) => {
    setStartDate(value);
    setSelectedPeriod("custom");
  };

  const handleEndDateChange = (value) => {
    setEndDate(value);
    setSelectedPeriod("custom");
  };

  // Modals state
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState(null); // null for add, store object for edit
  const [storeNameInput, setStoreNameInput] = useState("");
  const [storeCatInput, setStoreCatInput] = useState("기타");

  // Pivot configurations
  const [pivotMetric, setPivotMetric] = useState("netSales"); // "netSales" | "quantity"
  const [pivotSearch, setPivotSearch] = useState("");

  // Menu detail chart config
  const [selectedMenuName, setSelectedMenuName] = useState(null);
  const [rightCardMode, setRightCardMode] = useState("matrix"); // "matrix" | "menuTrend"
  const [menuChartPeriod, setMenuChartPeriod] = useState("daily"); // "daily" | "monthly" | "yearly"

  const [storeTrendPeriod, setStoreTrendPeriod] = useState("daily"); // "daily" | "monthly" | "yearly"
  const [compareYear, setCompareYear] = useState(2026);

  // AI Consultant States
  const [aiAnalysisState, setAiAnalysisState] = useState("idle"); // "idle" | "loading" | "done"
  const [aiAnalysisStep, setAiAnalysisStep] = useState(0);
  const [aiActiveTab, setAiActiveTab] = useState("report"); // "report" | "chat"
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");

  // Reset menu chart and AI when store selection changes
  useEffect(() => {
    setSelectedMenuName(null);
    setRightCardMode("matrix");
    setStoreTrendPeriod("daily");
    setCompareYear(2026);
    
    // Reset AI states
    setAiAnalysisState("idle");
    setAiAnalysisStep(0);
    setAiActiveTab("report");
    setChatMessages([]);
    setChatInput("");
  }, [selectedStoreId]);

  // Trigger AI dialogue search query
  const executeChatQuery = (queryText) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg = {
      sender: "user",
      text: queryText,
      time
    };
    
    setChatMessages(prev => [...prev, userMsg]);

    setTimeout(() => {
      const storeName = storeMap[selectedStoreId] || "지점";
      const menuData = menuAbcAnalysisData || [];
      const weekdayData = weekdayPatternChartData || [];
      
      const responseText = generateAIChatResponse(queryText, storeName, totalSummary, menuData, weekdayData);
      
      const aiMsg = {
        sender: "ai",
        text: responseText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages(prev => [...prev, aiMsg]);
    }, 600);
  };

  // Bulk Upload state
  const [dragActive, setDragActive] = useState(false);
  const [costDragActive, setCostDragActive] = useState(false);
  const [uploadStatusMsg, setUploadStatusMsg] = useState({ type: "", text: "" });
  const fileInputRef = useRef(null);
  const costFileInputRef = useRef(null);
  const [pendingUploadPackage, setPendingUploadPackage] = useState(null);

  // Authentication states
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginId, setLoginId] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Setup client mount and load data from localStorage / IndexedDB
  useEffect(() => {
    setMounted(true);
    
    // Restore session auth status
    const localAuth = localStorage.getItem("okpos_auth");
    if (localAuth === "true") {
      setIsLoggedIn(true);
    }
    
    // Load stores and uploads from localStorage safely
    const localStores = localStorage.getItem("okpos_stores");
    const localUploads = localStorage.getItem("okpos_uploads");
    const isFirstRun = !localStores && !localUploads;

    if (localStores) {
      setStores(JSON.parse(localStores));
    } else {
      setStores(INITIAL_STORES);
      localStorage.setItem("okpos_stores", JSON.stringify(INITIAL_STORES));
    }

    if (localUploads) {
      setUploadLogs(JSON.parse(localUploads));
    } else if (!isFirstRun) {
      setUploadLogs([]);
      localStorage.setItem("okpos_uploads", JSON.stringify([]));
    }

    const localCostData = localStorage.getItem("okpos_cost_data");
    if (localCostData) {
      const cleaned = cleanCostData(JSON.parse(localCostData));
      setCostData(cleaned);
      localStorage.setItem("okpos_cost_data", JSON.stringify(cleaned));
    } else {
      const cleaned = cleanCostData(DEFAULT_COST_DATA);
      setCostData(cleaned);
      localStorage.setItem("okpos_cost_data", JSON.stringify(cleaned));
    }

    // Load sales records asynchronously from IndexedDB with fallback/migration
    loadSalesFromIndexedDB().then(async (dbSales) => {
      if (dbSales && dbSales.length > 0) {
        setSalesRecords(dbSales);
        // Clear legacy localstorage key to free space
        localStorage.removeItem("okpos_sales");
      } else {
        // Look for legacy localstorage sales array to migrate
        const legacySales = localStorage.getItem("okpos_sales");
        if (legacySales) {
          const parsedLegacy = JSON.parse(legacySales);
          setSalesRecords(parsedLegacy);
          await saveSalesToIndexedDB(parsedLegacy);
          localStorage.removeItem("okpos_sales");
          console.log("Successfully migrated legacy sales records to IndexedDB.");
        } else if (isFirstRun) {
          // First run: load default mock data
          const { salesRecords: mockSales, uploadLogs: mockUploads } = generateMockSalesData();
          setSalesRecords(mockSales);
          setUploadLogs(mockUploads);
          await saveSalesToIndexedDB(mockSales);
          localStorage.setItem("okpos_uploads", JSON.stringify(mockUploads));
          console.log("Initialized IndexedDB and localStorage with default mock data on first run.");
        } else {
          setSalesRecords([]);
        }
      }
    }).catch(err => {
      console.error("Failed to load from IndexedDB, falling back to legacy localStorage:", err);
      const legacySales = localStorage.getItem("okpos_sales");
      if (legacySales) {
        setSalesRecords(JSON.parse(legacySales));
      } else {
        setSalesRecords([]);
      }
    });
  }, []);

  // Sync state to localStorage / IndexedDB when updated
  const saveStateToLocal = (newStores, newSales, newUploads) => {
    setStores(newStores);
    setSalesRecords(newSales);
    setUploadLogs(newUploads);
    localStorage.setItem("okpos_stores", JSON.stringify(newStores));
    localStorage.setItem("okpos_uploads", JSON.stringify(newUploads));
    
    // Save giant sales array asynchronously to IndexedDB
    saveSalesToIndexedDB(newSales).catch(err => {
      console.error("Failed to sync sales records to IndexedDB:", err);
    });
  };

  const saveCostDataToLocal = (newCostData) => {
    const cleaned = cleanCostData(newCostData);
    setCostData(cleaned);
    localStorage.setItem("okpos_cost_data", JSON.stringify(cleaned));
  };

  // Authentication Handlers
  const handleLogin = (e) => {
    e.preventDefault();
    if (loginId === "admin" && loginPw === "260613") {
      setIsLoggedIn(true);
      setLoginError("");
      localStorage.setItem("okpos_auth", "true");
    } else {
      setLoginError("아이디 또는 비밀번호가 올바르지 않습니다.");
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setLoginId("");
    setLoginPw("");
    setLoginError("");
    localStorage.removeItem("okpos_auth");
  };

  // Helper lists
  const availablePeriods = useMemo(() => {
    const periods = new Set();
    salesRecords.forEach(r => {
      if (r.date) {
        periods.add(r.date.substring(0, 7));
      }
    });
    return Array.from(periods).sort().reverse();
  }, [salesRecords]);

  const availableCategories = useMemo(() => {
    const cats = new Set();
    salesRecords.forEach(r => {
      if (r.category) {
        cats.add(r.category);
      }
    });
    return Array.from(cats).sort();
  }, [salesRecords]);

  // Helper mappings for store names
  const storeMap = useMemo(() => {
    const map = {};
    stores.forEach(s => {
      map[s.id] = s.name;
    });
    return map;
  }, [stores]);

  const storeIdByName = useMemo(() => {
    const map = {};
    stores.forEach(s => {
      map[s.name] = s.id;
    });
    return map;
  }, [stores]);

  const latestDateByStore = useMemo(() => {
    const map = {};
    salesRecords.forEach(r => {
      if (r.storeId && r.date) {
        if (!map[r.storeId] || r.date > map[r.storeId]) {
          map[r.storeId] = r.date;
        }
      }
    });
    return map;
  }, [salesRecords]);

  // ----------------------------------------------------
  // Dynamic Store Management Actions
  // ----------------------------------------------------
  const handleOpenAddStore = () => {
    setEditingStore(null);
    setStoreNameInput("");
    setStoreCatInput("기타");
    setIsStoreModalOpen(true);
  };

  const handleOpenEditStore = (store, e) => {
    e.stopPropagation();
    setEditingStore(store);
    setStoreNameInput(store.name);
    setStoreCatInput(store.category || "기타");
    setIsStoreModalOpen(true);
  };

  const handleSaveStore = (e) => {
    e.preventDefault();
    if (!storeNameInput.trim()) return;

    if (editingStore) {
      // Edit
      const updatedStores = stores.map(s => 
        s.id === editingStore.id 
          ? { ...s, name: storeNameInput.trim(), category: storeCatInput } 
          : s
      );
      // Update storeName in salesRecords and uploadLogs
      const updatedSales = salesRecords.map(r => 
        r.storeId === editingStore.id 
          ? { ...r, storeName: storeNameInput.trim() } 
          : r
      );
      const updatedUploads = uploadLogs.map(l => 
        l.storeId === editingStore.id 
          ? { ...l, storeName: storeNameInput.trim() } 
          : l
      );

      saveStateToLocal(updatedStores, updatedSales, updatedUploads);
    } else {
      // Add
      const newId = `store-${Date.now()}`;
      const newStore = {
        id: newId,
        name: storeNameInput.trim(),
        category: storeCatInput
      };
      saveStateToLocal([...stores, newStore], salesRecords, uploadLogs);
    }

    setIsStoreModalOpen(false);
  };

  const handleDeleteStore = (storeId, e) => {
    e.stopPropagation();
    if (!window.confirm("매장을 삭제하면 해당 매장의 모든 업로드 매출 데이터가 복구 불가능하게 삭제됩니다. 진행하시겠습니까?")) {
      return;
    }

    const updatedStores = stores.filter(s => s.id !== storeId);
    const updatedSales = salesRecords.filter(r => r.storeId !== storeId);
    const updatedUploads = uploadLogs.filter(l => l.storeId !== storeId);
    
    saveStateToLocal(updatedStores, updatedSales, updatedUploads);
    
    if (selectedStoreId === storeId) {
      setSelectedStoreId("total");
    }
  };

  // ----------------------------------------------------
  // Excel File Parsing & Handling
  // ----------------------------------------------------
  
  // Pure helper to import sales data into current accumulators (avoiding React state race conditions)
  // Pure helper to import sales data into current accumulators (avoiding React state race conditions)
  const processImport = (rows, storeName, period, fileName, currentStores, currentSales, currentUploads) => {
    let storeId = currentStores.find(s => s.name === storeName)?.id;
    let updatedStores = [...currentStores];
    let isNewStore = false;

    if (!storeId) {
      // Automatically register new store if name is unrecognized
      storeId = `store-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newStore = {
        id: storeId,
        name: storeName,
        category: "신규 등록 매장"
      };
      updatedStores.push(newStore);
      isNewStore = true;
    }

    // Identify all unique dates (YYYY-MM-DD) and unique months (YYYY-MM) present in the uploaded rows
    const datesInRows = new Set();
    const monthsInRows = new Set();
    rows.forEach(row => {
      if (row.date) {
        datesInRows.add(row.date);
        monthsInRows.add(row.date.substring(0, 7)); // YYYY-MM
      }
    });

    // Overwrite rule: delete existing records for this storeId on the EXACT dates present in the uploaded file
    let filteredSales;
    if (datesInRows.size > 0) {
      filteredSales = currentSales.filter(r => {
        const matchStore = r.storeId === storeId;
        const matchDate = datesInRows.has(r.date);
        return !(matchStore && matchDate);
      });
    } else {
      // Fallback: if no date field, delete by month
      filteredSales = currentSales.filter(r => {
        const matchStore = r.storeId === storeId;
        const recordMonth = r.date ? r.date.substring(0, 7) : "";
        return !(matchStore && recordMonth === period);
      });
      monthsInRows.add(period);
    }

    const uploadId = `upload-${storeId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newRecords = rows.map(row => ({
      ...row,
      storeId,
      storeName,
      uploadId
    }));

    const finalSales = [...filteredSales, ...newRecords];

    // Determine target log period label (e.g. "2026-04 ~ 2026-08" or "2026-08")
    const sortedMonths = Array.from(monthsInRows).sort();
    let displayPeriod = period;
    if (sortedMonths.length > 1) {
      displayPeriod = `${sortedMonths[0]} ~ ${sortedMonths[sortedMonths.length - 1]}`;
    } else if (sortedMonths.length === 1) {
      displayPeriod = sortedMonths[0];
    }

    // Update upload logs: replace log if same store & displayPeriod already exists, else add
    const filteredUploads = currentUploads.filter(l => !(l.storeId === storeId && l.period === displayPeriod));
    const newLog = {
      id: uploadId,
      storeId,
      storeName,
      fileName,
      period: displayPeriod,
      rowCount: rows.length,
      uploadTime: new Date().toISOString(),
      status: "정상 완료"
    };
    const finalUploads = [newLog, ...filteredUploads];

    return {
      updatedStores,
      finalSales,
      finalUploads,
      isNewStore
    };
  };

  // Individual Store File Upload (now triggers verification preview)
  const handleIndividualUpload = async (store, file) => {
    if (!file) return;
    try {
      setUploadStatusMsg({ type: "info", text: "파일을 읽고 분석하는 중..." });
      
      const fileInfo = parseFileNameInfo(file.name, stores);
      const parsedRows = await parseOKPOSExcel(file);
      
      const totalSales = parsedRows.reduce((sum, r) => sum + r.netSales, 0);
      const rowCount = parsedRows.length;
      
      // Determine unique months
      const monthsInRows = new Set();
      parsedRows.forEach(row => {
        if (row.date) {
          monthsInRows.add(row.date.substring(0, 7));
        }
      });
      if (monthsInRows.size === 0) {
        monthsInRows.add(fileInfo.period);
      }
      
      const sortedMonths = Array.from(monthsInRows).sort();
      let displayPeriod = fileInfo.period;
      if (sortedMonths.length > 1) {
        displayPeriod = `${sortedMonths[0]} ~ ${sortedMonths[sortedMonths.length - 1]}`;
      } else if (sortedMonths.length === 1) {
        displayPeriod = sortedMonths[0];
      }

      const pendingFile = {
        name: file.name,
        parsedRows,
        originalStoreName: store.name,
        matchedStoreId: store.id, // locked to individual target store
        period: displayPeriod,
        totalSales,
        rowCount
      };

      setPendingUploadPackage({
        files: [pendingFile],
        currentStores: [...stores],
        currentSales: [...salesRecords],
        currentUploads: [...uploadLogs],
        isIndividual: true
      });
      
      setUploadStatusMsg({ type: "", text: "" });
    } catch (err) {
      console.error(err);
      setUploadStatusMsg({
        type: "error",
        text: `[${store.name}] 파일 파싱 실패: ${err.message}`
      });
      // Append an error log
      const newLog = {
        id: `upload-err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        storeId: store.id,
        storeName: store.name,
        fileName: file.name,
        period: "오류",
        rowCount: 0,
        uploadTime: new Date().toISOString(),
        status: `오류: ${err.message.substring(0, 30)}`
      };
      saveStateToLocal(stores, salesRecords, [newLog, ...uploadLogs]);
    }
  };

  // Drag and Drop (Bulk Upload) Events
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processUploadedFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      await processUploadedFiles(e.target.files);
    }
  };

  const processUploadedFiles = async (files) => {
    setUploadStatusMsg({ type: "info", text: "파일들을 읽고 분석하는 중..." });
    let errors = [];
    let pendingFiles = [];

    // Accumulators to prevent state update race condition during loop
    let currentStores = [...stores];
    let currentSales = [...salesRecords];
    let currentUploads = [...uploadLogs];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        // Parse filename info using the most up-to-date stores list
        const { storeName, period } = parseFileNameInfo(file.name, currentStores);
        
        // Parse excel
        const parsedRows = await parseOKPOSExcel(file);
        
        const totalSales = parsedRows.reduce((sum, r) => sum + r.netSales, 0);
        const rowCount = parsedRows.length;

        // Determine unique months
        const monthsInRows = new Set();
        parsedRows.forEach(row => {
          if (row.date) {
            monthsInRows.add(row.date.substring(0, 7));
          }
        });
        if (monthsInRows.size === 0) {
          monthsInRows.add(period);
        }

        const sortedMonths = Array.from(monthsInRows).sort();
        let displayPeriod = period;
        if (sortedMonths.length > 1) {
          displayPeriod = `${sortedMonths[0]} ~ ${sortedMonths[sortedMonths.length - 1]}`;
        } else if (sortedMonths.length === 1) {
          displayPeriod = sortedMonths[0];
        }

        const matchedStore = currentStores.find(s => s.name === storeName);
        const matchedStoreId = matchedStore ? matchedStore.id : "new"; // "new" triggers automatic register

        pendingFiles.push({
          name: file.name,
          parsedRows,
          originalStoreName: storeName,
          matchedStoreId,
          period: displayPeriod,
          totalSales,
          rowCount
        });

      } catch (err) {
        console.error(err);
        errors.push(`${file.name}: ${err.message}`);
        
        // Log Error to accumulator
        const newLog = {
          id: `upload-err-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
          storeId: "unknown",
          storeName: file.name.substring(0, 15),
          fileName: file.name,
          period: "오류",
          rowCount: 0,
          uploadTime: new Date().toISOString(),
          status: `오류: ${err.message.substring(0, 20)}`
        };
        currentUploads = [newLog, ...currentUploads];
      }
    }

    if (pendingFiles.length > 0) {
      setPendingUploadPackage({
        files: pendingFiles,
        currentStores,
        currentSales,
        currentUploads,
        errors
      });
      setUploadStatusMsg({ type: "", text: "" });
    } else {
      // If only errors occurred
      saveStateToLocal(currentStores, currentSales, currentUploads);
      setUploadStatusMsg({
        type: "error",
        text: `파일 분석 실패. (오류 내용: ${errors.join(", ")})`
      });
      setTimeout(() => setUploadStatusMsg({ type: "", text: "" }), 7000);
    }
  };

  // Cost analysis file upload handlers
  const handleCostDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setCostDragActive(true);
    } else if (e.type === "dragleave") {
      setCostDragActive(false);
    }
  };

  const handleCostDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setCostDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      await uploadCostFile(file);
    }
  };

  const handleCostFileSelect = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      await uploadCostFile(file);
    }
  };

  const uploadCostFile = async (file) => {
    setUploadStatusMsg({ type: "info", text: "원가 엑셀 파일 분석 중..." });
    try {
      const parsed = await parseCostExcel(file);
      
      // Determine target store
      let targetStoreId = selectedStoreId;
      if (selectedStoreId === "total") {
        // Try to fuzzy match by filename or title
        const matchedStore = stores.find(s => file.name.includes(s.name) || (parsed.initialCost?.title && parsed.initialCost.title.includes(s.name)));
        if (matchedStore) {
          targetStoreId = matchedStore.id;
        } else {
          throw new Error("엑셀 파일이 어떤 매장의 파일인지 감지하지 못했습니다. 개별 매장을 선택한 후 다시 업로드해 주세요.");
        }
      }
      
      const updatedCostData = {
        ...costData,
        [targetStoreId]: parsed
      };
      saveCostDataToLocal(updatedCostData);
      
      const storeName = stores.find(s => s.id === targetStoreId)?.name || "선택 매장";
      setUploadStatusMsg({
        type: "success",
        text: `[${storeName}] 원가/손익 데이터 분석 완료 및 대시보드 반영 완료!`
      });
      setTimeout(() => setUploadStatusMsg({ type: "", text: "" }), 5000);
    } catch (err) {
      console.error(err);
      setUploadStatusMsg({
        type: "error",
        text: `원가 엑셀 파일 분석 실패: ${err.message}`
      });
      setTimeout(() => setUploadStatusMsg({ type: "", text: "" }), 7000);
    }
  };

  // Rollback / Delete Upload log
  const handleRollbackUpload = (log) => {
    if (!window.confirm(`[${log.storeName}] ${log.period} 기간의 데이터(${log.rowCount}행)를 삭제(롤백)하시겠습니까?`)) {
      return;
    }

    // Determine range
    let updatedSales;
    const hasUploadId = salesRecords.some(r => r.uploadId === log.id);

    if (hasUploadId) {
      updatedSales = salesRecords.filter(r => r.uploadId !== log.id);
    } else {
      // Fallback: original date-range based deletion for legacy/mock data
      if (log.period.includes("~")) {
        const parts = log.period.split("~").map(s => s.trim());
        const start = parts[0];
        const end = parts[1];
        updatedSales = salesRecords.filter(r => {
          const matchStore = r.storeId === log.storeId;
          const recordMonth = r.date ? r.date.substring(0, 7) : "";
          const matchRange = recordMonth >= start && recordMonth <= end;
          return !(matchStore && matchRange);
        });
      } else {
        updatedSales = salesRecords.filter(r => !(r.storeId === log.storeId && r.date && r.date.startsWith(log.period)));
      }
    }

    const updatedUploads = uploadLogs.filter(l => l.id !== log.id);
    saveStateToLocal(stores, updatedSales, updatedUploads);
  };

  // Reset all uploaded sales data and logs
  const handleResetAllData = () => {
    if (!window.confirm("주의! 업로드된 모든 매출 데이터와 업로드 기록이 영구적으로 삭제됩니다. 계속하시겠습니까?")) {
      return;
    }
    saveStateToLocal(stores, [], []);
    setUploadStatusMsg({ type: "success", text: "모든 매출 데이터와 업로드 기록이 성공적으로 초기화되었습니다." });
    setTimeout(() => setUploadStatusMsg({ type: "", text: "" }), 5000);
  };

  // Restore mock demo sales data
  const handleRestoreDemoData = () => {
    if (!window.confirm("데모 데이터를 처음 상태로 복구하시겠습니까? (이 작업은 현재 업로드된 모든 매출 데이터도 유지한 채 데모 데이터만 복원합니다. 중복 데이터가 있는 경우 덮어씁니다.)")) {
      return;
    }
    
    const { salesRecords: mockSales, uploadLogs: mockUploads } = generateMockSalesData();

    const existingLogKeys = new Set(uploadLogs.map(l => `${l.storeId}-${l.period}`));
    const newUploadsToAppend = mockUploads.filter(l => !existingLogKeys.has(`${l.storeId}-${l.period}`));
    const finalUploads = [...uploadLogs, ...newUploadsToAppend];

    const mockSalesKeySet = new Set(mockSales.map(r => `${r.storeId}-${r.date}`));
    const filteredCurrentSales = salesRecords.filter(r => !mockSalesKeySet.has(`${r.storeId}-${r.date}`));
    const finalSales = [...filteredCurrentSales, ...mockSales];

    saveStateToLocal(stores, finalSales, finalUploads);
    setUploadStatusMsg({ type: "success", text: "데모 데이터가 성공적으로 복구되었습니다!" });
    setTimeout(() => setUploadStatusMsg({ type: "", text: "" }), 5000);
  };

  // Export current data as mockData.js code file
  const handleExportDataToFile = () => {
    try {
      const dataStr = `// mockData.js
// Generated by backup export on ${new Date().toLocaleString()}

export const INITIAL_STORES = ${JSON.stringify(stores, null, 2)};

export function generateMockSalesData() {
  const salesRecords = ${JSON.stringify(salesRecords, null, 2)};
  const uploadLogs = ${JSON.stringify(uploadLogs, null, 2)};
  
  return { salesRecords, uploadLogs };
}
`;
      const blob = new Blob([dataStr], { type: "text/javascript;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "mockData.js";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setUploadStatusMsg({ type: "success", text: "현재 데이터가 mockData.js 파일로 내보내졌습니다. 다운로드 폴더에서 파일을 확인하고 src/app/mockData.js에 덮어씌워 주세요!" });
      setTimeout(() => setUploadStatusMsg({ type: "", text: "" }), 6000);
    } catch (err) {
      console.error(err);
      alert("데이터 내보내기 실패: " + err.message);
    }
  };

  // ----------------------------------------------------
  // Demo OKPOS Sample Excel Downloader Generator
  // ----------------------------------------------------
  const handleDownloadSampleExcel = (storeName = "금막창 종로점", periodStr = "2026-08") => {
    const wb = XLSX.utils.book_new();
    
    // Sample items configuration
    const mockMenus = [
      { name: "바삭 돼지막창(150g)", code: "K001", cat: "막창류", price: 12000 },
      { name: "쫄깃 소막창(150g)", code: "K002", cat: "막창류", price: 15000 },
      { name: "직화 불막창(150g)", code: "K003", cat: "막창류", price: 13000 },
      { name: "날치알 주먹밥", code: "K004", cat: "식사류", price: 4000 },
      { name: "얼큰 김치말이국수", code: "K005", cat: "식사류", price: 6000 },
      { name: "참이슬", code: "K006", cat: "주류", price: 5000 },
      { name: "테라", code: "K007", cat: "주류", price: 5000 },
    ];

    const data = [
      ["[OKPOS 일자별/상품별 매출상세 보고서]"],
      [`출력일시: 2026-08-26 14:00:00`],
      [`매장명: ${storeName}`],
      [`조회기간: ${periodStr}-01 ~ ${periodStr}-26`],
      ["일자", "대분류", "상품코드", "상품명", "수량", "총매출액", "총할인액", "실매출액"]
    ];

    // Generate daily sales for 26 days
    let totalQty = 0;
    let totalSalesVal = 0;
    let totalDiscVal = 0;
    let totalNetVal = 0;

    for (let day = 1; day <= 26; day++) {
      const dateStr = `${periodStr}-${day.toString().padStart(2, "0")}`;
      // Weekday multiplier
      const dateObj = new Date(dateStr);
      const dayOfWeek = dateObj.getDay();
      let multiplier = 1.0;
      if (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) multiplier = 1.4;

      mockMenus.forEach(menu => {
        const qty = Math.round((5 + Math.random() * 20) * multiplier);
        const totalSales = qty * menu.price;
        const discount = menu.cat === "막창류" && Math.random() > 0.7 ? Math.round(totalSales * 0.05) : 0;
        const netSales = totalSales - discount;

        totalQty += qty;
        totalSalesVal += totalSales;
        totalDiscVal += discount;
        totalNetVal += netSales;

        data.push([
          dateStr,
          menu.cat,
          menu.code,
          menu.name,
          qty,
          totalSales,
          discount,
          netSales
        ]);
      });
    }

    // Append total row
    data.push([
      "합계",
      "",
      "",
      "",
      totalQty,
      totalSalesVal,
      totalDiscVal,
      totalNetVal
    ]);

    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // Fit columns width
    const wscols = [
      { wch: 12 }, // 일자
      { wch: 10 }, // 대분류
      { wch: 10 }, // 상품코드
      { wch: 22 }, // 상품명
      { wch: 8 },  // 수량
      { wch: 12 }, // 총매출액
      { wch: 10 }, // 총할인액
      { wch: 12 }  // 실매출액
    ];
    ws["!cols"] = wscols;

    XLSX.utils.book_append_sheet(wb, ws, "매출보고서");
    XLSX.writeFile(wb, `${storeName} ${periodStr.substring(2).replace("-", "년 ")}월 일자별 매출.xlsx`);
  };

  // ----------------------------------------------------
  // Calculated Statistics & Data Filtering
  // ----------------------------------------------------
  
  // 1. Filtered raw records based on active store tab, period, and category
  const filteredSalesData = useMemo(() => {
    return salesRecords.filter(r => {
      // Store ID filter
      if (selectedStoreId !== "total" && r.storeId !== selectedStoreId) {
        return false;
      }
      // Period filter
      if (selectedPeriod !== "all") {
        if (startDate && r.date < startDate) return false;
        if (endDate && r.date > endDate) return false;
      }
      // Category filter
      if (selectedCategory !== "all") {
        if (selectedCategory === "식사류/정식류") {
          return r.category === "식사류" || r.category === "정식류" || r.category === "찌개류";
        }
        if (selectedCategory === "주류/음료") {
          return r.category === "주류" || r.category === "음료";
        }
        if (selectedCategory === "사이드/기타") {
          return r.category === "사이드" || r.category === "단품요리" || r.category === "기타";
        }
        return r.category === selectedCategory;
      }
      return true;
    });
  }, [salesRecords, selectedStoreId, selectedPeriod, selectedCategory]);

  // Total summary metrics
  const totalSummary = useMemo(() => {
    let netSales = 0;
    let discount = 0;
    let quantity = 0;
    const uniqueDays = new Set();
    
    filteredSalesData.forEach(r => {
      netSales += r.netSales || 0;
      discount += r.discount || 0;
      quantity += r.quantity || 0;
      if (r.date) uniqueDays.add(r.date);
    });

    const dayCount = uniqueDays.size || 1;
    const dailyAvgSales = Math.round(netSales / dayCount);

    // Calculate Peak Sales Day
    const dailySalesMap = {};
    filteredSalesData.forEach(r => {
      if (r.date) {
        dailySalesMap[r.date] = (dailySalesMap[r.date] || 0) + (r.netSales || 0);
      }
    });

    let peakDay = "데이터 없음";
    let peakSales = 0;
    Object.keys(dailySalesMap).forEach(d => {
      if (dailySalesMap[d] > peakSales) {
        peakSales = dailySalesMap[d];
        peakDay = d;
      }
    });

    // Calculate MoM growth
    // Get sales for current month vs previous month
    let momGrowth = 0.0;
    let activeMonth = selectedPeriod;
    if (activeMonth === "all" || activeMonth === "custom") {
      activeMonth = startDate ? startDate.substring(0, 7) : (endDate ? endDate.substring(0, 7) : "2026-08");
    }
    
    const parts = activeMonth.split("-");
    const y = parseInt(parts[0]);
    const m = parseInt(parts[1]);
    
    const prevMonthStr = m === 1 
      ? `${y - 1}-12` 
      : `${y}-${(m - 1).toString().padStart(2, "0")}`;

    let currMonthSales = 0;
    let prevMonthSales = 0;

    salesRecords.forEach(r => {
      if (selectedStoreId !== "total" && r.storeId !== selectedStoreId) return;
      if (r.date) {
        if (r.date.startsWith(activeMonth)) {
          currMonthSales += r.netSales || 0;
        } else if (r.date.startsWith(prevMonthStr)) {
          prevMonthSales += r.netSales || 0;
        }
      }
    });

    if (prevMonthSales > 0) {
      momGrowth = ((currMonthSales - prevMonthSales) / prevMonthSales) * 100;
    }

    // Calculate Current Month metrics based on today's calendar date
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonthNum = today.getMonth() + 1; // 1-12
    const currentMonthStr = `${currentYear}-${currentMonthNum.toString().padStart(2, "0")}`; // e.g. "2026-08"
    const currentMonthLabel = `${String(currentYear).substring(2)}년 ${currentMonthNum}월 매출`;

    let currentMonthSalesSum = 0;
    const currentMonthDaysWithSales = new Set();

    filteredSalesData.forEach(r => {
      if (r.date && r.date.startsWith(currentMonthStr)) {
        currentMonthSalesSum += r.netSales || 0;
        currentMonthDaysWithSales.add(r.date);
      }
    });

    const currentMonthDays = currentMonthDaysWithSales.size;
    const currentMonthTotalDays = new Date(currentYear, currentMonthNum, 0).getDate(); // Total days in today's month
    const currentMonthAvgSales = currentMonthDays > 0 ? (currentMonthSalesSum / currentMonthDays) : 0;
    const currentMonthEstimatedSales = currentMonthAvgSales * currentMonthTotalDays;

    return {
      netSales,
      discount,
      quantity,
      dailyAvgSales,
      peakDay,
      peakSales,
      momGrowth,
      currentMonthLabel,
      currentMonthNum,
      currentMonthSalesSum,
      currentMonthDays,
      currentMonthTotalDays,
      currentMonthAvgSales,
      currentMonthEstimatedSales
    };
  }, [filteredSalesData, salesRecords, selectedPeriod, selectedStoreId]);

  // ----------------------------------------------------
  // Dashboard 1: Total Integrated Dashboard Logic
  // ----------------------------------------------------
  
  // A. Bar Chart: Store Sales Comparison
  const storeComparisonChartData = useMemo(() => {
    const storeMapSales = {};
    stores.forEach(s => {
      storeMapSales[s.id] = 0;
    });

    filteredSalesData.forEach(r => {
      if (storeMapSales[r.storeId] !== undefined) {
        storeMapSales[r.storeId] += r.netSales || 0;
      }
    });

    return stores.map(s => ({
      name: s.name,
      id: s.id,
      sales: Math.round(storeMapSales[s.id] / 10000), // in 10k units
      salesRaw: storeMapSales[s.id]
    })).sort((a, b) => b.salesRaw - a.salesRaw);
  }, [filteredSalesData, stores]);

  // B. Pie Chart: Store Contribution Share
  const COLORS = ["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#3b82f6", "#14b8a6"];
  const storeContributionChartData = useMemo(() => {
    return storeComparisonChartData
      .filter(item => item.salesRaw > 0)
      .map((item, index) => ({
        name: item.name,
        value: item.salesRaw,
        color: COLORS[index % COLORS.length]
      }));
  }, [storeComparisonChartData]);

  // C. Store Grid Info (Screen 1 cards)
  const storeGridCardsData = useMemo(() => {
    return stores.map(store => {
      const storeRecords = salesRecords.filter(r => {
        const matchesStore = r.storeId === store.id;
        let matchesPeriod = true;
        if (selectedPeriod !== "all") {
          if (startDate && r.date < startDate) matchesPeriod = false;
          if (endDate && r.date > endDate) matchesPeriod = false;
        }
        return matchesStore && matchesPeriod;
      });

      let netSales = 0;
      let qty = 0;
      const uniqueDays = new Set();
      storeRecords.forEach(r => {
        netSales += r.netSales || 0;
        qty += r.quantity || 0;
        if (r.date) uniqueDays.add(r.date);
      });

      const dayCount = uniqueDays.size || 1;
      const avgSales = Math.round(netSales / dayCount);

      // Latest upload details
      const storeUploads = uploadLogs.filter(l => l.storeId === store.id && l.status === "정상 완료");
      const latestUpload = storeUploads.length > 0 ? storeUploads[0] : null;

      return {
        id: store.id,
        name: store.name,
        category: store.category,
        totalSales: netSales,
        dailyAvg: avgSales,
        qty: qty,
        latestUploadPeriod: latestUpload ? latestUpload.period : "데이터 없음",
        latestUploadTime: latestUpload ? latestUpload.uploadTime : null
      };
    });
  }, [stores, salesRecords, selectedPeriod, uploadLogs]);

  // ----------------------------------------------------
  // Dashboard 2: Individual Store Dashboard Logic
  // ----------------------------------------------------
  
  // A. Dynamic Chart: Store Sales Trend (Daily / Monthly / Yearly)
  const storeTrendChartData = useMemo(() => {
    if (storeTrendPeriod === "daily") {
      const dailyMap = {};
      filteredSalesData.forEach(r => {
        if (r.date) {
          dailyMap[r.date] = (dailyMap[r.date] || 0) + (r.netSales || 0);
        }
      });
      return Object.keys(dailyMap).sort().map(d => ({
        date: d.substring(5), // MM-DD
        sales: Math.round(dailyMap[d] / 10000) // in 10k units
      }));
    } else if (storeTrendPeriod === "monthly") {
      const monthlyMap = {};
      filteredSalesData.forEach(r => {
        if (r.date) {
          const m = r.date.substring(0, 7); // YYYY-MM
          monthlyMap[m] = (monthlyMap[m] || 0) + (r.netSales || 0);
        }
      });
      return Object.keys(monthlyMap).sort().map(m => ({
        date: `${m.split("-")[0]}년 ${parseInt(m.split("-")[1], 10)}월`,
        sales: Math.round(monthlyMap[m] / 10000) // in 10k units
      }));
    } else {
      const yearlyMap = {};
      filteredSalesData.forEach(r => {
        if (r.date) {
          const y = r.date.substring(0, 4); // YYYY
          yearlyMap[y] = (yearlyMap[y] || 0) + (r.netSales || 0);
        }
      });
      return Object.keys(yearlyMap).sort().map(y => ({
        date: `${y}년`,
        sales: Math.round(yearlyMap[y] / 10000) // in 10k units
      }));
    }
  }, [filteredSalesData, storeTrendPeriod]);

  // B. Bar Chart: Weekday Sales Pattern
  const weekdayPatternChartData = useMemo(() => {
    const weekdaySum = Array(7).fill(0);
    const weekdayCount = Array(7).fill(0);
    const weekdayName = ["일", "월", "화", "수", "목", "금", "토"];

    // Aggregates netSales day-by-day
    const dailyMap = {};
    filteredSalesData.forEach(r => {
      if (r.date) {
        dailyMap[r.date] = (dailyMap[r.date] || 0) + (r.netSales || 0);
      }
    });

    Object.keys(dailyMap).forEach(dateStr => {
      const dateObj = new Date(dateStr);
      const day = dateObj.getDay(); // 0-6
      weekdaySum[day] += dailyMap[dateStr];
      weekdayCount[day] += 1;
    });

    return weekdayName.map((name, i) => {
      const count = weekdayCount[i] || 1;
      const averageSales = Math.round((weekdaySum[i] / count) / 10000); // 10k
      return {
        name,
        sales: averageSales
      };
    });
  }, [filteredSalesData]);

  // B-2. Yearly/Monthly comparative analysis helpers
  const availableYears = useMemo(() => {
    const years = new Set();
    salesRecords.forEach(r => {
      if (r.date && r.storeId === selectedStoreId) {
        years.add(parseInt(r.date.substring(0, 4), 10));
      }
    });
    // Always include current year 2026 for safety
    years.add(2026);
    return Array.from(years).sort();
  }, [salesRecords, selectedStoreId]);

  const monthlyCompareData = useMemo(() => {
    if (selectedStoreId === "total") return [];

    // Filter sales for the selected store and year
    const storeSalesForYear = salesRecords.filter(r => 
      r.storeId === selectedStoreId && 
      r.date && 
      r.date.startsWith(String(compareYear))
    );

    // Group sales by month (1 to 12)
    const monthlySums = Array(12).fill(0);
    storeSalesForYear.forEach(r => {
      const mIdx = parseInt(r.date.substring(5, 7), 10) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        monthlySums[mIdx] += r.netSales || 0;
      }
    });

    // If selected year is current year (2026), show up to current month (8).
    // Otherwise, show all 12 months.
    const today = new Date();
    const isCurrentYear = compareYear === today.getFullYear();
    const maxMonths = isCurrentYear ? (today.getMonth() + 1) : 12;

    const result = [];
    for (let i = 0; i < maxMonths; i++) {
      result.push({
        monthLabel: `${i + 1}월`,
        sales: Math.round(monthlySums[i] / 10000), // in 10k units
        salesRaw: monthlySums[i]
      });
    }
    return result;
  }, [salesRecords, selectedStoreId, compareYear]);

  // C. Menu ABC Rank Analysis
  const menuAbcAnalysisData = useMemo(() => {
    const menuMap = {};
    let storeTotalSales = 0;

    filteredSalesData.forEach(r => {
      if (!menuMap[r.itemName]) {
        menuMap[r.itemName] = {
          name: r.itemName,
          code: r.itemCode,
          category: r.category,
          quantity: 0,
          netSales: 0
        };
      }
      menuMap[r.itemName].quantity += r.quantity || 0;
      menuMap[r.itemName].netSales += r.netSales || 0;
      storeTotalSales += r.netSales || 0;
    });

    // Sort by sales descending
    const sortedMenus = Object.values(menuMap).sort((a, b) => b.netSales - a.netSales);

    let cumulativeSales = 0;
    return sortedMenus.map((menu, index) => {
      cumulativeSales += menu.netSales;
      const sharePercent = storeTotalSales > 0 ? (menu.netSales / storeTotalSales) * 100 : 0;
      const cumulativePercent = storeTotalSales > 0 ? (cumulativeSales / storeTotalSales) * 100 : 0;
      
      let grade = "C";
      let badgeStyle = "bg-amber-900/40 text-amber-400 border border-amber-800/60";
      let badgeLabel = "Bronze C";

      if (cumulativePercent <= 70) {
        grade = "A";
        badgeStyle = "bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 shadow-[0_0_8px_rgba(234,179,8,0.2)]";
        badgeLabel = "Gold A";
      } else if (cumulativePercent <= 90) {
        grade = "B";
        badgeStyle = "bg-slate-300/25 text-slate-200 border border-slate-400/30";
        badgeLabel = "Silver B";
      }

      return {
        ...menu,
        rank: index + 1,
        sharePercent,
        cumulativePercent,
        grade,
        badgeStyle,
        badgeLabel
      };
    });
  }, [filteredSalesData]);

  // D. Menu Portfolio Matrix Coordinates
  const menuMatrixData = useMemo(() => {
    if (menuAbcAnalysisData.length === 0) return [];
    
    // Average values to divide into quadrants
    let totalQty = 0;
    let totalSales = 0;
    menuAbcAnalysisData.forEach(m => {
      totalQty += m.quantity;
      totalSales += m.netSales;
    });

    const avgQty = totalQty / menuAbcAnalysisData.length;
    const avgSales = totalSales / menuAbcAnalysisData.length;

    return {
      avgQty,
      avgSales,
      points: menuAbcAnalysisData.map(m => {
        // Classify quadrant
        let quadrant = "D"; // bottom-left (low volume, low profit)
        let color = "#ef4444"; // red
        let desc = "관리 필요 메뉴";

        if (m.quantity >= avgQty && m.netSales >= avgSales) {
          quadrant = "A"; // top-right
          color = "#10b981"; // green
          desc = "스타 메뉴 (핵심)";
        } else if (m.quantity < avgQty && m.netSales >= avgSales) {
          quadrant = "B"; // top-left
          color = "#6366f1"; // indigo
          desc = "고단가 고수익 메뉴";
        } else if (m.quantity >= avgQty && m.netSales < avgSales) {
          quadrant = "C"; // bottom-right
          color = "#f59e0b"; // amber
          desc = "박리다매 대중 메뉴";
        }

        return {
          name: m.name,
          x: m.quantity,
          y: Math.round(m.netSales / 10000), // In 10k Won units
          rawSales: m.netSales,
          quadrant,
          color,
          desc
        };
      })
    };
  }, [menuAbcAnalysisData]);

  // E. Dynamic Menu Sales Trend Data (for Selected Menu Chart)
  const menuTrendChartData = useMemo(() => {
    if (!selectedMenuName || selectedStoreId === "total") return [];
    
    // Filter records for selected store and menu name
    const filtered = salesRecords.filter(r => 
      r.storeId === selectedStoreId && 
      r.itemName === selectedMenuName
    );

    if (menuChartPeriod === "daily") {
      // Daily sales: group by date (YYYY-MM-DD), sort chronologically
      const dailyMap = {};
      filtered.forEach(r => {
        if (r.date) {
          dailyMap[r.date] = (dailyMap[r.date] || 0) + (r.netSales || 0);
        }
      });
      return Object.keys(dailyMap).sort().map(d => ({
        name: d.substring(5), // MM-DD
        sales: dailyMap[d],
        salesRaw: dailyMap[d]
      }));
    } else if (menuChartPeriod === "monthly") {
      // Monthly sales: group by YYYY-MM, sort chronologically
      const monthlyMap = {};
      filtered.forEach(r => {
        if (r.date) {
          const m = r.date.substring(0, 7);
          monthlyMap[m] = (monthlyMap[m] || 0) + (r.netSales || 0);
        }
      });
      return Object.keys(monthlyMap).sort().map(m => ({
        name: `${m.split("-")[0]}년 ${parseInt(m.split("-")[1], 10)}월`,
        sales: monthlyMap[m],
        salesRaw: monthlyMap[m]
      }));
    } else {
      // Yearly sales: group by YYYY, sort chronologically
      const yearlyMap = {};
      filtered.forEach(r => {
        if (r.date) {
          const y = r.date.substring(0, 4);
          yearlyMap[y] = (yearlyMap[y] || 0) + (r.netSales || 0);
        }
      });
      return Object.keys(yearlyMap).sort().map(y => ({
        name: `${y}년`,
        sales: yearlyMap[y],
        salesRaw: yearlyMap[y]
      }));
    }
  }, [salesRecords, selectedStoreId, selectedMenuName, menuChartPeriod]);

  // ----------------------------------------------------
  // Dashboard 3: Pivot Table Logic
  // ----------------------------------------------------
  const pivotTableData = useMemo(() => {
    // Collect all menus matching filters
    const menus = {};
    const dates = new Set();

    filteredSalesData.forEach(r => {
      if (!r.date) return;
      
      const day = parseInt(r.date.split("-")[2], 10);
      dates.add(day);

      if (!menus[r.itemName]) {
        menus[r.itemName] = {
          name: r.itemName,
          category: r.category,
          dailyValues: {},
          totalSales: 0,
          totalQty: 0
        };
      }

      const val = pivotMetric === "netSales" ? r.netSales : r.quantity;
      menus[r.itemName].dailyValues[day] = (menus[r.itemName].dailyValues[day] || 0) + val;
      menus[r.itemName].totalSales += r.netSales || 0;
      menus[r.itemName].totalQty += r.quantity || 0;
    });

    // Create array and apply search filter
    let rows = Object.values(menus);
    if (pivotSearch.trim()) {
      const q = pivotSearch.toLowerCase();
      rows = rows.filter(r => r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q));
    }

    // Sort by total value descending
    rows.sort((a, b) => {
      const sumA = pivotMetric === "netSales" ? a.totalSales : a.totalQty;
      const sumB = pivotMetric === "netSales" ? b.totalSales : b.totalQty;
      return sumB - sumA;
    });

    // Fill days 1-31
    const dayCols = Array.from({ length: 31 }, (_, i) => i + 1);

    // Calculate column totals
    const colTotals = {};
    dayCols.forEach(day => {
      colTotals[day] = 0;
    });
    let grandTotal = 0;

    rows.forEach(row => {
      dayCols.forEach(day => {
        const val = row.dailyValues[day] || 0;
        colTotals[day] += val;
        grandTotal += val;
      });
    });

    return {
      rows,
      dayCols,
      colTotals,
      grandTotal
    };
  }, [filteredSalesData, pivotMetric, pivotSearch]);

  const handleExportPivot = (format = "csv") => {
    const { rows, dayCols, colTotals, grandTotal } = pivotTableData;
    const titleMetric = pivotMetric === "netSales" ? "실매출액(원)" : "수량(개)";
    const storeLabel = selectedStoreId === "total" ? "전체 매장 통합" : (storeMap[selectedStoreId] || "");
    let periodLabel = selectedPeriod === "all" ? "전체 기간" : selectedPeriod;
    if (selectedPeriod === "custom") {
      periodLabel = `${startDate || "시작일"} ~ ${endDate || "종료일"}`;
    }

    // Build grid data
    const headers = ["메뉴명", "대분류", ...dayCols.map(d => `${d}일`), "합계"];
    const exportRows = rows.map(r => {
      const rowSum = pivotMetric === "netSales" ? r.totalSales : r.totalQty;
      return [
        r.name,
        r.category,
        ...dayCols.map(d => r.dailyValues[d] || 0),
        rowSum
      ];
    });

    // Add totals row
    exportRows.push([
      "일자별 총합계",
      "-",
      ...dayCols.map(d => colTotals[d]),
      grandTotal
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...exportRows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "피벗데이터");

    if (format === "xlsx") {
      XLSX.writeFile(workbook, `${storeLabel}_${periodLabel}_매출피벗_${pivotMetric}.xlsx`);
    } else {
      // Export CSV
      const csvContent = XLSX.utils.sheet_to_csv(worksheet);
      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `${storeLabel}_${periodLabel}_매출피벗_${pivotMetric}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Helper formatter
  const formatWon = (value) => {
    if (value >= 100000000) {
      return `${(value / 100000000).toFixed(1)}억원`;
    }
    if (value >= 10000) {
      return `${(value / 10000).toLocaleString(undefined, { maximumFractionDigits: 1 })}만원`;
    }
    return `${value.toLocaleString()}원`;
  };

  const formatRawWon = (value) => {
    if (value === undefined || value === null) return "0원";
    return `${Math.round(value).toLocaleString()}원`;
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#090b11] text-[#f4f4f7] flex flex-col justify-center items-center font-sans">
        <RefreshCw className="animate-spin text-indigo-500 w-12 h-12 mb-4" />
        <p className="text-slate-400 font-medium">대시보드 데이터를 불러오고 있습니다...</p>
      </div>
    );
  }

  // Authentication Gate Screen
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#090b11] text-[#f4f4f7] flex items-center justify-center font-sans relative overflow-hidden px-4">
        {/* Dynamic glowing background blobs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDelay: "2s" }}></div>

        {/* Login Container */}
        <div className="w-full max-w-md glass-card border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-8 relative z-10">
          
          {/* Header Title */}
          <div className="text-center space-y-3 mb-8">
            <div className="mx-auto w-12 h-12 bg-gradient-to-tr from-indigo-500 to-cyan-500 rounded-2xl flex items-center justify-center text-white shadow-[0_0_20px_rgba(99,102,241,0.5)]">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">(주)올이유</h2>
              <h3 className="text-sm font-bold text-indigo-400 mt-1 uppercase tracking-wider">매장 데이터 분석 시스템</h3>
            </div>
            <div className="h-[1px] w-12 bg-indigo-500/30 mx-auto mt-4"></div>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            {loginError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span className="font-semibold">{loginError}</span>
              </div>
            )}

            {/* ID Field */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">관리자 ID</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="아이디를 입력하세요"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-[#121622] border border-white/5 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500/50 transition-all font-semibold"
                />
              </div>
            </div>

            {/* PW Field */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">비밀번호</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="비밀번호를 입력하세요"
                  value={loginPw}
                  onChange={(e) => setLoginPw(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 bg-[#121622] border border-white/5 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500/50 transition-all font-semibold"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 mt-6 active:scale-[0.98]"
            >
              <ShieldCheck className="w-4 h-4" />
              보안 로그인
            </button>
          </form>

          {/* Footer branding */}
          <div className="mt-8 text-center text-[9px] text-slate-500 font-medium">
            © 2026 (주)올이유 · OKPOS SalesHub Corp. All rights reserved.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* ----------------------------------------------------
          TOP NAVIGATION BAR
          ---------------------------------------------------- */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#090b11]/90 backdrop-blur-md px-4 py-3 lg:px-6 lg:py-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-indigo-500 to-cyan-500 p-2 rounded-xl text-white shadow-[0_0_15px_rgba(99,102,241,0.4)] flex-shrink-0">
              <Store className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent leading-none">
                OKPOS SalesHub
              </h1>
              <p className="text-[9px] md:text-[11px] text-indigo-400 font-medium tracking-wide mt-1">외식 프랜차이즈 다지점 매출 분석 대시보드</p>
            </div>
          </div>
        </div>

        {/* Global Navigation Tabs */}
        <div className="flex items-center bg-[#131722] p-1 rounded-xl border border-white/5 w-full md:w-auto overflow-x-auto justify-start md:justify-center scrollbar-none">
          <button
            onClick={() => setGlobalTab("dashboard")}
            className={`flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-semibold transition-all whitespace-nowrap ${
              globalTab === "dashboard"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5 md:w-4 md:h-4 flex-shrink-0" />
            대시보드
          </button>
          <button
            onClick={() => setGlobalTab("pivot")}
            className={`flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-semibold transition-all whitespace-nowrap ${
              globalTab === "pivot"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Table className="w-3.5 h-3.5 md:w-4 md:h-4 flex-shrink-0" />
            피벗 테이블
          </button>
          <button
            onClick={() => setGlobalTab("upload")}
            className={`flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-semibold transition-all whitespace-nowrap ${
              globalTab === "upload"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Upload className="w-3.5 h-3.5 md:w-4 md:h-4 flex-shrink-0" />
            업로드 허브
          </button>
          <button
            onClick={() => setGlobalTab("cost")}
            className={`flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-semibold transition-all whitespace-nowrap ${
              globalTab === "cost"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <DollarSign className="w-3.5 h-3.5 md:w-4 md:h-4 flex-shrink-0" />
            원가/손익 분석
          </button>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-start">
          <button
            onClick={() => handleDownloadSampleExcel("금막창 종로점", "2026-08")}
            className="flex items-center gap-1 px-2.5 py-1.5 md:px-3 md:py-1.5 rounded-lg text-[10px] md:text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/20 transition-all flex-1 md:flex-initial justify-center whitespace-nowrap"
            title="테스트용 OKPOS 엑셀 파일을 다운로드합니다."
          >
            <Download className="w-3.5 h-3.5 flex-shrink-0" />
            <span>샘플 다운</span>
          </button>
          <button
            onClick={handleOpenAddStore}
            className="flex items-center gap-1 px-2.5 py-1.5 md:px-3 md:py-1.5 rounded-lg text-[10px] md:text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all flex-1 md:flex-initial justify-center whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 flex-shrink-0" />
            <span>매장 추가</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 px-2.5 py-1.5 md:px-3 md:py-1.5 rounded-lg text-[10px] md:text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/25 transition-all flex-1 md:flex-initial justify-center whitespace-nowrap"
          >
            <Lock className="w-3.5 h-3.5 flex-shrink-0" />
            <span>로그아웃</span>
          </button>
        </div>
      </header>

      {/* ----------------------------------------------------
          SUB BAR: STORES CAROUSEL & TABS
          ---------------------------------------------------- */}
      {globalTab === "dashboard" && (
        <div className="bg-[#0b0e17] border-b border-white/5 px-4 py-2.5 lg:px-6 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="w-full lg:flex-1 overflow-x-auto flex items-center gap-2 pb-2 lg:pb-0 pr-4 scrollbar-thin">
            <button
              onClick={() => setSelectedStoreId("total")}
              className={`flex-shrink-0 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedStoreId === "total"
                  ? "bg-[#1f2638] text-indigo-400 border border-indigo-500/30"
                  : "bg-white/5 text-slate-400 hover:text-slate-200 border border-transparent"
              }`}
            >
              전체 매장 통합
            </button>
            <div className="w-[1px] h-4 bg-white/10 flex-shrink-0"></div>
            {stores.map((store) => (
              <div
                key={store.id}
                onClick={() => setSelectedStoreId(store.id)}
                className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border transition-all ${
                  selectedStoreId === store.id
                    ? "bg-[#1f2638] text-indigo-400 border-indigo-500/30 font-bold"
                    : "bg-white/5 text-slate-400 hover:text-slate-200 border-transparent"
                }`}
              >
                <span>{store.name}</span>
                <span className="text-[9px] text-slate-500">({store.category})</span>
                <button
                  onClick={(e) => handleOpenEditStore(store, e)}
                  className="hover:text-indigo-400 p-0.5"
                  title="지점 수정"
                >
                  <Edit className="w-2.5 h-2.5" />
                </button>
                <button
                  onClick={(e) => handleDeleteStore(store.id, e)}
                  className="hover:text-rose-400 p-0.5 text-slate-600"
                  title="지점 삭제"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
            <button
              onClick={handleOpenAddStore}
              className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/5 transition-all border border-dashed border-white/10 hover:border-indigo-500/20"
            >
              <PlusCircle className="w-3 h-3" />
              지점 추가
            </button>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 w-full lg:w-auto justify-start sm:justify-between lg:justify-start flex-wrap">
            {/* Period */}
            <div className="flex items-center gap-2 flex-wrap flex-1 sm:flex-initial">
              <div className="flex items-center bg-[#131722] rounded-lg px-2.5 py-1 border border-white/5 text-xs flex-1 sm:flex-initial justify-between sm:justify-start">
                <div className="flex items-center">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400 mr-1.5" />
                  <select
                    value={selectedPeriod}
                    onChange={(e) => handlePeriodDropdownChange(e.target.value)}
                    className="bg-transparent border-none text-slate-300 font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="all" className="bg-[#131722]">전체 기간</option>
                    {availablePeriods.map(p => (
                      <option key={p} value={p} className="bg-[#131722]">
                        {p.replace("-", "년 ")}월
                      </option>
                    ))}
                    <option value="custom" className="bg-[#131722]">직접 지정</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center bg-[#131722] rounded-lg px-2 py-0.5 border border-white/5 text-xs gap-1 flex-1 sm:flex-initial justify-center">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="bg-transparent border-none text-slate-300 font-semibold focus:outline-none cursor-pointer p-0.5"
                  style={{ colorScheme: 'dark' }}
                />
                <span className="text-slate-500 font-bold">~</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="bg-transparent border-none text-slate-300 font-semibold focus:outline-none cursor-pointer p-0.5"
                  style={{ colorScheme: 'dark' }}
                />
              </div>
            </div>

            {/* Category */}
            <div className="flex items-center bg-[#131722] rounded-lg px-2.5 py-1 border border-white/5 text-xs flex-1 sm:flex-initial justify-between sm:justify-start">
              <div className="flex items-center">
                <Filter className="w-3.5 h-3.5 text-indigo-400 mr-1.5" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-transparent border-none text-slate-300 font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-[#131722]">전체 대분류</option>
                  <option value="메인메뉴" className="bg-[#131722]">메인메뉴</option>
                  <option value="식사류/정식류" className="bg-[#131722]">식사류 / 정식류</option>
                  <option value="주류/음료" className="bg-[#131722]">주류 / 음료</option>
                  <option value="사이드/기타" className="bg-[#131722]">사이드 / 기타</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          MAIN CONTENT CONTAINER
          ---------------------------------------------------- */}
      <main className="flex-1 p-6 overflow-y-auto space-y-6 max-w-7xl mx-auto w-full animate-fade-in">
        
        {/* Global Notifications Panel */}
        {uploadStatusMsg.text && (
          <div className={`p-4 rounded-xl border flex items-start gap-3 shadow-lg ${
            uploadStatusMsg.type === "success" 
              ? "bg-emerald-950/30 text-emerald-300 border-emerald-500/20"
              : uploadStatusMsg.type === "warning"
              ? "bg-amber-950/30 text-amber-300 border-amber-500/20"
              : uploadStatusMsg.type === "error"
              ? "bg-rose-950/30 text-rose-300 border-rose-500/20"
              : "bg-indigo-950/30 text-indigo-300 border-indigo-500/20"
          }`}>
            {uploadStatusMsg.type === "success" ? (
              <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
            ) : uploadStatusMsg.type === "error" ? (
              <AlertCircle className="w-5 h-5 text-rose-400 mt-0.5 flex-shrink-0" />
            ) : (
              <Info className="w-5 h-5 text-indigo-400 mt-0.5 flex-shrink-0" />
            )}
            <div>
              <p className="text-sm font-semibold text-white">시스템 알림</p>
              <p className="text-xs text-slate-300 mt-0.5 font-medium">{uploadStatusMsg.text}</p>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------
            TAB 1: INTEGRATED DASHBOARD (selectedStoreId === "total")
            ---------------------------------------------------- */}
        {globalTab === "dashboard" && selectedStoreId === "total" && (
          <div className="space-y-6">
            {/* Store-by-store Monthly Performance Grid */}
            {(() => {
              const today = new Date();
              const currentYear = today.getFullYear();
              const currentMonthNum = today.getMonth() + 1;
              const currentMonthStr = `${currentYear}-${currentMonthNum.toString().padStart(2, "0")}`;
              const currentMonthLabel = `${String(currentYear).substring(2)}년 ${currentMonthNum}월`;

              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <h4 className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                      <Store className="w-4 h-4 text-indigo-400" />
                      지점별 당월 실적 현황 ({currentMonthLabel})
                    </h4>
                    <span className="text-[10px] text-slate-500 font-medium hidden md:inline">
                      * 오늘 날짜 기준 당월 누계 실매출 및 예상 매출 자동 계산
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    {stores.map(store => {
                      let storeMonthSalesSum = 0;
                      const storeMonthDaysWithSales = new Set();

                      salesRecords.forEach(r => {
                        if (r.storeId === store.id && r.date && r.date.startsWith(currentMonthStr)) {
                          storeMonthSalesSum += r.netSales || 0;
                          storeMonthDaysWithSales.add(r.date);
                        }
                      });

                      const storeMonthDays = storeMonthDaysWithSales.size;
                      const storeMonthTotalDays = new Date(currentYear, currentMonthNum, 0).getDate();
                      const storeMonthAvgSales = storeMonthDays > 0 ? (storeMonthSalesSum / storeMonthDays) : 0;
                      const storeMonthEstimatedSales = storeMonthAvgSales * storeMonthTotalDays;

                      return (
                        <div 
                          key={store.id} 
                          className="bg-[#121622] hover:bg-[#161a26]/70 border border-white/5 rounded-xl p-3 flex flex-col justify-between transition-all shadow-sm"
                        >
                          <div>
                            {/* Store Title */}
                            <div className="flex items-center gap-1.5 border-b border-white/5 pb-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                              <span className="text-[11px] font-bold text-white truncate" title={store.name}>
                                {store.name}
                              </span>
                            </div>

                            {/* Store Month Sales */}
                            <div className="mt-2.5">
                              <span className="text-[9px] text-slate-500 font-bold block">실매출액</span>
                              <span className="text-xs font-bold text-slate-200 mt-0.5 block">
                                {storeMonthSalesSum > 0 ? formatRawWon(storeMonthSalesSum) : "0원"}
                              </span>
                            </div>

                            {/* Store Estimated Sales */}
                            <div className="mt-2">
                              <span className="text-[9px] text-indigo-400 font-bold block">예상 매출액</span>
                              <span className="text-xs font-black text-indigo-300 mt-0.5 block cursor-help" title={`${currentMonthNum}월 1일~${storeMonthDays}일까지의 일평균 매출(${formatRawWon(Math.round(storeMonthAvgSales))})을 한 달(${storeMonthTotalDays}일)로 환산한 예상 매출입니다.`}>
                                {storeMonthEstimatedSales > 0 ? formatRawWon(Math.round(storeMonthEstimatedSales)) : "0원"}
                              </span>
                            </div>
                          </div>

                          <div className="mt-2.5 pt-2 border-t border-white/5 flex flex-col gap-0.5">
                            <div className="flex items-center justify-between text-[8px] font-bold">
                              <span className="text-slate-500">최신 데이터</span>
                              <span className="text-emerald-400">{latestDateByStore[store.id] || "없음"}</span>
                            </div>
                            {storeMonthDays > 0 && (
                              <div className="text-[8px] text-slate-600 text-right">
                                (영업 {storeMonthDays}일차 기준)
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}



            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Bar Chart */}
              <div className="lg:col-span-2 glass-card p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-sm font-bold text-white tracking-wide">지점별 매출 비교</h4>
                  <span className="text-xs text-indigo-400 font-semibold">(단위: 만원)</span>
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={storeComparisonChartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis 
                        dataKey="name" 
                        stroke="#94a3b8" 
                        fontSize={11} 
                        tickLine={false} 
                      />
                      <YAxis 
                        stroke="#94a3b8" 
                        fontSize={11} 
                        tickLine={false} 
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: "#161b26", borderColor: "rgba(255,255,255,0.1)", borderRadius: "8px" }}
                        labelStyle={{ color: "#fff", fontWeight: "bold" }}
                        formatter={(value) => [`${value.toLocaleString()} 만원`, "매출"]}
                      />
                      <Bar dataKey="sales" fill="#6366f1" radius={[4, 4, 0, 0]}>
                        {storeComparisonChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Share Donut Chart */}
              <div className="glass-card p-6 rounded-2xl">
                <h4 className="text-sm font-bold text-white tracking-wide mb-6">매출 점유율 (Share)</h4>
                <div className="h-60 relative">
                  {storeContributionChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={storeContributionChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {storeContributionChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: "#161b26", borderColor: "rgba(255,255,255,0.1)", borderRadius: "8px" }}
                          formatter={(value) => [`${formatWon(value)}`, "매출"]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-500 text-xs">데이터 없음</div>
                  )}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Sales</span>
                    <span className="text-lg font-black text-white mt-0.5">{formatWon(totalSummary.netSales)}</span>
                  </div>
                </div>
                {/* Legend List */}
                <div className="mt-4 max-h-32 overflow-y-auto grid grid-cols-2 gap-2 pr-1">
                  {storeContributionChartData.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></span>
                      <span className="text-slate-300 font-medium truncate" title={item.name}>{item.name}</span>
                      <span className="text-slate-500 ml-auto font-semibold">
                        {((item.value / totalSummary.netSales) * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Store Grid Cards Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <Store className="w-5 h-5 text-indigo-400" />
                  지점별 매출 현황
                </h4>
                <p className="text-xs text-slate-500">카드를 클릭하면 상세 대시보드로 이동합니다.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {storeGridCardsData.map((store) => (
                  <div
                    key={store.id}
                    onClick={() => setSelectedStoreId(store.id)}
                    className="glass-card p-5 rounded-2xl cursor-pointer relative group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            {store.category}
                          </span>
                          <h5 className="text-base font-bold text-white mt-1.5 group-hover:text-indigo-400 transition-colors">
                            {store.name}
                          </h5>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                      </div>

                      <div className="mt-4 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">기간 매출액</span>
                          <span className="font-bold text-slate-200">{formatWon(store.totalSales)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">일평균 매출</span>
                          <span className="font-semibold text-slate-300">{formatWon(store.dailyAvg)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">최근 업로드</span>
                          <span className="text-slate-400 font-semibold">{store.latestUploadPeriod}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setGlobalTab("upload");
                        }}
                        className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-all"
                      >
                        <Upload className="w-3 h-3" />
                        데이터 업로드
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------
            TAB 2: INDIVIDUAL STORE DETAIL DASHBOARD
            ---------------------------------------------------- */}
        {globalTab === "dashboard" && selectedStoreId !== "total" && (
          <div className="space-y-6">
            {/* Sub-header with Store summary */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-6 rounded-2xl border-l-4 border-l-indigo-500">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    {stores.find(s => s.id === selectedStoreId)?.category}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">지점 분석 정보</span>
                  <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Calendar className="w-3 h-3 text-emerald-400" />
                    최신 데이터: {latestDateByStore[selectedStoreId] || "데이터 없음"}
                  </span>
                </div>
                <h3 className="text-2xl font-black text-white mt-1.5 flex items-center gap-2">
                  {storeMap[selectedStoreId]}
                  <span className="text-sm font-normal text-slate-400">대시보드</span>
                </h3>
              </div>

              {/* Period statistics */}
              <div className="grid grid-cols-2 md:flex md:items-center gap-4 md:gap-6 mt-4 md:mt-0 w-full md:w-auto">
                <div className="bg-white/2 md:bg-transparent p-2.5 md:p-0 rounded-xl border border-white/5 md:border-none">
                  <p className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-wider">{totalSummary.currentMonthLabel}</p>
                  <p className="text-base md:text-lg font-extrabold text-indigo-400 mt-0.5">
                    {formatRawWon(totalSummary.currentMonthSalesSum)}
                  </p>
                </div>
                {totalSummary.currentMonthEstimatedSales > 0 && (
                  <>
                    <div className="hidden md:block w-[1px] h-8 bg-white/10"></div>
                    <div className="bg-white/2 md:bg-transparent p-2.5 md:p-0 rounded-xl border border-white/5 md:border-none">
                      <p className="text-[9px] md:text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-indigo-400" />
                        {totalSummary.currentMonthNum}월 예상 매출
                      </p>
                      <p className="text-base md:text-lg font-black text-white mt-0.5 cursor-help" title={`${totalSummary.currentMonthNum}월 1일~${totalSummary.currentMonthDays}일까지의 일평균 매출(${formatRawWon(Math.round(totalSummary.currentMonthAvgSales))})을 한 달(${totalSummary.currentMonthTotalDays}일)로 환산한 예상 총매출입니다.`}>
                        {formatRawWon(Math.round(totalSummary.currentMonthEstimatedSales))}
                      </p>
                    </div>
                  </>
                )}
                <div className="hidden md:block w-[1px] h-8 bg-white/10"></div>
                <div className="bg-white/2 md:bg-transparent p-2.5 md:p-0 rounded-xl border border-white/5 md:border-none">
                  <p className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-wider">일평균 매출</p>
                  <p className="text-base md:text-lg font-bold text-white mt-0.5">
                    {formatRawWon(totalSummary.dailyAvgSales)}
                  </p>
                </div>
                <div className="hidden md:block w-[1px] h-8 bg-white/10"></div>
                <div className="bg-white/2 md:bg-transparent p-2.5 md:p-0 rounded-xl border border-white/5 md:border-none">
                  <p className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-wider">최고 매출일 ({totalSummary.peakDay})</p>
                  <p className="text-base md:text-lg font-bold text-emerald-400 mt-0.5">
                    {formatRawWon(totalSummary.peakSales)}
                  </p>
                </div>
              </div>
            </div>

            {/* ----------------------------------------------------
                AI CONSULTANT CARD
                ---------------------------------------------------- */}
            <div className="glass-card p-6 rounded-2xl border border-white/5 relative overflow-hidden">
              {/* Background gradient lighting for AI container */}
              <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-[80px] pointer-events-none"></div>

              {/* Title & Tab Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="bg-gradient-to-tr from-purple-500 to-indigo-500 p-2 rounded-xl text-white shadow-md shadow-purple-500/20">
                    <Brain className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                      올이유 AI 매장 분석 컨설턴트
                      <span className="bg-indigo-500/10 text-indigo-400 text-[8px] font-extrabold px-1.5 py-0.5 rounded border border-indigo-500/20">BETA</span>
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-1">
                      지점의 매출 데이터와 메뉴 분석, 그리고 최신 사회 이슈를 매칭한 맞춤형 영업 전략을 진단받으세요.
                    </p>
                  </div>
                </div>

                {/* AI Menu Tabs */}
                {aiAnalysisState === "done" && (
                  <div className="flex items-center bg-[#131722] p-0.5 rounded-lg border border-white/5 text-xs">
                    <button
                      onClick={() => setAiActiveTab("report")}
                      className={`px-3 py-1.5 rounded font-semibold transition-all ${
                        aiActiveTab === "report" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      AI 진단 보고서
                    </button>
                    <button
                      onClick={() => setAiActiveTab("chat")}
                      className={`px-3 py-1.5 rounded font-semibold transition-all flex items-center gap-1.5 ${
                        aiActiveTab === "chat" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <Bot className="w-3.5 h-3.5" />
                      실시간 AI 챗봇
                    </button>
                  </div>
                )}
              </div>

              {/* Body: State-driven rendering */}
              {aiAnalysisState === "idle" && (
                <div className="py-6 flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 bg-white/2 border border-white/5 rounded-full flex items-center justify-center text-indigo-400 shadow-inner">
                    <Sparkles className="w-8 h-8 animate-pulse text-indigo-400" />
                  </div>
                  <div className="max-w-md space-y-1.5">
                    <h5 className="text-xs font-bold text-white">분석 보고서가 생성되지 않았습니다.</h5>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      'AI 분석 보고서 생성' 버튼을 클릭하면 지점 매출 성과 요약, 베스트 메뉴 매진 분석 및 8월 폭염 지수/외식 물가 인플레이션 등 현재의 사회이슈를 조합해 맞춤 제언을 드립니다.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setAiAnalysisState("loading");
                      setAiAnalysisStep(1);
                      // Simulated step-by-step processing
                      setTimeout(() => setAiAnalysisStep(2), 600);
                      setTimeout(() => setAiAnalysisStep(3), 1200);
                      setTimeout(() => {
                        setAiAnalysisState("done");
                        setAiActiveTab("report");
                        
                        // Set up initial greeting in chatbot
                        const storeName = storeMap[selectedStoreId] || "선택 매장";
                        const welcomeMsg = {
                          sender: "ai",
                          text: `안녕하세요! **(주)올이유 AI 컨설턴트**입니다. 🤖\n\n**${storeName}** 지점의 8월 매출 추이(실매출액 **${formatRawWon(totalSummary.currentMonthSalesSum)}**)와 메뉴 판매 구조 분석을 마쳤습니다.\n\n왼쪽의 **[AI 진단 보고서]** 탭에서 상세 리포트를 확인하실 수 있습니다. 이외에 더 궁금한 매출 분석이나 메뉴 결합 마케팅에 대해 질문이 있으시다면 아래 버튼을 누르거나 대화창에 편하게 질문을 입력해 주세요!`,
                          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        };
                        setChatMessages([welcomeMsg]);
                      }, 1800);
                    }}
                    className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/25 flex items-center gap-1.5 active:scale-95"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    올이유 AI 분석 보고서 생성
                  </button>
                </div>
              )}

              {aiAnalysisState === "loading" && (
                <div className="py-10 flex flex-col items-center space-y-4">
                  <div className="w-12 h-12 bg-white/2 border border-white/5 rounded-full flex items-center justify-center">
                    <RefreshCw className="animate-spin text-purple-400 w-6 h-6" />
                  </div>
                  <div className="space-y-1.5 text-center">
                    <p className="text-xs font-bold text-white animate-pulse">
                      {aiAnalysisStep === 1 && "지점 매출 장부 데이터 스캔 중..."}
                      {aiAnalysisStep === 2 && "상품군 판매 기여도 및 피벗 데이터 매칭 중..."}
                      {aiAnalysisStep === 3 && "8월 도심지 폭염 지수 및 외식 원가 사회적 이슈 융합 중..."}
                    </p>
                    <p className="text-[9px] text-slate-500">
                      올이유 AI 컨설턴트가 최적의 분석 결과를 도출하고 있습니다. 잠시만 기다려주세요.
                    </p>
                  </div>
                </div>
              )}

              {aiAnalysisState === "done" && aiActiveTab === "report" && (
                <div className="bg-[#121622]/50 border border-white/5 rounded-xl p-5 text-xs text-slate-300 leading-relaxed font-sans space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar animate-fade-in whitespace-pre-line">
                  {/* We dynamically generate the report text here */}
                  {(() => {
                    const storeName = storeMap[selectedStoreId] || "지점";
                    const menuData = menuAbcAnalysisData || [];
                    const weekdayData = weekdayPatternChartData || [];
                    
                    // Generate Top A-grade menus
                    const topMenus = menuData.slice(0, 3).map(m => `${m.name}(${m.grade}등급, 점유율 ${m.sharePercent.toFixed(1)}%)`).join(", ");
                    
                    // Identify strongest sales day
                    let bestDayName = "금/토/일";
                    if (weekdayData && weekdayData.length > 0) {
                      const sorted = [...weekdayData].sort((a,b) => b.sales - a.sales);
                      bestDayName = `${sorted[0].name}요일`;
                    }

                    // Category specific social issues
                    let categoryIssue = "";
                    let marketingStrategy = "";
                    if (storeName.includes("금등어")) {
                      categoryIssue = "최근 해산물 원산지 신뢰성에 대한 사회적 관심과 건강식에 대한 선호도가 맞물려 있습니다. 8월 기록적 폭염으로 인해 불앞에서 직접 굽는 고기류 대비 화덕에서 구워 나오는 고등어구이의 외식 선호도가 15% 이상 상승한 계절적 영향이 반영되었습니다.";
                      marketingStrategy = "평일 점심 직장인 타겟의 '화덕 고등어구이 정식 묶음 할인 이벤트'로 점심 테이블 회전율을 1.2배 끌어올리고, 저녁 시간대에는 주류 소비 유도를 위해 칼칼한 고등어 조림 세트 메뉴 구성을 제안합니다.";
                    } else if (storeName.includes("고기9단")) {
                      categoryIssue = "미국산 및 한우 도매 원가 변동 이슈가 지속되고 있으며, 8월 혹서기로 인해 시원하고 쾌적한 대형 고기 전문점 패밀리 다이닝 수요가 주말에 집중되었습니다. 특히 소고기 구이류에 동반되는 신선 쌈채소 수급 비용 상승으로 인해 마진율 방어가 주요 과제입니다.";
                      marketingStrategy = "A등급 주력 메뉴인 생갈비살의 강점을 활용하되, 마진 보완을 위해 여름철 냉면/찌개류 등 사이드 메뉴의 단독 마케팅을 강화하고, 주말 가족 단위 고객 유치를 위해 '3인 이상 방문 시 패밀리 세트 업그레이드' 프로모션을 추천합니다.";
                    } else if (storeName.includes("포크팬")) {
                      categoryIssue = "여름 휴가철 및 대학생 방학 시즌과 겹쳐 평일 단체 모임 수요가 주춤한 반면, 가성비 위주의 무한리필 소비 성향은 고물가 시대에 맞춰 강화되고 있습니다. 삼겹살/목살 원재료 가격 상승 압박이 있지만 단체 회식 및 소셜 모임 유치로 박리다매 매출 성장을 지속하고 있습니다.";
                      marketingStrategy = "방학 시즌 청년층 타겟으로 'SNS 해시태그 리뷰 시 음료 제공' 바이럴 프로모션을 실행하고, 주말 단체 고객(4인 이상) 대상 사전 예약 시 '무료 김치찌개 서비스'를 제공하여 빈 좌석율을 15% 감축하는 전략이 유효합니다.";
                    } else if (storeName.includes("막창")) {
                      categoryIssue = "8월 열대야 일수가 늘어남에 따라 야간(20시~24시) 술자리 막창 소비량이 강세를 보입니다. 다만 알코올 음용률 감소 트렌드에 따라 무알콜 맥주나 하이볼 등 트렌디한 저도수 음료의 매출 결합 요구가 늘어나고 있습니다.";
                      marketingStrategy = "A등급 주력 곱창/막창 구이와 함께 '얼음 피치 하이볼'이나 탄산음료를 곁들인 2인 세트를 기획하여 테이블 단가를 높이고, 주말 21시 이후 방문 고객을 타겟으로 '소주 1+1' 또는 사이드 껍데기 증정 타임 세일을 권장합니다.";
                    } else {
                      categoryIssue = "고물가로 인한 외식 경기 둔화 속에서 한식 및 식사류의 안정적인 기본 수요가 유지되고 있습니다. 8월 휴가철 일시적인 도심 배후지 트래픽 감소 영향이 소폭 관찰되나, 가성비 식사 메뉴 중심의 견조한 재방문율이 전체 매출을 지지하고 있습니다.";
                      marketingStrategy = "마진이 좋은 특선 사이드 메뉴(예: 청국장 정식과 곁들임 두부구이 등)의 세트 결합 판매를 장려하고, 2+1 식사권 증정 등의 지역 거주민 대상 재방문 쿠폰 프로모션을 기획할 것을 제안합니다.";
                    }

                    return (
                      <div className="space-y-4">
                        <div>
                          <span className="font-bold text-white text-xs block mb-1">📊 1. 매출 성과 종합 분석</span>
                          <p className="pl-4 text-slate-300">
                            • 당월 매출 현황: 현재 8월 실매출액은 <span className="text-white font-bold">{formatRawWon(totalSummary.currentMonthSalesSum)}</span>이며, 영업 {totalSummary.currentMonthDays}일차 기준의 일평균 매출은 <span className="text-white font-bold">{formatRawWon(Math.round(totalSummary.currentMonthAvgSales))}</span>입니다.<br/>
                            • 예상 매출 전망: 현재 추세가 31일까지 유지될 경우, 8월 예상 총매출액은 <span className="text-indigo-300 font-bold">{formatRawWon(Math.round(totalSummary.currentMonthEstimatedSales))}</span>으로 예상됩니다.<br/>
                            • 매출 집중 요일: 이번 달 데이터 상 주간 최고 매출 요일은 <span className="text-emerald-400 font-bold">{bestDayName}</span>로 집계되었으며, 이 요일들의 주말 평균 단가가 평일 대비 높은 수준을 유지하고 있습니다.
                          </p>
                        </div>
                        <div className="border-t border-white/5 pt-3">
                          <span className="font-bold text-white text-xs block mb-1">🍽️ 2. 상품 및 메뉴 인사이트</span>
                          <p className="pl-4 text-slate-300">
                            • A등급 베스트 메뉴: 현재 매장 매출 기여도가 가장 높은 핵심 상품은 <span className="text-white font-bold">{topMenus}</span> 입니다.<br/>
                            • 카테고리 건전성: 이들 A등급 메뉴가 매장 전체 매출의 약 <span className="text-indigo-300 font-bold">{(menuData.slice(0, 3).reduce((sum, m) => sum + m.sharePercent, 0)).toFixed(1)}%</span>를 견인하고 있어 집중도가 다소 높은 편입니다. 비인기 카테고리(C등급)의 마진율 높은 곁들임 메뉴들을 활용해 메뉴 결합 판매를 늘려야 합니다.
                          </p>
                        </div>
                        <div className="border-t border-white/5 pt-3">
                          <span className="font-bold text-white text-xs block mb-1">🌡️ 3. 사회 이슈 및 외부 변수 영향</span>
                          <p className="pl-4 text-slate-300">
                            • 폭염 및 계절적 영향: {categoryIssue}<br/>
                            • 물가 인플레이션 압박: 최근 원재료 가격 수급 인플레이션 압박에 대응하여 원가 비중이 높은 고부가가치 식자재의 재고를 주단위로 타이트하게 정산할 것을 당부합니다.
                          </p>
                        </div>
                        <div className="border-t border-white/5 pt-3">
                          <span className="font-bold text-white text-xs block mb-1">💡 4. 올이유 맞춤형 액션 전략 (Action Plan)</span>
                          <p className="pl-4 text-slate-300">
                            • 단기 마케팅 프로모션: {marketingStrategy}<br/>
                            • 경영 제언: 대시보드의 실시간 매출 트렌드 선그래프를 모니터링하여 평일 저녁 골든타임의 공백을 메우기 위한 인근 오피스/주민 타겟 알림 쿠폰 발송 시스템과 결합하면 최적의 매출 부스팅 시너지가 날 것입니다.
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {aiAnalysisState === "done" && aiActiveTab === "chat" && (
                <div className="space-y-4 animate-fade-in">
                  {/* Chat Message Logs Area */}
                  <div className="bg-[#121622]/50 border border-white/5 rounded-xl p-4 h-64 overflow-y-auto custom-scrollbar flex flex-col space-y-3.5">
                    {chatMessages.map((msg, idx) => (
                      <div 
                        key={idx} 
                        className={`flex gap-2.5 max-w-[85%] ${msg.sender === "user" ? "self-end flex-row-reverse" : "self-start"}`}
                      >
                        {/* Avatar */}
                        {msg.sender === "ai" && (
                          <div className="w-7 h-7 bg-gradient-to-tr from-purple-500 to-indigo-500 rounded-lg flex items-center justify-center text-white flex-shrink-0">
                            <Bot className="w-4 h-4" />
                          </div>
                        )}
                        
                        {/* Text bubble */}
                        <div>
                          <div 
                            className={`p-3 rounded-xl text-xs leading-relaxed whitespace-pre-line ${
                              msg.sender === "user" 
                                ? "bg-indigo-600 text-white rounded-tr-none" 
                                : "bg-[#161a26] text-slate-200 border border-white/5 rounded-tl-none"
                            }`}
                          >
                            {msg.text}
                          </div>
                          <span className="text-[8px] text-slate-600 block mt-1 text-right">{msg.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Quick Pills Option Buttons */}
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    <button
                      onClick={() => {
                        const q = "우리 매장의 요일별 매출 특성은 어때?";
                        setChatInput("");
                        executeChatQuery(q);
                      }}
                      className="px-3 py-1.5 bg-[#121622] hover:bg-[#161a26] border border-white/5 text-slate-400 hover:text-slate-200 rounded-lg transition-all"
                    >
                      📈 요일별 매출 패턴 분석
                    </button>
                    <button
                      onClick={() => {
                        const q = "가장 판매율이 높은 인기 메뉴 Top 3는 뭐야?";
                        setChatInput("");
                        executeChatQuery(q);
                      }}
                      className="px-3 py-1.5 bg-[#121622] hover:bg-[#161a26] border border-white/5 text-slate-400 hover:text-slate-200 rounded-lg transition-all"
                    >
                      🍽️ 베스트 인기 메뉴 리포트
                    </button>
                    <button
                      onClick={() => {
                        const q = "여름 폭염/원가 상승 관련해서 어떤 이벤트를 하면 좋을까?";
                        setChatInput("");
                        executeChatQuery(q);
                      }}
                      className="px-3 py-1.5 bg-[#121622] hover:bg-[#161a26] border border-white/5 text-slate-400 hover:text-slate-200 rounded-lg transition-all"
                    >
                      💡 지점 맞춤형 마케팅 추천
                    </button>
                  </div>

                  {/* Input Chat Input Box */}
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!chatInput.trim()) return;
                      executeChatQuery(chatInput);
                      setChatInput("");
                    }} 
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      placeholder="매출, 요일, 인기 메뉴, 프로모션 제언 등 질문을 입력하세요..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      className="flex-1 px-4 py-2.5 bg-[#121622] border border-white/5 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500/50 transition-all font-medium"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-1 active:scale-95"
                    >
                      <Send className="w-3.5 h-3.5" />
                      전송
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* Trends Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Daily / Monthly / Yearly trend chart */}
              <div className="lg:col-span-2 glass-card p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-sm font-bold text-white tracking-wide">
                    {storeTrendPeriod === "daily" ? "일자별 매출 추이" : storeTrendPeriod === "monthly" ? "월별 매출 비교" : "연간 매출 비교"}
                  </h4>
                  <div className="flex items-center gap-4">
                    {/* Period Toggle Group */}
                    <div className="flex items-center bg-[#131722] p-0.5 rounded-lg border border-white/5 text-[10px]">
                      <button
                        onClick={() => setStoreTrendPeriod("daily")}
                        className={`px-2.5 py-1 rounded font-bold transition-all ${
                          storeTrendPeriod === "daily" ? "bg-indigo-600 text-white" : "text-slate-400"
                        }`}
                      >
                        일별
                      </button>
                      <button
                        onClick={() => setStoreTrendPeriod("monthly")}
                        className={`px-2.5 py-1 rounded font-bold transition-all ${
                          storeTrendPeriod === "monthly" ? "bg-indigo-600 text-white" : "text-slate-400"
                        }`}
                      >
                        월별
                      </button>
                      <button
                        onClick={() => setStoreTrendPeriod("yearly")}
                        className={`px-2.5 py-1 rounded font-bold transition-all ${
                          storeTrendPeriod === "yearly" ? "bg-indigo-600 text-white" : "text-slate-400"
                        }`}
                      >
                        연간
                      </button>
                    </div>
                    <span className="text-xs text-indigo-400 font-semibold">(단위: 만원)</span>
                  </div>
                </div>
                <div className="h-72">
                  {storeTrendChartData.length > 0 ? (
                    storeTrendPeriod === "daily" ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={storeTrendChartData}
                          margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                          <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} />
                          <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: "#161b26", borderColor: "rgba(255,255,255,0.1)", borderRadius: "8px" }}
                            formatter={(value) => [`${value.toLocaleString()} 만원`, "매출"]}
                          />
                          <Line
                            type="monotone"
                            dataKey="sales"
                            stroke="#6366f1"
                            strokeWidth={3}
                            dot={false}
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={storeTrendChartData}
                          margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                          <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} />
                          <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: "#161b26", borderColor: "rgba(255,255,255,0.1)", borderRadius: "8px" }}
                            formatter={(value) => [`${value.toLocaleString()} 만원`, "매출"]}
                          />
                          <Bar dataKey="sales" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-500 text-xs">데이터 없음</div>
                  )}
                </div>
              </div>

              {/* Weekday sales patterns */}
              <div className="glass-card p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-sm font-bold text-white tracking-wide">요일별 매출 패턴 (평균)</h4>
                  <span className="text-xs text-indigo-400 font-semibold">(단위: 만원)</span>
                </div>
                <div className="h-72">
                  {weekdayPatternChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={weekdayPatternChartData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: "#161b26", borderColor: "rgba(255,255,255,0.1)", borderRadius: "8px" }}
                          formatter={(value) => [`${value} 만원`, "평균 매출"]}
                        />
                        <Bar dataKey="sales" fill="#06b6d4" radius={[4, 4, 0, 0]}>
                          {weekdayPatternChartData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={entry.name === "금" || entry.name === "토" || entry.name === "일" ? "#6366f1" : "#06b6d4"} 
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-500 text-xs">데이터 없음</div>
                  )}
                </div>
              </div>
            </div>

            {/* Yearly & Monthly Comparison Section */}
            {selectedStoreId !== "total" && (
              <div className="glass-card p-6 rounded-2xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4 mb-6">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <BarChart2 className="w-4 h-4 text-indigo-400" />
                      년도별 · 월별 매출 비교 분석
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-1">
                      원하는 년도를 선택하여 월별 매출 성과를 비교하세요. (26년은 현재 시간 기준 {new Date().getMonth() + 1}월까지 표기)
                    </p>
                  </div>

                  {/* Year pills */}
                  <div className="flex items-center bg-[#131722] p-0.5 rounded-lg border border-white/5 text-xs">
                    {availableYears.map(yr => (
                      <button
                        key={yr}
                        onClick={() => setCompareYear(yr)}
                        className={`px-3 py-1.5 rounded font-semibold transition-all ${
                          compareYear === yr
                            ? "bg-indigo-600 text-white"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {yr}년
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                  {/* Chart (col-span-2) */}
                  <div className="lg:col-span-2 h-72">
                    {monthlyCompareData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={monthlyCompareData}
                          margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                          <XAxis dataKey="monthLabel" stroke="#94a3b8" fontSize={10} tickLine={false} />
                          <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: "#161b26", borderColor: "rgba(255,255,255,0.1)", borderRadius: "8px" }}
                            formatter={(value) => [`${value.toLocaleString()} 만원`, "매출"]}
                          />
                          <Bar dataKey="sales" fill="url(#barGradient)" radius={[4, 4, 0, 0]} />
                          <defs>
                            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#6366f1" />
                              <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.4} />
                            </linearGradient>
                          </defs>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-500 text-xs">데이터 없음</div>
                    )}
                  </div>

                  {/* Summary grid (col-span-1) */}
                  <div className="bg-[#121622] p-4.5 rounded-xl border border-white/5 space-y-4 text-xs">
                    <h5 className="font-bold text-white border-b border-white/5 pb-2">
                      {compareYear}년 매출 요약
                    </h5>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-slate-400">총 매출액</span>
                        <span className="font-bold text-white">
                          {formatRawWon(monthlyCompareData.reduce((sum, m) => sum + m.salesRaw, 0))}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">최고 매출 월</span>
                        <span className="font-bold text-emerald-400">
                          {(() => {
                            if (monthlyCompareData.length === 0) return "-";
                            const maxM = [...monthlyCompareData].sort((a, b) => b.salesRaw - a.salesRaw)[0];
                            return maxM && maxM.salesRaw > 0 ? `${maxM.monthLabel} (${formatRawWon(maxM.salesRaw)})` : "-";
                          })()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">월평균 매출액</span>
                        <span className="font-bold text-indigo-400">
                          {(() => {
                            if (monthlyCompareData.length === 0) return "0원";
                            const total = monthlyCompareData.reduce((sum, m) => sum + m.salesRaw, 0);
                            return formatRawWon(Math.round(total / monthlyCompareData.length));
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Menu Analysis Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Menu ABC Grades Table */}
              <div className="glass-card p-6 rounded-2xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Award className="w-5 h-5 text-indigo-400" />
                      메뉴 ABC 등급 분석 (누적 매출 기준)
                    </h4>
                    <span className="text-[10px] text-slate-500 font-medium">A: 70%이내 | B: 70~90% | C: 하위 10%</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 text-slate-500">
                          <th className="py-2.5 font-semibold">순위</th>
                          <th className="py-2.5 font-semibold">메뉴명</th>
                          <th className="py-2.5 font-semibold">대분류</th>
                          <th className="py-2.5 font-semibold text-right">수량</th>
                          <th className="py-2.5 font-semibold text-right">실매출액</th>
                          <th className="py-2.5 font-semibold text-right">비중(누적)</th>
                          <th className="py-2.5 font-semibold text-center">등급</th>
                        </tr>
                      </thead>
                      <tbody>
                        {menuAbcAnalysisData.map((menu) => {
                          const isSelected = selectedMenuName === menu.name;
                          return (
                            <tr 
                              key={menu.name} 
                              onClick={() => {
                                setSelectedMenuName(menu.name);
                                setRightCardMode("menuTrend");
                              }}
                              className={`border-b border-white/5 cursor-pointer hover:bg-indigo-500/5 transition-all ${
                                isSelected ? "bg-indigo-500/10 border-l-2 border-l-indigo-500" : ""
                              }`}
                            >
                              <td className="py-2.5 px-2 font-bold text-slate-400">{menu.rank}</td>
                              <td className="py-2.5 font-bold text-white hover:text-indigo-400 transition-colors">{menu.name}</td>
                              <td className="py-2.5 text-slate-400">{menu.category}</td>
                              <td className="py-2.5 text-right text-slate-300 font-semibold">{menu.quantity.toLocaleString()}개</td>
                              <td className="py-2.5 text-right font-bold text-slate-200">{formatWon(menu.netSales)}</td>
                              <td className="py-2.5 text-right text-slate-400">
                                {menu.sharePercent.toFixed(1)}% <span className="text-[10px] text-slate-600">({menu.cumulativePercent.toFixed(1)}%)</span>
                              </td>
                              <td className="py-2.5 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${menu.badgeStyle}`}>
                                  {menu.badgeLabel}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Right Panel: Matrix or Menu Trend Chart */}
              <div className="glass-card p-6 rounded-2xl flex flex-col justify-between min-h-[480px]">
                <div>
                  {/* Tab headers */}
                  <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
                    <div className="flex items-center bg-[#131722] p-0.5 rounded-lg border border-white/5 text-xs">
                      <button
                        onClick={() => setRightCardMode("matrix")}
                        className={`px-3 py-1.5 rounded font-semibold transition-all ${
                          rightCardMode === "matrix"
                            ? "bg-indigo-600 text-white"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        4분면 포트폴리오
                      </button>
                      <button
                        onClick={() => {
                          if (selectedMenuName) {
                            setRightCardMode("menuTrend");
                          }
                        }}
                        disabled={!selectedMenuName}
                        className={`px-3 py-1.5 rounded font-semibold transition-all flex items-center gap-1.5 ${
                          !selectedMenuName 
                            ? "opacity-40 cursor-not-allowed text-slate-500" 
                            : rightCardMode === "menuTrend"
                            ? "bg-indigo-600 text-white"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                        title={!selectedMenuName ? "메뉴 분석을 보려면 왼쪽 표에서 메뉴명을 클릭하세요" : ""}
                      >
                        메뉴 매출 트렌드
                        {selectedMenuName && (
                          <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-indigo-300 font-bold truncate max-w-[80px]">
                            {selectedMenuName}
                          </span>
                        )}
                      </button>
                    </div>

                    {/* Date period toggler */}
                    {rightCardMode === "menuTrend" && (
                      <div className="flex items-center bg-[#131722] p-0.5 rounded-lg border border-white/5 text-[10px]">
                        <button
                          onClick={() => setMenuChartPeriod("daily")}
                          className={`px-2.5 py-1 rounded font-bold transition-all ${
                            menuChartPeriod === "daily" ? "bg-indigo-600 text-white" : "text-slate-400"
                          }`}
                        >
                          일별
                        </button>
                        <button
                          onClick={() => setMenuChartPeriod("monthly")}
                          className={`px-2.5 py-1 rounded font-bold transition-all ${
                            menuChartPeriod === "monthly" ? "bg-indigo-600 text-white" : "text-slate-400"
                          }`}
                        >
                          월별
                        </button>
                        <button
                          onClick={() => setMenuChartPeriod("yearly")}
                          className={`px-2.5 py-1 rounded font-bold transition-all ${
                            menuChartPeriod === "yearly" ? "bg-indigo-600 text-white" : "text-slate-400"
                          }`}
                        >
                          연간
                        </button>
                      </div>
                    )}
                  </div>

                  {rightCardMode === "matrix" ? (
                    // ----------------------------------------------------
                    // MODE A: PORTFOLIO MATRIX
                    // ----------------------------------------------------
                    <div>
                      <h4 className="text-sm font-bold text-white mb-4">메뉴 포트폴리오 분석 (4분면 매트릭스)</h4>
                      <div className="h-72 relative">
                        {menuMatrixData.points && menuMatrixData.points.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: -20 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                              <XAxis 
                                type="number" 
                                dataKey="x" 
                                name="판매수량" 
                                unit="개" 
                                stroke="#94a3b8" 
                                fontSize={10} 
                              />
                              <YAxis 
                                type="number" 
                                dataKey="y" 
                                name="실매출액" 
                                unit="만원" 
                                stroke="#94a3b8" 
                                fontSize={10} 
                              />
                              <Tooltip 
                                cursor={{ strokeDasharray: "3 3" }} 
                                contentStyle={{ backgroundColor: "#161b26", borderColor: "rgba(255,255,255,0.1)", borderRadius: "8px" }}
                                formatter={(value, name, props) => {
                                  if (name === "판매수량") return [`${value} 개`, name];
                                  if (name === "실매출액") return [`${value} 만원`, name];
                                  return [value, name];
                                }}
                                labelFormatter={(label, items) => {
                                  if (items[0] && items[0].payload) {
                                    return items[0].payload.name;
                                  }
                                  return "";
                                }}
                              />
                              <Scatter name="메뉴" data={menuMatrixData.points} fill="#8884d8">
                                {menuMatrixData.points.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Scatter>
                              <ReferenceLine x={menuMatrixData.avgQty} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1} label={{ value: '평균 수량', fill: '#ef4444', fontSize: 10, position: 'top' }} />
                              <ReferenceLine y={Math.round(menuMatrixData.avgSales / 10000)} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1} label={{ value: '평균 매출', fill: '#ef4444', fontSize: 10, position: 'right' }} />
                            </ScatterChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center text-slate-500 text-xs">데이터 없음</div>
                        )}
                      </div>

                      {/* Matrix Quad explanation */}
                      <div className="mt-4 pt-3 border-t border-white/5 grid grid-cols-4 gap-2 text-[10px]">
                        <div className="bg-[#10b981]/10 p-2 rounded border border-[#10b981]/25 text-[#10b981] font-semibold text-center">
                          <p className="font-bold">스타 메뉴</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">수량↑ 매출↑</p>
                        </div>
                        <div className="bg-[#6366f1]/10 p-2 rounded border border-[#6366f1]/25 text-[#6366f1] font-semibold text-center">
                          <p className="font-bold">고단가 메뉴</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">수량↓ 매출↑</p>
                        </div>
                        <div className="bg-[#f59e0b]/10 p-2 rounded border border-[#f59e0b]/25 text-[#f59e0b] font-semibold text-center">
                          <p className="font-bold">대중 메뉴</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">수량↑ 매출↓</p>
                        </div>
                        <div className="bg-[#ef4444]/10 p-2 rounded border border-[#ef4444]/25 text-[#ef4444] font-semibold text-center">
                          <p className="font-bold">관리 필요</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">수량↓ 매출↓</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // ----------------------------------------------------
                    // MODE B: MENU TREND GRAPH
                    // ----------------------------------------------------
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-indigo-400" />
                            {selectedMenuName} 매출 트렌드
                          </h4>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {menuChartPeriod === "daily" ? "일자별 추이" : menuChartPeriod === "monthly" ? "월별 추이" : "연간 추이"}
                          </p>
                        </div>
                        <span className="text-[10px] text-indigo-400 font-semibold bg-indigo-500/10 px-2.5 py-0.5 rounded">
                          {menuChartPeriod === "daily" ? "실매출 전액" : "만원 단위"}
                        </span>
                      </div>

                      <div className="h-72">
                        {menuTrendChartData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={menuTrendChartData}
                              margin={{ top: 10, right: 15, left: -10, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                              <XAxis 
                                dataKey="name" 
                                stroke="#94a3b8" 
                                fontSize={10} 
                                tickLine={false} 
                              />
                              <YAxis 
                                stroke="#94a3b8" 
                                fontSize={10} 
                                tickLine={false}
                                tickFormatter={(v) => menuChartPeriod === "daily" ? formatWon(v) : `${Math.round(v / 10000).toLocaleString()}만`}
                              />
                              <Tooltip
                                contentStyle={{ backgroundColor: "#161b26", borderColor: "rgba(255,255,255,0.1)", borderRadius: "8px" }}
                                formatter={(value) => [`${formatRawWon(value)}`, "매출액"]}
                                labelStyle={{ color: "#fff", fontWeight: "bold" }}
                              />
                              <Line
                                type="monotone"
                                dataKey="sales"
                                stroke="#6366f1"
                                strokeWidth={3}
                                dot={menuChartPeriod !== "daily"}
                                activeDot={{ r: 6 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                            해당 메뉴의 매출 이력이 없습니다.
                          </div>
                        )}
                      </div>

                      {/* Metrics Indicator below menu trend */}
                      <div className="mt-4 pt-3 border-t border-white/5 grid grid-cols-2 gap-4 text-xs">
                        <div className="bg-white/2 p-2.5 rounded-xl border border-white/5">
                          <span className="text-slate-500 font-medium block">총 누적 매출</span>
                          <span className="text-sm font-bold text-white mt-0.5 block">
                            {formatRawWon(menuTrendChartData.reduce((sum, item) => sum + item.salesRaw, 0))}
                          </span>
                        </div>
                        <div className="bg-white/2 p-2.5 rounded-xl border border-white/5">
                          <span className="text-slate-500 font-medium block">평균 매출액 ({menuChartPeriod === "daily" ? "일" : menuChartPeriod === "monthly" ? "월" : "년"})</span>
                          <span className="text-sm font-bold text-indigo-400 mt-0.5 block">
                            {formatRawWon(Math.round(
                              menuTrendChartData.length > 0 
                                ? menuTrendChartData.reduce((sum, item) => sum + item.salesRaw, 0) / menuTrendChartData.length 
                                : 0
                            ))}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------
            TAB 3: DETAILED PIVOT TABLE
            ---------------------------------------------------- */}
        {globalTab === "pivot" && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card p-6 rounded-2xl">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Table className="w-5 h-5 text-indigo-400" />
                  메뉴별·일자별 상세 피벗 테이블
                </h3>
                <p className="text-xs text-slate-400 mt-1">대분류 및 지점을 지정하여 일별 상세 추이를 확인하세요.</p>
              </div>

              {/* Pivots Controls */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Store Filter */}
                <div className="flex items-center bg-[#131722] rounded-lg px-2 py-1.5 border border-white/5 text-xs">
                  <Store className="w-3.5 h-3.5 text-indigo-400 mr-1.5" />
                  <select
                    value={selectedStoreId}
                    onChange={(e) => setSelectedStoreId(e.target.value)}
                    className="bg-transparent border-none text-slate-300 font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="total" className="bg-[#131722]">전체 매장</option>
                    {stores.map(s => (
                      <option key={s.id} value={s.id} className="bg-[#131722]">{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Period Filter */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center bg-[#131722] rounded-lg px-2 py-1.5 border border-white/5 text-xs">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400 mr-1.5" />
                    <select
                      value={selectedPeriod}
                      onChange={(e) => handlePeriodDropdownChange(e.target.value)}
                      className="bg-transparent border-none text-slate-300 font-semibold focus:outline-none cursor-pointer"
                    >
                      <option value="all" className="bg-[#131722]">전체 기간</option>
                      {availablePeriods.map(p => (
                        <option key={p} value={p} className="bg-[#131722]">
                          {p.replace("-", "년 ")}월
                        </option>
                      ))}
                      <option value="custom" className="bg-[#131722]">직접 지정</option>
                    </select>
                  </div>

                  <div className="flex items-center bg-[#131722] rounded-lg px-2 py-1 border border-white/5 text-xs gap-1">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      className="bg-transparent border-none text-slate-300 font-semibold focus:outline-none cursor-pointer p-0.5"
                      style={{ colorScheme: 'dark' }}
                    />
                    <span className="text-slate-500 font-bold">~</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => handleEndDateChange(e.target.value)}
                      className="bg-transparent border-none text-slate-300 font-semibold focus:outline-none cursor-pointer p-0.5"
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>
                </div>

                {/* Category Filter */}
                <div className="flex items-center bg-[#131722] rounded-lg px-2 py-1.5 border border-white/5 text-xs">
                  <Filter className="w-3.5 h-3.5 text-indigo-400 mr-1.5" />
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="bg-transparent border-none text-slate-300 font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="all" className="bg-[#131722]">전체 대분류</option>
                    <option value="메인메뉴" className="bg-[#131722]">메인메뉴</option>
                    <option value="식사류/정식류" className="bg-[#131722]">식사류 / 정식류</option>
                    <option value="주류/음료" className="bg-[#131722]">주류 / 음료</option>
                    <option value="사이드/기타" className="bg-[#131722]">사이드 / 기타</option>
                  </select>
                </div>

                {/* Metric toggle */}
                <div className="bg-[#131722] p-1 rounded-lg border border-white/5 flex text-xs">
                  <button
                    onClick={() => setPivotMetric("netSales")}
                    className={`px-3 py-1 rounded font-semibold transition-all ${
                      pivotMetric === "netSales"
                        ? "bg-indigo-600 text-white"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    매출액 (원)
                  </button>
                  <button
                    onClick={() => setPivotMetric("quantity")}
                    className={`px-3 py-1 rounded font-semibold transition-all ${
                      pivotMetric === "quantity"
                        ? "bg-indigo-600 text-white"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    수량 (개)
                  </button>
                </div>
              </div>
            </div>

            {/* Pivot table block */}
            <div className="glass-card rounded-2xl overflow-hidden flex flex-col">
              {/* Toolbar */}
              <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="메뉴명 검색..."
                    value={pivotSearch}
                    onChange={(e) => setPivotSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-[#131722] border border-white/5 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExportPivot("csv")}
                    className="flex items-center gap-1 px-3 py-2 bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 rounded-xl text-xs font-bold hover:bg-indigo-600/20 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV 다운로드
                  </button>
                  <button
                    onClick={() => handleExportPivot("xlsx")}
                    className="flex items-center gap-1 px-3 py-2 bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold hover:bg-emerald-600/20 transition-all"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Excel 다운로드
                  </button>
                </div>
              </div>

              {/* Table wrapper */}
              <div className="overflow-x-auto max-w-full">
                <table className="w-full border-collapse text-xs text-left min-w-[1200px]">
                  <thead>
                    <tr className="bg-[#101420] text-slate-400 border-b border-white/5">
                      <th className="py-3 px-4 font-bold sticky left-0 bg-[#101420] border-r border-white/5 w-48 shadow-[2px_0_5px_rgba(0,0,0,0.3)] z-10">메뉴명</th>
                      <th className="py-3 px-3 font-semibold border-r border-white/5">대분류</th>
                      {pivotTableData.dayCols.map(d => (
                        <th key={d} className="py-3 px-1 text-center font-medium border-r border-white/5 w-10">
                          {d}일
                        </th>
                      ))}
                      <th className="py-3 px-4 text-right font-bold bg-[#101420]/80">합계</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pivotTableData.rows.length > 0 ? (
                      pivotTableData.rows.map((row, index) => {
                        const rowSum = pivotMetric === "netSales" ? row.totalSales : row.totalQty;
                        return (
                          <tr key={index} className="border-b border-white/5 hover:bg-white/2 transition-all">
                            <td className="py-2.5 px-4 font-bold text-white sticky left-0 bg-[#141a29] border-r border-white/5 shadow-[2px_0_5px_rgba(0,0,0,0.3)] z-10 truncate">
                              {row.name}
                            </td>
                            <td className="py-2.5 px-3 text-slate-400 border-r border-white/5">{row.category}</td>
                            {pivotTableData.dayCols.map(day => {
                              const val = row.dailyValues[day];
                              return (
                                <td key={day} className="py-2.5 px-1 text-center text-slate-300 border-r border-white/5">
                                  {val !== undefined 
                                    ? (pivotMetric === "netSales" ? (val / 10000).toFixed(0) : val)
                                    : "-"
                                  }
                                </td>
                              );
                            })}
                            <td className="py-2.5 px-4 text-right font-bold text-indigo-300">
                              {pivotMetric === "netSales" ? formatWon(rowSum) : `${rowSum.toLocaleString()}개`}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={35} className="py-8 text-center text-slate-500 font-medium">
                          조건에 부합하는 매출 내역이 없습니다.
                        </td>
                      </tr>
                    )}
                    {/* Bottom Totals Row */}
                    {pivotTableData.rows.length > 0 && (
                      <tr className="bg-[#101420]/50 border-t-2 border-white/10 font-bold">
                        <td className="py-3 px-4 text-indigo-400 sticky left-0 bg-[#111624] border-r border-white/5 shadow-[2px_0_5px_rgba(0,0,0,0.3)] z-10">총합계</td>
                        <td className="py-3 px-3 text-slate-500 border-r border-white/5">-</td>
                        {pivotTableData.dayCols.map(day => {
                          const val = pivotTableData.colTotals[day];
                          return (
                            <td key={day} className="py-3 px-1 text-center text-indigo-300 border-r border-white/5">
                              {val > 0 
                                ? (pivotMetric === "netSales" ? (val / 10000).toFixed(0) : val)
                                : "-"
                              }
                            </td>
                          );
                        })}
                        <td className="py-3 px-4 text-right text-emerald-400 bg-[#111624]/80">
                          {pivotMetric === "netSales" ? formatWon(pivotTableData.grandTotal) : `${pivotTableData.grandTotal.toLocaleString()}개`}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {pivotMetric === "netSales" && pivotTableData.rows.length > 0 && (
                <div className="p-3 bg-[#111624]/30 border-t border-white/5 text-[10px] text-slate-500 text-right font-medium">
                  ※ 일자별 데이터의 수치는 1만 원 단위로 절사하여 표기되었으며, 최종 합계 컬럼은 정확한 실매출 전액을 표기합니다.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ----------------------------------------------------
            TAB 4: DATA UPLOAD HUB
            ---------------------------------------------------- */}
        {globalTab === "upload" && (
          <div className="space-y-6">
            <div className="glass-card p-6 rounded-2xl">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-indigo-400" />
                데이터 업로드 & 관리 허브
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                OKPOS 일자별(상품별) 매출 파일(.xls, .xlsx)을 매장별로 지정하여 개별 업로드하거나, 여러 파일을 모아 통합 드래그 앤 드롭으로 일괄 적재할 수 있습니다.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Bulk upload zone */}
              <div className="lg:col-span-2 space-y-6">
                <div 
                  onDragEnter={handleDrag} 
                  onDragOver={handleDrag} 
                  onDragLeave={handleDrag} 
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all min-h-[300px] ${
                    dragActive 
                      ? "border-indigo-500 bg-indigo-500/5 shadow-[0_0_20px_rgba(99,102,241,0.25)]" 
                      : "border-white/10 bg-[#121622]/40 hover:border-white/20 hover:bg-[#121622]/60"
                  }`}
                >
                  <div className="bg-indigo-600/10 p-4 rounded-full text-indigo-400 mb-4 shadow-[0_0_15px_rgba(99,102,241,0.15)]">
                    <Upload className="w-10 h-10" />
                  </div>
                  <h4 className="text-sm font-bold text-white">통합 일괄 파일 드래그 앤 드롭</h4>
                  <p className="text-xs text-slate-400 max-w-md mt-2">
                    여러 매장/여러 달의 OKPOS 매출 엑셀 파일들을 이 영역에 한 번에 드래그하여 드롭하세요. 파일명(예: <span className="text-indigo-300">"금막창 종로점 26년 7월 일자별 매출.xlsx"</span>)을 자동 판독하여 알맞게 자동 적재합니다.
                  </p>
                  <p className="text-[10px] text-amber-500 font-semibold mt-1">
                    ※ 미등록 신규 매장 파일 인입 시, 매장이 자동으로 생성됩니다.
                  </p>

                  <div className="mt-6 flex items-center gap-3">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-500 transition-all shadow-md shadow-indigo-600/20"
                    >
                      컴퓨터에서 파일 선택
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      multiple 
                      accept=".xls,.xlsx" 
                      className="hidden" 
                      onChange={handleFileSelect}
                    />
                  </div>
                </div>

                {/* Upload history logs */}
                <div className="glass-card p-6 rounded-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-white">매출 데이터 업로드 히스토리 (롤백 가능)</h4>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleExportDataToFile}
                        className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition-all"
                      >
                        현재 데이터 내보내기 (mockData.js)
                      </button>
                      <button
                        onClick={handleRestoreDemoData}
                        className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 px-2.5 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg transition-all"
                      >
                        데모 데이터 복구
                      </button>
                      {uploadLogs.length > 0 && (
                        <button
                          onClick={handleResetAllData}
                          className="text-[10px] font-bold text-rose-400 hover:text-rose-300 px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-all"
                        >
                          데이터 전체 초기화
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 text-slate-500 font-semibold">
                          <th className="py-2.5">업로드 일시</th>
                          <th className="py-2.5">대상 매장</th>
                          <th className="py-2.5">데이터 월</th>
                          <th className="py-2.5">업로드 파일명</th>
                          <th className="py-2.5 text-right">행 수</th>
                          <th className="py-2.5 text-center">상태</th>
                          <th className="py-2.5 text-center">관리</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uploadLogs.length > 0 ? (
                          uploadLogs.map((log) => (
                            <tr key={log.id} className="border-b border-white/5 hover:bg-white/2 transition-all">
                              <td className="py-2.5 text-slate-400">
                                {new Date(log.uploadTime).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </td>
                              <td className="py-2.5 font-bold text-white">{log.storeName}</td>
                              <td className="py-2.5 font-semibold text-slate-300">{log.period}</td>
                              <td className="py-2.5 text-slate-400 max-w-xs truncate" title={log.fileName}>{log.fileName}</td>
                              <td className="py-2.5 text-right font-bold text-slate-300">{log.rowCount.toLocaleString()}행</td>
                              <td className="py-2.5 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  log.status.includes("오류") 
                                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                }`}>
                                  {log.status}
                                </span>
                              </td>
                              <td className="py-2.5 text-center">
                                {log.rowCount > 0 && (
                                  <button
                                    onClick={() => handleRollbackUpload(log)}
                                    className="p-1 hover:bg-rose-500/10 rounded text-slate-500 hover:text-rose-400 transition-all"
                                    title="이 업로드 데이터 삭제 (롤백)"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7} className="py-6 text-center text-slate-500 font-medium">
                              업로드 이력이 비어 있습니다.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Individual Store dropzones */}
              <div className="space-y-6">
                <div className="glass-card p-6 rounded-2xl">
                  <h4 className="text-sm font-bold text-white mb-2">매장별 개별 전용 드롭존</h4>
                  <p className="text-[11px] text-slate-400">특정 매장을 명확히 지정하여 해당 매장의 데이터로 즉시 등록합니다.</p>
                </div>

                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                  {stores.map((store) => {
                    const storeUploads = uploadLogs.filter(l => l.storeId === store.id && l.status === "정상 완료");
                    const latest = storeUploads.length > 0 ? storeUploads[0] : null;

                    return (
                      <div 
                        key={store.id} 
                        className="bg-[#121622] border border-white/5 hover:border-indigo-500/20 p-4 rounded-xl flex items-center justify-between gap-4 transition-all"
                      >
                        <div className="min-w-0">
                          <h5 className="text-xs font-bold text-white truncate">{store.name}</h5>
                          <p className="text-[10px] text-slate-500 mt-1">
                            {latest 
                              ? `최근: ${latest.period} (${latest.rowCount}행)` 
                              : "업로드 데이터 없음"}
                          </p>
                        </div>

                        <div>
                          <label className="flex items-center gap-1 px-2.5 py-1.5 bg-[#1f2638] text-indigo-400 border border-indigo-500/20 rounded-lg text-[10px] font-bold cursor-pointer hover:bg-indigo-500/10 transition-all">
                            <Upload className="w-3 h-3" />
                            올리기
                            <input 
                              type="file" 
                              accept=".xls,.xlsx" 
                              className="hidden" 
                              onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                  handleIndividualUpload(store, e.target.files[0]);
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {globalTab === "cost" && (
          <div className="space-y-6">
            {/* Page Header */}
            <div className="glass-card p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-indigo-400" />
                  원가 / 손익 분석 대시보드
                </h3>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs font-bold text-slate-400">분석 매장:</span>
                  <select
                    value={selectedStoreId}
                    onChange={(e) => {
                      setSelectedStoreId(e.target.value);
                      setCostSelectedPeriod("");
                    }}
                    className="bg-[#121622] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                  >
                    <option value="total">전체 매장 (선택 필요)</option>
                    {stores.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedStoreId !== "total" && (
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => costFileInputRef.current?.click()}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    손익계산서 엑셀 업로드
                  </button>
                  <input 
                    type="file" 
                    ref={costFileInputRef} 
                    accept=".xls,.xlsx" 
                    className="hidden" 
                    onChange={handleCostFileSelect}
                  />
                </div>
              )}
            </div>

            {selectedStoreId === "total" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="md:col-span-2 lg:col-span-3 glass-card p-8 rounded-2xl text-center space-y-4">
                  <div className="bg-indigo-600/10 p-4 rounded-full text-indigo-400 w-16 h-16 flex items-center justify-center mx-auto shadow-[0_0_15px_rgba(99,102,241,0.15)]">
                    <DollarSign className="w-8 h-8" />
                  </div>
                  <h4 className="text-base font-bold text-white">개별 매장을 선택해 주세요</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    원가 및 월별 손익 분석은 지점별 상세 엑셀 명세 데이터를 기반으로 제공되므로, 왼쪽의 매장 선택 영역에서 개별 지점을 선택하셔야 상세 분석이 표출됩니다.
                  </p>
                  
                  <div className="pt-4 flex flex-wrap justify-center gap-3">
                    {stores.map(store => {
                      const hasCost = !!costData[store.id];
                      return (
                        <button
                          key={store.id}
                          onClick={() => setSelectedStoreId(store.id)}
                          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                            hasCost
                              ? "bg-indigo-600/10 text-indigo-300 border-indigo-500/25 hover:bg-indigo-600/20"
                              : "bg-white/2 text-slate-400 border-white/5 hover:bg-white/5"
                          }`}
                        >
                          <span>{store.name}</span>
                          {hasCost ? (
                            <span className="text-[9px] bg-indigo-500 text-white px-1.5 py-0.5 rounded font-black">분석 가능</span>
                          ) : (
                            <span className="text-[9px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">데이터 없음</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : !costData[selectedStoreId] ? (
              <div className="grid grid-cols-1 gap-6">
                <div 
                  onDragEnter={handleCostDrag}
                  onDragOver={handleCostDrag}
                  onDragLeave={handleCostDrag}
                  onDrop={handleCostDrop}
                  className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center text-center transition-all min-h-[350px] ${
                    costDragActive 
                      ? "border-indigo-500 bg-indigo-500/5 shadow-[0_0_20px_rgba(99,102,241,0.25)]" 
                      : "border-white/10 bg-[#121622]/40 hover:border-white/20"
                  }`}
                >
                  <div className="bg-indigo-600/10 p-4 rounded-full text-indigo-400 mb-4 shadow-[0_0_15px_rgba(99,102,241,0.15)]">
                    <Upload className="w-10 h-10" />
                  </div>
                  <h4 className="text-sm font-bold text-white">[{currentStore?.name}] 매장의 원가/손익계산서 엑셀 업로드</h4>
                  <p className="text-xs text-slate-400 max-w-md mt-2">
                    지점의 월별 상세 지출 항목과 매출 분석표가 담긴 엑셀 통합 파일(`.xlsx`)을 드래그하여 놓거나 컴퓨터에서 선택하세요.
                  </p>
                  <p className="text-[10px] text-amber-500 font-semibold mt-2">
                    ※ 시트 구성: 월별 세부 지출 항목(YYMM 형식의 여러 시트) 및 간편손익분석표 시트 포함 필수
                  </p>

                  <div className="mt-6 flex items-center gap-3">
                    <button 
                      onClick={() => costFileInputRef.current?.click()}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-500 transition-all shadow-md shadow-indigo-600/20"
                    >
                      컴퓨터에서 파일 선택
                    </button>
                    {selectedStoreId === "store-4" && (
                      <button
                        onClick={() => {
                          const updated = { ...costData, "store-4": DEFAULT_COST_DATA["store-4"] };
                          saveCostDataToLocal(updated);
                          setUploadStatusMsg({ type: "success", text: "신영웅청국장 데모 원가 데이터를 로드했습니다." });
                          setTimeout(() => setUploadStatusMsg({ type: "", text: "" }), 5000);
                        }}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-500 transition-all shadow-md shadow-emerald-600/20"
                      >
                        신영웅 데모 데이터 복구
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex border-b border-white/5 gap-6">
                  {[
                    { id: "trend", label: "월별 손익 추이" },
                    { id: "breakdown", label: "상세 지출 분석" },
                    { id: "setup", label: "초기 창업 비용" }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setCostTab(tab.id)}
                      className={`pb-3 text-xs md:text-sm font-bold relative transition-all ${
                        costTab === tab.id ? "text-white" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {tab.label}
                      {costTab === tab.id && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
                      )}
                    </button>
                  ))}
                </div>

                {costTab === "trend" && (() => {
                  const currentCost = costData[selectedStoreId];
                  const periods = Object.keys(currentCost.months || {}).sort();
                  
                  if (periods.length === 0) {
                    return (
                      <div className="glass-card p-8 text-center text-slate-500 text-xs rounded-2xl">
                        분석할 수 있는 월별 손익 시트 데이터가 없습니다.
                      </div>
                    );
                  }

                  const chartData = periods.map(period => {
                    const mData = currentCost.months[period];
                    const expenses = mData.sales - mData.netProfit;
                    return {
                      period: period.substring(2),
                      sales: mData.sales / 10000,
                      expenses: expenses / 10000,
                      profit: mData.netProfit / 10000,
                      foodRatio: Math.round((mData.categories["식재료"]?.ratio || 0) * 1000) / 10,
                      laborRatio: Math.round((mData.categories["인건비"]?.ratio || 0) * 1000) / 10,
                      rentRatio: Math.round((mData.categories["임차료/판매관리"]?.ratio || 0) * 1000) / 10,
                      taxRatio: Math.round((mData.categories["세금.보험.수수료"]?.ratio || 0) * 1000) / 10,
                      marketingRatio: Math.round((mData.categories["홍보/광고/선전비"]?.ratio || 0) * 1000) / 10
                    };
                  });

                  const totalSales = periods.reduce((sum, p) => sum + currentCost.months[p].sales, 0);
                  const totalProfit = periods.reduce((sum, p) => sum + currentCost.months[p].netProfit, 0);
                  const avgSales = totalSales / periods.length;
                  const avgProfit = totalProfit / periods.length;
                  
                  return (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="glass-card p-5 rounded-2xl">
                          <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">누적 총 매출액</span>
                          <span className="text-xl font-extrabold text-white mt-1 block">{formatRawWon(totalSales)}</span>
                          <span className="text-[10px] text-indigo-400 font-medium block mt-1.5">월평균 {formatRawWon(Math.round(avgSales))}</span>
                        </div>
                        <div className="glass-card p-5 rounded-2xl">
                          <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">누적 총 순이익</span>
                          <span className={`text-xl font-extrabold mt-1 block ${totalProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {formatRawWon(totalProfit)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium block mt-1.5">월평균 {formatRawWon(Math.round(avgProfit))}</span>
                        </div>
                        <div className="glass-card p-5 rounded-2xl">
                          <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">평균 영업이익률</span>
                          <span className="text-xl font-extrabold text-white mt-1 block">{(totalProfit / totalSales * 100).toFixed(2)}%</span>
                          <span className="text-[10px] text-slate-400 font-medium block mt-1.5">총 {periods.length}개월 분석 기준</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="glass-card p-6 rounded-2xl">
                          <h4 className="text-xs font-bold text-white mb-4">월별 매출 / 지출 / 순손익 추이 <span className="text-[9px] text-slate-500">(단위: 만원)</span></h4>
                          <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                <XAxis dataKey="period" stroke="#94a3b8" fontSize={10} tickLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                                <Tooltip 
                                  contentStyle={{ backgroundColor: "#161b26", borderColor: "rgba(255,255,255,0.1)", borderRadius: "8px" }}
                                  labelStyle={{ color: "#fff", fontWeight: "bold" }}
                                  formatter={(value, name) => {
                                    const label = name === "sales" ? "매출" : name === "expenses" ? "총지출" : "순손익";
                                    return [`${Math.round(value).toLocaleString()} 만원`, label];
                                  }}
                                />
                                <Legend verticalAlign="top" height={36} iconSize={10} wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                                <Bar dataKey="sales" fill="#6366f1" name="sales" radius={[3, 3, 0, 0]} />
                                <Bar dataKey="expenses" fill="#f59e0b" name="expenses" radius={[3, 3, 0, 0]} />
                                <Bar dataKey="profit" fill="#10b981" name="profit" radius={[3, 3, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        <div className="glass-card p-6 rounded-2xl">
                          <h4 className="text-xs font-bold text-white mb-4">주요 원가 항목 매출 대비 비율 추이 <span className="text-[9px] text-slate-500">(단위: %)</span></h4>
                          <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                <XAxis dataKey="period" stroke="#94a3b8" fontSize={10} tickLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} domain={[0, 'auto']} />
                                <Tooltip 
                                  contentStyle={{ backgroundColor: "#161b26", borderColor: "rgba(255,255,255,0.1)", borderRadius: "8px" }}
                                  labelStyle={{ color: "#fff", fontWeight: "bold" }}
                                  formatter={(value, name) => {
                                    const label = name === "foodRatio" ? "식재료비" : name === "laborRatio" ? "인건비" : name === "rentRatio" ? "임대/판관비" : name === "taxRatio" ? "세무/수수료" : "홍보비";
                                    return [`${value}%`, label];
                                  }}
                                />
                                <Legend verticalAlign="top" height={36} iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
                                <Line type="monotone" dataKey="foodRatio" stroke="#6366f1" name="foodRatio" strokeWidth={2} dot={{ r: 3 }} />
                                <Line type="monotone" dataKey="laborRatio" stroke="#ec4899" name="laborRatio" strokeWidth={2} dot={{ r: 3 }} />
                                <Line type="monotone" dataKey="rentRatio" stroke="#f59e0b" name="rentRatio" strokeWidth={2} dot={{ r: 3 }} />
                                <Line type="monotone" dataKey="taxRatio" stroke="#10b981" name="taxRatio" strokeWidth={2} dot={{ r: 3 }} />
                                <Line type="monotone" dataKey="marketingRatio" stroke="#06b6d4" name="marketingRatio" strokeWidth={2} dot={{ r: 3 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>

                      <div className="glass-card p-6 rounded-2xl">
                        <h4 className="text-xs font-bold text-white mb-4">월별 간편 손익분석 명세표</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs text-slate-400">
                            <thead className="bg-white/2 border-b border-white/5 font-bold text-slate-300">
                              <tr>
                                <th className="py-3 px-4">영업월별</th>
                                <th className="py-3 px-4 text-right">매출액</th>
                                <th className="py-3 px-4 text-right">식재료 (비율)</th>
                                <th className="py-3 px-4 text-right">인건비 (비율)</th>
                                <th className="py-3 px-4 text-right">임차/판관비 (비율)</th>
                                <th className="py-3 px-4 text-right">세금/수수료 (비율)</th>
                                <th className="py-3 px-4 text-right">홍보/광고 (비율)</th>
                                <th className="py-3 px-4 text-right">최종손익</th>
                                <th className="py-3 px-4 text-right">이익률</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[...periods].reverse().map(period => {
                                const mData = currentCost.months[period];
                                const food = mData.categories["식재료"] || { sum: 0, ratio: 0 };
                                const labor = mData.categories["인건비"] || { sum: 0, ratio: 0 };
                                const rent = mData.categories["임차료/판매관리"] || { sum: 0, ratio: 0 };
                                const tax = mData.categories["세금.보험.수수료"] || { sum: 0, ratio: 0 };
                                const mkt = mData.categories["홍보/광고/선전비"] || { sum: 0, ratio: 0 };
                                const profit = mData.netProfit;
                                const profitRatio = (profit / mData.sales) * 100;
                                
                                return (
                                  <tr key={period} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                                    <td className="py-2.5 px-4 font-bold text-white">{period}</td>
                                    <td className="py-2.5 px-4 text-right font-semibold text-slate-200">{formatRawWon(mData.sales)}</td>
                                    <td className="py-2.5 px-4 text-right">
                                      <span className="text-slate-300">{formatRawWon(food.sum)}</span>
                                      <span className="text-[10px] text-slate-500 block">({(food.ratio * 100).toFixed(1)}%)</span>
                                    </td>
                                    <td className="py-2.5 px-4 text-right">
                                      <span className="text-slate-300">{formatRawWon(labor.sum)}</span>
                                      <span className="text-[10px] text-slate-500 block">({(labor.ratio * 100).toFixed(1)}%)</span>
                                    </td>
                                    <td className="py-2.5 px-4 text-right">
                                      <span className="text-slate-300">{formatRawWon(rent.sum)}</span>
                                      <span className="text-[10px] text-slate-500 block">({(rent.ratio * 100).toFixed(1)}%)</span>
                                    </td>
                                    <td className="py-2.5 px-4 text-right">
                                      <span className="text-slate-300">{formatRawWon(tax.sum)}</span>
                                      <span className="text-[10px] text-slate-500 block">({(tax.ratio * 100).toFixed(1)}%)</span>
                                    </td>
                                    <td className="py-2.5 px-4 text-right">
                                      <span className="text-slate-300">{formatRawWon(mkt.sum)}</span>
                                      <span className="text-[10px] text-slate-500 block">({(mkt.ratio * 100).toFixed(1)}%)</span>
                                    </td>
                                    <td className={`py-2.5 px-4 text-right font-bold ${profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                      {formatRawWon(profit)}
                                    </td>
                                    <td className={`py-2.5 px-4 text-right font-bold ${profitRatio >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                      {profitRatio.toFixed(1)}%
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Food Ingredients Vendor Trend Table */}
                      <div className="glass-card p-6 rounded-2xl">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                          <div>
                            <h4 className="text-xs font-bold text-white">식재료 업체별 월별 지출 명세</h4>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              각 식재료 공급업체별 월간 거래 금액 추이와 누적 총액 (지출액 기준 내림차순 정렬)
                            </p>
                          </div>
                        </div>

                        {(() => {
                          const currentCost = costData[selectedStoreId];
                          const periods = Object.keys(currentCost.months || {}).sort();
                          
                          // Extract unique vendors for the category "식재료"
                          const vendorTotals = {};
                          const vendorMonthly = {};
                          
                          periods.forEach(p => {
                            const cat = currentCost.months[p].categories["식재료"];
                            if (cat && cat.items) {
                              cat.items.forEach(item => {
                                const name = item.name;
                                const val = item.value || 0;
                                if (name) {
                                  vendorTotals[name] = (vendorTotals[name] || 0) + val;
                                  if (!vendorMonthly[name]) {
                                    vendorMonthly[name] = {};
                                  }
                                  vendorMonthly[name][p] = val;
                                }
                              });
                            }
                          });
                          
                          // Sort vendors by total spending descending
                          const sortedVendors = Object.keys(vendorTotals).sort((a, b) => vendorTotals[b] - vendorTotals[a]);
                          
                          if (sortedVendors.length === 0) {
                            return (
                              <div className="text-center text-xs text-slate-500 py-4">
                                식재료 업체 데이터가 없습니다.
                              </div>
                            );
                          }
                          
                          return (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs text-slate-400">
                                <thead className="bg-white/2 border-b border-white/5 font-bold text-slate-300">
                                  <tr>
                                    <th className="py-3 px-4">식재료 업체명</th>
                                    <th className="py-3 px-4 text-right">누적 총 합계</th>
                                    {[...periods].reverse().map(p => (
                                      <th key={p} className="py-3 px-4 text-right whitespace-nowrap">{p}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {sortedVendors.map(vendor => (
                                    <tr key={vendor} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                                      <td className="py-2.5 px-4 font-bold text-white">{vendor}</td>
                                      <td className="py-2.5 px-4 text-right font-semibold text-indigo-300">
                                        {formatRawWon(vendorTotals[vendor])}
                                      </td>
                                      {[...periods].reverse().map(p => {
                                        const val = vendorMonthly[vendor][p];
                                        return (
                                          <td key={p} className="py-2.5 px-4 text-right font-medium">
                                            {val !== undefined ? (
                                              <span className="text-slate-200">{formatRawWon(val)}</span>
                                            ) : (
                                              <span className="text-slate-600">-</span>
                                            )}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })()}

                {costTab === "breakdown" && (() => {
                  const currentCost = costData[selectedStoreId];
                  const periods = Object.keys(currentCost.months || {}).sort();
                  
                  if (periods.length === 0) {
                    return (
                      <div className="glass-card p-8 text-center text-slate-500 text-xs rounded-2xl">
                        분석할 수 있는 월별 지출 데이터가 없습니다.
                      </div>
                    );
                  }

                  const activeMonthPeriod = costSelectedPeriod && currentCost.months[costSelectedPeriod] 
                    ? costSelectedPeriod 
                    : (periods[periods.length - 1] || "");
                    
                  const activeMonth = currentCost.months[activeMonthPeriod];
                  if (!activeMonth) return null;

                  const expenses = activeMonth.sales - activeMonth.netProfit;
                  const profitRatio = (activeMonth.netProfit / activeMonth.sales) * 100;
                  
                  const pieData = Object.keys(activeMonth.categories)
                    .filter(c => c !== "손익" && activeMonth.categories[c].sum > 0)
                    .map(c => ({
                      name: c,
                      value: activeMonth.categories[c].sum
                    }));
                    
                  const PIE_COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#8b5cf6"];

                  return (
                    <div className="space-y-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-400">조회 월 선택:</span>
                          <select
                            value={activeMonthPeriod}
                            onChange={(e) => setCostSelectedPeriod(e.target.value)}
                            className="bg-[#121622] border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                          >
                            {[...periods].reverse().map(p => (
                              <option key={p} value={p}>{p.substring(0,4)}년 {p.substring(5,7)}월</option>
                            ))}
                          </select>
                        </div>
                        {activeMonth.memo && (
                          <div className="text-[11px] text-amber-500 bg-amber-500/5 border border-amber-500/10 px-3 py-2 rounded-xl max-w-xl font-medium">
                            📌 **특이사항 메모**: {activeMonth.memo}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="glass-card p-4.5 rounded-2xl">
                          <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">당월 매출 총합</span>
                          <span className="text-lg font-extrabold text-white mt-1 block">{formatRawWon(activeMonth.sales)}</span>
                          <span className="text-[10px] text-indigo-400 font-medium block mt-1">지출 비율 {((expenses/activeMonth.sales)*100).toFixed(1)}%</span>
                        </div>
                        <div className="glass-card p-4.5 rounded-2xl">
                          <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">당월 총 비용 지출</span>
                          <span className="text-lg font-extrabold text-amber-400 mt-1 block">{formatRawWon(expenses)}</span>
                          <span className="text-[10px] text-slate-400 font-medium block mt-1">순수 경비 합계</span>
                        </div>
                        <div className="glass-card p-4.5 rounded-2xl">
                          <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">당월 영업 순손익</span>
                          <span className={`text-lg font-extrabold mt-1 block ${activeMonth.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {formatRawWon(activeMonth.netProfit)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium block mt-1">매출 대비 순이익률</span>
                        </div>
                        <div className="glass-card p-4.5 rounded-2xl">
                          <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">최종 마진율</span>
                          <span className={`text-lg font-extrabold mt-1 block ${profitRatio >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {profitRatio.toFixed(2)}%
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium block mt-1">투자금 회수 공헌율</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="glass-card p-6 rounded-2xl lg:col-span-1 flex flex-col justify-between">
                          <div>
                            <h4 className="text-xs font-bold text-white mb-2">지출 유형별 점유 비율</h4>
                            <span className="text-[10px] text-slate-500">당월 총 비용 ({formatRawWon(expenses)}) 대비 비율</span>
                          </div>
                          <div className="h-56 flex items-center justify-center relative">
                            {pieData.length > 0 ? (
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={55}
                                    outerRadius={80}
                                    paddingAngle={3}
                                    dataKey="value"
                                  >
                                    {pieData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                    ))}
                                  </Pie>
                                  <Tooltip 
                                    contentStyle={{ backgroundColor: "#161b26", borderColor: "rgba(255,255,255,0.1)", borderRadius: "8px" }}
                                    formatter={(value) => [`${formatRawWon(value)} (${(value/expenses*100).toFixed(1)}%)`, "금액"]}
                                  />
                                </PieChart>
                              </ResponsiveContainer>
                            ) : (
                              <div className="text-xs text-slate-600">데이터 없음</div>
                            )}
                            <div className="absolute flex flex-col items-center justify-center">
                              <span className="text-[10px] text-slate-500 font-bold">총비용</span>
                              <span className="text-sm font-black text-white mt-0.5">{Math.round(expenses/10000).toLocaleString()}만원</span>
                            </div>
                          </div>
                        </div>

                        <div className="glass-card p-6 rounded-2xl lg:col-span-2">
                          <h4 className="text-xs font-bold text-white mb-4">비용 항목별 집계 리스트</h4>
                          <div className="space-y-4">
                            {Object.keys(activeMonth.categories).filter(c => c !== "손익").map((catName, idx) => {
                              const catVal = activeMonth.categories[catName];
                              const pctOfSales = catVal.ratio * 100;
                              const pctOfExpenses = expenses > 0 ? (catVal.sum / expenses) * 100 : 0;
                              
                              return (
                                <div key={catName} className="space-y-1.5">
                                  <div className="flex items-center justify-between text-xs font-semibold">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                                      <span className="text-slate-300 font-bold">{catName}</span>
                                    </div>
                                    <div className="text-slate-400">
                                      <span className="font-bold text-white">{formatRawWon(catVal.sum)}</span> 
                                      <span className="text-[10px] text-slate-500 ml-2">매출대비: {pctOfSales.toFixed(1)}% | 비용대비: {pctOfExpenses.toFixed(1)}%</span>
                                    </div>
                                  </div>
                                  <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full rounded-full transition-all duration-500" 
                                      style={{ 
                                        width: `${pctOfExpenses}%`,
                                        backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] 
                                      }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-white">비용 카테고리별 세부 거래 내역 명세</h4>
                          <span className="text-[10px] text-slate-500">* 각 지출 내역은 엑셀 파일 내 side-by-side 리스트에서 추출되었습니다.</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {Object.keys(activeMonth.categories).map((catName, idx) => {
                            const catObj = activeMonth.categories[catName];
                            const sortedItems = [...(catObj.items || [])].sort((a,b) => b.value - a.value);
                            
                            return (
                              <div key={catName} className="glass-card rounded-2xl overflow-hidden flex flex-col h-[280px]">
                                <div className="px-4.5 py-3.5 bg-white/2 border-b border-white/5 flex items-center justify-between">
                                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                                    {catName}
                                  </span>
                                  <span className="text-[11px] font-black text-indigo-400">{formatRawWon(catObj.sum)}</span>
                                </div>
                                <div className="p-3 overflow-y-auto flex-1 custom-scrollbar">
                                  {sortedItems.length > 0 ? (
                                    <table className="w-full text-[11px] text-slate-400">
                                      <tbody>
                                        {sortedItems.map((item, itemIdx) => (
                                          <tr key={itemIdx} className="border-b border-white/2 hover:bg-white/2">
                                            <td className="py-2 text-slate-300 font-medium truncate max-w-[120px]" title={item.name}>{item.name}</td>
                                            <td className="py-2 text-right text-white font-bold">{formatRawWon(item.value)}</td>
                                            <td className="py-2 text-right text-slate-500 text-[10px]">({(item.value / activeMonth.sales * 100).toFixed(2)}%)</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  ) : (
                                    <div className="h-full flex items-center justify-center text-[10px] text-slate-600 font-medium">
                                      세부 거래 내역이 없습니다.
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {costTab === "setup" && (() => {
                  const currentCost = costData[selectedStoreId];
                  const initCost = currentCost.initialCost;

                  if (!initCost) {
                    return (
                      <div className="glass-card p-12 text-center text-slate-500 text-xs rounded-2xl space-y-2">
                        <AlertCircle className="w-8 h-8 text-slate-600 mx-auto" />
                        <h4 className="text-sm font-bold text-white">초기 개설 비용 데이터가 존재하지 않습니다</h4>
                        <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                          초기 창업 비용은 시트 이름이 `2510` 이거나 제목에 `초기비용`이 들어 있는 시트를 파싱해 제공됩니다.
                        </p>
                      </div>
                    );
                  }

                  const total = initCost.totalSum;
                  const categoriesList = Object.keys(initCost.categories);
                  
                  const pieData = categoriesList.map(c => ({
                    name: c,
                    value: initCost.categories[c].sum
                  }));
                  
                  const COLORS_SETUP = ["#6366f1", "#06b6d4", "#f59e0b", "#ec4899", "#8b5cf6"];

                  return (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="glass-card p-5 rounded-2xl border border-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.05)]">
                          <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">총 창업 비용 합계</span>
                          <span className="text-2xl font-black text-white mt-1 block">{formatRawWon(total)}</span>
                          <span className="text-[10px] text-indigo-400 font-medium block mt-1.5">점포 개설 실투자금 총합</span>
                        </div>
                        {categoriesList.slice(0, 2).map((c, i) => {
                          const val = initCost.categories[c];
                          return (
                            <div key={c} className="glass-card p-5 rounded-2xl">
                              <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">{c} 비용 합계</span>
                              <span className="text-xl font-extrabold text-white mt-1 block">{formatRawWon(val.sum)}</span>
                              <span className="text-[10px] text-slate-400 font-medium block mt-1.5">비중 {((val.sum/total)*100).toFixed(1)}%</span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between">
                          <div>
                            <h4 className="text-xs font-bold text-white mb-2">창업 투자 항목별 비중</h4>
                            <span className="text-[10px] text-slate-500">총 투자액 {formatRawWon(total)} 대비 비율</span>
                          </div>
                          <div className="h-56 flex items-center justify-center relative">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={pieData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={55}
                                  outerRadius={80}
                                  paddingAngle={3}
                                  dataKey="value"
                                >
                                  {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS_SETUP[index % COLORS_SETUP.length]} />
                                  ))}
                                </Pie>
                                <Tooltip 
                                  contentStyle={{ backgroundColor: "#161b26", borderColor: "rgba(255,255,255,0.1)", borderRadius: "8px" }}
                                  formatter={(value) => [`${formatRawWon(value)} (${(value/total*100).toFixed(1)}%)`, "투자금"]}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute flex flex-col items-center justify-center">
                              <span className="text-[10px] text-slate-500 font-bold">실투자금</span>
                              <span className="text-sm font-black text-white mt-0.5">{Math.round(total/1000000).toLocaleString()}백만원</span>
                            </div>
                          </div>
                        </div>

                        <div className="glass-card p-6 rounded-2xl lg:col-span-2">
                          <h4 className="text-xs font-bold text-white mb-4">투자 항목 리스트 및 지분</h4>
                          <div className="space-y-4">
                            {categoriesList.map((c, idx) => {
                              const catVal = initCost.categories[c];
                              const pct = (catVal.sum / total) * 100;
                              
                              return (
                                <div key={c} className="space-y-1.5">
                                  <div className="flex items-center justify-between text-xs font-semibold">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS_SETUP[idx % COLORS_SETUP.length] }} />
                                      <span className="text-slate-300 font-bold">{c}</span>
                                    </div>
                                    <div className="text-slate-400">
                                      <span className="font-bold text-white">{formatRawWon(catVal.sum)}</span> 
                                      <span className="text-[10px] text-slate-500 ml-2">투자 지분: {pct.toFixed(1)}%</span>
                                    </div>
                                  </div>
                                  <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full rounded-full transition-all duration-500" 
                                      style={{ 
                                        width: `${pct}%`,
                                        backgroundColor: COLORS_SETUP[idx % COLORS_SETUP.length] 
                                      }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-xs font-bold text-white">초기 창업 비용 상세 내역 명세</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                          {categoriesList.map((c, idx) => {
                            const catObj = initCost.categories[c];
                            const sortedItems = [...(catObj.items || [])].sort((a,b) => b.value - a.value);
                            
                            return (
                              <div key={c} className="glass-card rounded-2xl overflow-hidden flex flex-col h-[280px]">
                                <div className="px-4.5 py-3.5 bg-white/2 border-b border-white/5 flex items-center justify-between">
                                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS_SETUP[idx % COLORS_SETUP.length] }} />
                                    {c}
                                  </span>
                                  <span className="text-[11px] font-black text-indigo-400">{formatRawWon(catObj.sum)}</span>
                                </div>
                                <div className="p-3 overflow-y-auto flex-1 custom-scrollbar">
                                  {sortedItems.length > 0 ? (
                                    <table className="w-full text-[11px] text-slate-400">
                                      <tbody>
                                        {sortedItems.map((item, itemIdx) => (
                                          <tr key={itemIdx} className="border-b border-white/2 hover:bg-white/2">
                                            <td className="py-2 text-slate-300 font-medium truncate max-w-[120px]" title={item.name}>{item.name}</td>
                                            <td className="py-2 text-right text-white font-bold">{formatRawWon(item.value)}</td>
                                            <td className="py-2 text-right text-slate-500 text-[10px]">({(item.value / total * 100).toFixed(1)}%)</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  ) : (
                                    <div className="h-full flex items-center justify-center text-[10px] text-slate-600 font-medium">
                                      상세 내역이 없습니다.
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ----------------------------------------------------
          MODAL: DYNAMIC STORE ADD/EDIT MODAL
          ---------------------------------------------------- */}
      {isStoreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm glass-card border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#121622]/50">
              <h4 className="text-sm font-bold text-white">
                {editingStore ? "매장 정보 수정" : "신규 매장 추가"}
              </h4>
              <button 
                onClick={() => setIsStoreModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStore} className="p-6 space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">매장명</label>
                <input
                  type="text"
                  required
                  placeholder="예: 금막창 수성점"
                  value={storeNameInput}
                  onChange={(e) => setStoreNameInput(e.target.value)}
                  className="w-full px-4 py-2 bg-[#121622] border border-white/5 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">업태 대분류</label>
                <select
                  value={storeCatInput}
                  onChange={(e) => setStoreCatInput(e.target.value)}
                  className="w-full px-4 py-2 bg-[#121622] border border-white/5 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500/50"
                >
                  <option value="고기 무한리필">고기 무한리필</option>
                  <option value="소고기 전문점">소고기 전문점</option>
                  <option value="화덕 고등어구이">화덕 고등어구이</option>
                  <option value="한식 전문점">한식 전문점</option>
                  <option value="막창 전문점">막창 전문점</option>
                  <option value="기타">기타 업태</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsStoreModalOpen(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-semibold transition-all"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20"
                >
                  {editingStore ? "수정 완료" : "추가"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          MODAL: UPLOAD VERIFICATION & INSPECTION PREVIEW
          ---------------------------------------------------- */}
      {pendingUploadPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-3xl glass-card border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-fade-in flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#121622]/50">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                <div>
                  <h4 className="text-sm font-bold text-white">매출 데이터 업로드 최종 검수</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    대시보드 반영 전에 점포 매핑 상태 및 데이터를 검증하세요.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setPendingUploadPackage(null)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
              {pendingUploadPackage.errors && pendingUploadPackage.errors.length > 0 && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3.5 rounded-xl text-xs space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    일부 파일 읽기 오류 발생
                  </p>
                  <ul className="list-disc pl-5 text-[11px] text-slate-300">
                    {pendingUploadPackage.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-6">
                {pendingUploadPackage.files.map((file, fIdx) => (
                  <div key={fIdx} className="bg-[#121622] border border-white/5 rounded-xl p-4.5 space-y-4">
                    {/* File Header Info */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/5 pb-3">
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                          <FileText className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="truncate max-w-[280px]" title={file.name}>{file.name}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">
                          총 행수: <span className="text-slate-300 font-semibold">{file.rowCount.toLocaleString()}행</span> | 
                          감지 범위: <span className="text-indigo-400 font-semibold">{file.period}</span>
                        </p>
                      </div>

                      {/* Store Selector Dropdown */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">대상 매장:</span>
                        <select
                          value={file.matchedStoreId}
                          onChange={(e) => {
                            const val = e.target.value;
                            const updatedFiles = [...pendingUploadPackage.files];
                            updatedFiles[fIdx].matchedStoreId = val;
                            setPendingUploadPackage({
                              ...pendingUploadPackage,
                              files: updatedFiles
                            });
                          }}
                          className="bg-[#1a2130] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                        >
                          <option value="new">+ 신규 매장 자동 추가 ("{file.originalStoreName}")</option>
                          {pendingUploadPackage.currentStores.map(store => (
                            <option key={store.id} value={store.id}>{store.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Stats Widget */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/2 p-3 rounded-lg border border-white/5">
                        <span className="text-[10px] text-slate-500 font-medium block">파싱된 실매출 합계</span>
                        <span className="text-sm font-bold text-indigo-400 mt-0.5 block">{formatRawWon(file.totalSales)}</span>
                      </div>
                      <div className="bg-white/2 p-3 rounded-lg border border-white/5">
                        <span className="text-[10px] text-slate-500 font-medium block">데이터 정합성 상태</span>
                        <span className="text-sm font-bold text-emerald-400 mt-0.5 block flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          정상 검증됨
                        </span>
                      </div>
                    </div>

                    {/* Row Preview Table */}
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block mb-2">데이터 행 미리보기 (상위 5개 레코드)</span>
                      <div className="overflow-x-auto border border-white/5 rounded-lg max-h-48 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left text-[10px] text-slate-400">
                          <thead className="bg-[#161a26] sticky top-0 text-slate-500 font-semibold border-b border-white/5">
                            <tr>
                              <th className="py-1.5 px-3">매출일자</th>
                              <th className="py-1.5 px-3">카테고리</th>
                              <th className="py-1.5 px-3">상품명</th>
                              <th className="py-1.5 px-3 text-right">판매수량</th>
                              <th className="py-1.5 px-3 text-right">실매출액</th>
                            </tr>
                          </thead>
                          <tbody>
                            {file.parsedRows.slice(0, 5).map((row, rIdx) => (
                              <tr key={rIdx} className="border-b border-white/5 hover:bg-white/2">
                                <td className="py-1.5 px-3">{row.date}</td>
                                <td className="py-1.5 px-3">{row.category}</td>
                                <td className="py-1.5 px-3 font-bold text-slate-200">{row.itemName}</td>
                                <td className="py-1.5 px-3 text-right text-slate-300">{row.quantity}개</td>
                                <td className="py-1.5 px-3 text-right font-semibold text-indigo-300">{formatRawWon(row.netSales)}</td>
                              </tr>
                            ))}
                            {file.parsedRows.length > 5 && (
                              <tr>
                                <td colSpan={5} className="py-1.5 text-center text-[9px] text-slate-500 bg-white/2">
                                  ...외 {file.parsedRows.length - 5}개의 레코드가 더 존재합니다.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-white/5 bg-[#121622]/50 flex items-center justify-between">
              <span className="text-[10px] text-slate-500 font-medium">
                * 검수 완료 시 대상 매장의 기존 매출 데이터는 엑셀 내 기간으로 교체 및 안전 덮어쓰기됩니다.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPendingUploadPackage(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-semibold transition-all"
                >
                  업로드 취소
                </button>
                <button
                  type="button"
                  onClick={() => {
                    let currentStores = [...pendingUploadPackage.currentStores];
                    let currentSales = [...pendingUploadPackage.currentSales];
                    let currentUploads = [...pendingUploadPackage.currentUploads];
                    let newStoresCount = 0;
                    let successCount = 0;

                    pendingUploadPackage.files.forEach(file => {
                      let storeName = "";
                      if (file.matchedStoreId === "new") {
                        storeName = file.originalStoreName;
                      } else {
                        const matched = currentStores.find(s => s.id === file.matchedStoreId);
                        storeName = matched ? matched.name : file.originalStoreName;
                      }

                      const result = processImport(
                        file.parsedRows,
                        storeName,
                        file.period,
                        file.name,
                        currentStores,
                        currentSales,
                        currentUploads
                      );

                      currentStores = result.updatedStores;
                      currentSales = result.finalSales;
                      currentUploads = result.finalUploads;

                      if (result.isNewStore) {
                        newStoresCount++;
                      }
                      successCount++;
                    });

                    saveStateToLocal(currentStores, currentSales, currentUploads);
                    setPendingUploadPackage(null);

                    setUploadStatusMsg({
                      type: "success",
                      text: `최종 검수 완료! 총 ${successCount}개 파일 대시보드 반영 완료! ${newStoresCount > 0 ? `(신규 매장 ${newStoresCount}개 생성됨)` : ""}`
                    });
                    setTimeout(() => setUploadStatusMsg({ type: "", text: "" }), 5000);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  검수 승인 및 대시보드 반영
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
