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
  Brain,
  Sun,
  Moon,
  Sliders,
  Target,
  Zap,
  Flame,
  Check,
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
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  ReferenceLine,
  ZAxis,
  AreaChart,
  Area,
  ComposedChart
} from "recharts";
import { INITIAL_STORES, STORE_TIME_PROFILES, generateMockSalesData } from "./mockData";
import { parseOKPOSExcel, parseFileNameInfo, parseCostExcel } from "./excelParser";
import { DEFAULT_COST_DATA } from "./mockCostData";
import { 
  loadStoresFromSupabase, 
  saveStoresToSupabase, 
  loadSalesFromSupabase, 
  saveSalesToSupabase, 
  loadUploadLogsFromSupabase, 
  saveUploadLogsToSupabase, 
  loadCostDataFromSupabase, 
  saveCostDataToSupabase 
} from "../lib/supabase";
import * as XLSX from "xlsx";

// Helper to filter out unwanted cost vendors (cards, green hygiene, Lotte kitchen, etc.)
const cleanCostData = (data) => {
  if (!data) return {};
  const EXCLUDED_NAMES = [
    "삼성카드", "신한카드", "국민카드", "그린위생", "샐러드", "네이버쇼핑", 
    "선일금고", "신한카드(소모품)", "주방-롯데주방"
  ];
  
  const cleaned = JSON.parse(JSON.stringify(data));
  
  Object.keys(cleaned).forEach(storeId => {
    const store = cleaned[storeId];
    if (store && store.months) {
      Object.keys(store.months).forEach(monthKey => {
        const monthData = store.months[monthKey];
        if (monthData && monthData.categories) {
          Object.keys(monthData.categories).forEach(catKey => {
            const cat = monthData.categories[catKey];
            if (cat && cat.items && Array.isArray(cat.items)) {
              cat.items = cat.items.filter(item => {
                const name = (item.name || "").trim();
                return !EXCLUDED_NAMES.some(ex => name.includes(ex));
              });
            }
          });
        }
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
const generateAIChatResponse = (query, storeName, totalSummary, menuData, weekdayData) => {
  const q = query.toLowerCase();
  
  if (q.includes("안녕") || q.includes("반가") || q.includes("하이") || q.includes("hello")) {
    return `반갑습니다! **${storeName}** 대시보드 전문 AI 컨설턴트입니다. 🤖\n\n현재 매장의 실시간 매출 추이, 시간대별(아침+점심 vs 저녁) 비중, 상품 ABC 분석 등 데이터에 기반한 마케팅 처방을 도와드릴 수 있습니다. 무엇이든 물어보세요!`;
  }
  
  if (q.includes("시간") || q.includes("점심") || q.includes("저녁") || q.includes("아침")) {
    return `⏰ **${storeName} 시간대별 매출 분석 요약**:\n\n• **아침+점심 (06~16시)**: 점심 식사 수요가 집중되는 골든타임으로 빠른 테이블 회전과 1인/2인 정식 세트 구성이 핵심입니다.\n• **저녁 (16~24시)**: 객단가 상승을 이끄는 주류 및 메인 요리 소비가 일어나는 시간대입니다.\n• **대응 제언**: 저녁 매출이 저조한 경우 '퇴근길 해피아워 주류 할인'을, 점심이 비는 경우 '가성비 점심특선'을 적극 도입하세요!`;
  }

  if (q.includes("매출") || q.includes("얼마") || q.includes("현황") || q.includes("전망") || q.includes("예상")) {
    const est = totalSummary.currentMonthEstimatedSales ? `${Math.round(totalSummary.currentMonthEstimatedSales / 10000).toLocaleString()}만원` : "산출 중";
    const sum = totalSummary.currentMonthSalesSum ? `${Math.round(totalSummary.currentMonthSalesSum / 10000).toLocaleString()}만원` : "0원";
    const avg = totalSummary.dailyAvgSales ? `${Math.round(totalSummary.dailyAvgSales / 10000).toLocaleString()}만원` : "0원";
    
    return `📊 **${storeName} 매출 브리핑**:\n\n• **해당월 실매출액**: **${sum}** (영업 ${totalSummary.currentMonthDays}일 기준)\n• **일평균 매출액**: **${avg}**\n• **해당월 예상 매출**: **${est}** (일평균 × 31일 환산)\n• **역대 최고 일매출**: **${Math.round(totalSummary.peakSales / 10000).toLocaleString()}만원** (${totalSummary.peakDay})\n\n현재 페이스를 유지하면서 저녁 타임 객단가를 10% 높이면 예상 매출을 15% 이상 추가 달성할 수 있습니다.`;
  }
  
  if (q.includes("메뉴") || q.includes("인기") || q.includes("abc") || q.includes("베스트") || q.includes("음식") || q.includes("효자")) {
    if (!menuData || menuData.length === 0) {
      return `현재 조회 기간의 상품 ABC 데이터가 집계되지 않았습니다.`;
    }
    const topA = menuData.filter(m => m.grade === "A").slice(0, 3);
    const topText = topA.map((m, idx) => `${idx + 1}. **${m.name}** (${m.grade}등급, 매출비중 ${m.sharePercent.toFixed(1)}%)`).join("\n");
    const bottomC = menuData.filter(m => m.grade === "C").slice(0, 2);
    const bottomText = bottomC.map(m => `• ${m.name}`).join(", ");
    
    return `🍽️ **${storeName} 상품 ABC 분석 결과**:\n\n**[A등급 핵심 효자 메뉴]**\n${topText}\n\n**[C등급 관리 필요 메뉴]**\n${bottomText || "해당 없음"}\n\n💡 **제언**: 상위 A등급 메뉴의 식자재 품질과 조리 표준화를 점검하시고, C등급 비인기 메뉴는 식자재 로스 절감을 위해 세트 메뉴 결합 또는 메뉴 정리를 추천합니다.`;
  }
  
  if (q.includes("마케팅") || q.includes("이벤트") || q.includes("전략") || q.includes("프로모션") || q.includes("제안") || q.includes("대응")) {
    return `💡 **${storeName} 맞춤형 매출 부스팅 전략 제안**:\n\n1. **시간대별 타임 마케팅**: 점심 피크(11:30~13:30)에는 빠른 회전을 위한 '주문 즉시 제공 정식', 저녁(18:00~21:00)에는 '주류 1+1 또는 사이드 증정 쿠폰'을 네이버 스마트플레이스/당근마켓에 배포하세요.\n2. **A등급 메뉴 번들링**: 가장 잘 팔리는 1위 메뉴와 고마진 사이드 메뉴(음료/찌개)를 결합한 '2인 실속 세트'를 구성하여 테이블 객단가를 3,000~5,000원 상승 유도하세요.\n3. **재방문 락인**: 결제 영수증 리뷰 작성 시 다음 방문 2,000원 할인권을 제공하여 단골 전환율을 20% 이상 끌어올리세요.`;
  }

  return `질문하신 내용에 대해 **${storeName}**의 최신 매출 통계와 메뉴 ABC 포트폴리오를 기반으로 진단했습니다. 상단 대시보드의 **시간대별 추이 차트**와 **ABC 메뉴 테이블**을 함께 확인하시면 더욱 구체적인 현장 실행 방안을 확인하실 수 있습니다.`;
};

export default function App() {
  const [mounted, setMounted] = useState(false);
  const [stores, setStores] = useState(INITIAL_STORES);
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

  const applyQuickPreset = (preset) => {
    if (preset === "7d") {
      setStartDate("2026-08-20");
      setEndDate("2026-08-26");
      setSelectedPeriod("custom");
    } else if (preset === "14d") {
      setStartDate("2026-08-13");
      setEndDate("2026-08-26");
      setSelectedPeriod("custom");
    } else if (preset === "30d") {
      setStartDate("2026-07-28");
      setEndDate("2026-08-26");
      setSelectedPeriod("custom");
    } else if (preset === "currentMonth") {
      setStartDate("2026-08-01");
      setEndDate("2026-08-26");
      setSelectedPeriod("2026-08");
    } else if (preset === "prevMonth") {
      setStartDate("2026-07-01");
      setEndDate("2026-07-31");
      setSelectedPeriod("2026-07");
    } else if (preset === "all") {
      setStartDate("");
      setEndDate("");
      setSelectedPeriod("all");
    }
  };

  // Modals state
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState(null);
  const [storeNameInput, setStoreNameInput] = useState("");
  const [storeCatInput, setStoreCatInput] = useState("기타");

  // Pivot configurations
  const [pivotMetric, setPivotMetric] = useState("netSales"); // "netSales" | "quantity"
  const [pivotSearch, setPivotSearch] = useState("");

  // Menu ABC & Trend config
  const [selectedMenuName, setSelectedMenuName] = useState(null);
  const [menuChartPeriod, setMenuChartPeriod] = useState("daily"); // "daily" | "monthly" | "yearly"
  const [abcGradeFilter, setAbcGradeFilter] = useState("all"); // "all" | "A" | "B" | "C" | "Z"
  const [abcSearchTerm, setAbcSearchTerm] = useState("");
  const [timeSlotChartMode, setTimeSlotChartMode] = useState("composed"); // "composed" | "area" | "bar"
  
  // What-If Strategy Simulator States
  const [whatIfTicketDelta, setWhatIfTicketDelta] = useState(0); // -5000 to +10000
  const [whatIfLunchTurnDelta, setWhatIfLunchTurnDelta] = useState(0); // -20% to +30%

  const [storeTrendPeriod, setStoreTrendPeriod] = useState("daily");
  const [compareYear, setCompareYear] = useState(2026);

  // AI Consultant States
  const [aiAnalysisState, setAiAnalysisState] = useState("idle");
  const [aiAnalysisStep, setAiAnalysisStep] = useState(0);
  const [aiActiveTab, setAiActiveTab] = useState("report");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");

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

  // Reset menu chart and AI when store selection changes
  useEffect(() => {
    setSelectedMenuName(null);
    setStoreTrendPeriod("daily");
    setCompareYear(2026);
    setWhatIfTicketDelta(0);
    setWhatIfLunchTurnDelta(0);
    
    // Reset AI states
    setAiAnalysisState("idle");
    setAiAnalysisStep(0);
    setAiActiveTab("report");
    setChatMessages([]);
    setChatInput("");
  }, [selectedStoreId]);

  // Setup client mount and load data from Supabase / localStorage / IndexedDB
  useEffect(() => {
    setMounted(true);
    
    const localAuth = localStorage.getItem("okpos_auth");
    if (localAuth === "true") {
      setIsLoggedIn(true);
    }
    
    // 1. Initial Local Cache Load
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

    // 2. Load Sales from IndexedDB / Mock
    loadSalesFromIndexedDB().then(async (dbSales) => {
      if (dbSales && dbSales.length > 0) {
        setSalesRecords(dbSales);
      } else {
        const legacySales = localStorage.getItem("okpos_sales");
        if (legacySales) {
          const parsedLegacy = JSON.parse(legacySales);
          setSalesRecords(parsedLegacy);
          await saveSalesToIndexedDB(parsedLegacy);
          localStorage.removeItem("okpos_sales");
        } else if (isFirstRun) {
          const { salesRecords: mockSales, uploadLogs: mockUploads } = generateMockSalesData();
          setSalesRecords(mockSales);
          setUploadLogs(mockUploads);
          await saveSalesToIndexedDB(mockSales);
          localStorage.setItem("okpos_uploads", JSON.stringify(mockUploads));
        } else {
          setSalesRecords([]);
        }
      }
    }).catch(err => {
      console.error("Failed to load from IndexedDB:", err);
    });

    // 3. Cloud Sync: Try fetching latest from Supabase in background
    Promise.all([
      loadStoresFromSupabase(),
      loadSalesFromSupabase(),
      loadUploadLogsFromSupabase(),
      loadCostDataFromSupabase()
    ]).then(([supaStores, supaSales, supaLogs, supaCosts]) => {
      if (supaStores && supaStores.length > 0) {
        setStores(supaStores);
        localStorage.setItem("okpos_stores", JSON.stringify(supaStores));
      }
      if (supaSales && supaSales.length > 0) {
        setSalesRecords(supaSales);
        saveSalesToIndexedDB(supaSales);
      }
      if (supaLogs && supaLogs.length > 0) {
        setUploadLogs(supaLogs);
        localStorage.setItem("okpos_uploads", JSON.stringify(supaLogs));
      }
      if (supaCosts && Object.keys(supaCosts).length > 0) {
        setCostData(supaCosts);
        localStorage.setItem("okpos_cost_data", JSON.stringify(supaCosts));
      }
    }).catch(err => {
      console.warn("Supabase background cloud sync fallback:", err);
    });
  }, []);

  // Sync state to localStorage / IndexedDB and Supabase when updated
  const saveStateToLocal = (newStores, newSales, newUploads) => {
    setStores(newStores);
    setSalesRecords(newSales);
    setUploadLogs(newUploads);
    localStorage.setItem("okpos_stores", JSON.stringify(newStores));
    localStorage.setItem("okpos_uploads", JSON.stringify(newUploads));
    
    saveSalesToIndexedDB(newSales).catch(err => {
      console.error("Failed to sync sales records to IndexedDB:", err);
    });

    // Asynchronous Cloud Sync to Supabase
    saveStoresToSupabase(newStores);
    saveSalesToSupabase(newSales);
    saveUploadLogsToSupabase(newUploads);
  };

  const saveCostDataToLocal = (newCostData) => {
    const cleaned = cleanCostData(newCostData);
    setCostData(cleaned);
    localStorage.setItem("okpos_cost_data", JSON.stringify(cleaned));
    saveCostDataToSupabase(cleaned);
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

  const availableYears = useMemo(() => {
    const years = new Set();
    salesRecords.forEach(r => {
      if (r.date) {
        years.add(parseInt(r.date.substring(0, 4), 10));
      }
    });
    return Array.from(years).sort().reverse();
  }, [salesRecords]);

  const storeMap = useMemo(() => {
    const map = {};
    stores.forEach(s => {
      map[s.id] = s.name;
    });
    return map;
  }, [stores]);

  const latestDateByStore = useMemo(() => {
    const map = {};
    salesRecords.forEach(r => {
      if (!map[r.storeId] || r.date > map[r.storeId]) {
        map[r.storeId] = r.date;
      }
    });
    return map;
  }, [salesRecords]);

  // Store Management CRUD
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
    setStoreCatInput(store.category);
    setIsStoreModalOpen(true);
  };

  const handleSaveStore = () => {
    if (!storeNameInput.trim()) return;

    if (editingStore) {
      const updatedStores = stores.map(s => 
        s.id === editingStore.id 
          ? { ...s, name: storeNameInput.trim(), category: storeCatInput }
          : s
      );
      const updatedSales = salesRecords.map(r => 
        r.storeId === editingStore.id ? { ...r, storeName: storeNameInput.trim() } : r
      );
      const updatedUploads = uploadLogs.map(l => 
        l.storeId === editingStore.id ? { ...l, storeName: storeNameInput.trim() } : l
      );
      saveStateToLocal(updatedStores, updatedSales, updatedUploads);
    } else {
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
    const store = stores.find(s => s.id === storeId);
    if (!store) return;

    if (window.confirm(`[${store.name}] 매장을 삭제하시겠습니까? 관련 모든 매출 데이터가 함께 삭제됩니다.`)) {
      const updatedStores = stores.filter(s => s.id !== storeId);
      const updatedSales = salesRecords.filter(r => r.storeId !== storeId);
      const updatedUploads = uploadLogs.filter(l => l.storeId !== storeId);
      saveStateToLocal(updatedStores, updatedSales, updatedUploads);

      if (selectedStoreId === storeId) {
        setSelectedStoreId("total");
      }
    }
  };

  // Helper to merge a single file into accumulator state
  const applySingleFileToAccumulator = (currentStores, currentSales, currentUploads, storeName, storeId, period, rows, fileName) => {
    let updatedStores = [...currentStores];
    let isNewStore = false;

    if (storeId === "new" || !storeId) {
      const existing = updatedStores.find(s => s.name === storeName);
      if (existing) {
        storeId = existing.id;
      } else {
        const newStoreId = `store-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newStore = {
          id: newStoreId,
          name: storeName,
          category: "기타 (신규)"
        };
        updatedStores.push(newStore);
        storeId = newStoreId;
        isNewStore = true;
      }
    }

    const datesInRows = new Set();
    const monthsInRows = new Set();
    rows.forEach(r => {
      if (r.date) {
        datesInRows.add(r.date);
        monthsInRows.add(r.date.substring(0, 7));
      }
    });

    let filteredSales;
    if (datesInRows.size > 0) {
      filteredSales = currentSales.filter(r => {
        const matchStore = r.storeId === storeId;
        const matchDate = datesInRows.has(r.date);
        return !(matchStore && matchDate);
      });
    } else {
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

    const sortedMonths = Array.from(monthsInRows).sort();
    let displayPeriod = period;
    if (sortedMonths.length > 1) {
      displayPeriod = `${sortedMonths[0]} ~ ${sortedMonths[sortedMonths.length - 1]}`;
    } else if (sortedMonths.length === 1) {
      displayPeriod = sortedMonths[0];
    }

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

  // Individual Store File Upload
  const handleIndividualUpload = async (store, file) => {
    if (!file) return;
    try {
      setUploadStatusMsg({ type: "info", text: "파일을 읽고 분석하는 중..." });
      
      const fileInfo = parseFileNameInfo(file.name, stores);
      const parsedRows = await parseOKPOSExcel(file);
      
      const totalSales = parsedRows.reduce((sum, r) => sum + r.netSales, 0);
      const rowCount = parsedRows.length;
      
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
        matchedStoreId: store.id,
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
    }
  };

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

    let currentStores = [...stores];
    let currentSales = [...salesRecords];
    let currentUploads = [...uploadLogs];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const { storeName, period } = parseFileNameInfo(file.name, currentStores);
        const parsedRows = await parseOKPOSExcel(file);
        
        const totalSales = parsedRows.reduce((sum, r) => sum + r.netSales, 0);
        const rowCount = parsedRows.length;

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
        const matchedStoreId = matchedStore ? matchedStore.id : "new";

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
      saveStateToLocal(currentStores, currentSales, currentUploads);
      setUploadStatusMsg({
        type: "error",
        text: `파일 분석 실패. (${errors.join(", ")})`
      });
      setTimeout(() => setUploadStatusMsg({ type: "", text: "" }), 7000);
    }
  };

  const handleApplyUploadPackage = () => {
    if (!pendingUploadPackage) return;
    
    let curStores = [...pendingUploadPackage.currentStores];
    let curSales = [...pendingUploadPackage.currentSales];
    let curUploads = [...pendingUploadPackage.currentUploads];

    pendingUploadPackage.files.forEach(f => {
      const selectedId = f.matchedStoreId;
      const matchedStoreObj = curStores.find(s => s.id === selectedId);
      const storeName = matchedStoreObj ? matchedStoreObj.name : f.originalStoreName;

      const result = applySingleFileToAccumulator(
        curStores,
        curSales,
        curUploads,
        storeName,
        selectedId,
        f.period,
        f.parsedRows,
        f.name
      );

      curStores = result.updatedStores;
      curSales = result.finalSales;
      curUploads = result.finalUploads;
    });

    saveStateToLocal(curStores, curSales, curUploads);
    setPendingUploadPackage(null);

    setUploadStatusMsg({
      type: "success",
      text: `총 ${pendingUploadPackage.files.length}개 파일이 데이터베이스에 성공적으로 반영되었습니다!`
    });
    setTimeout(() => setUploadStatusMsg({ type: "", text: "" }), 5000);
  };

  const handleRollbackUpload = (log) => {
    if (!window.confirm(`[${log.storeName}] ${log.period} 기간의 데이터(${log.rowCount}행)를 삭제(롤백)하시겠습니까?`)) {
      return;
    }

    let updatedSales;
    const hasUploadId = salesRecords.some(r => r.uploadId === log.id);

    if (hasUploadId) {
      updatedSales = salesRecords.filter(r => r.uploadId !== log.id);
    } else {
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

  const handleRestoreDemoData = () => {
    if (!window.confirm("기본 7개 매장의 데모 매출 데이터를 복구하시겠습니까?")) {
      return;
    }
    const { salesRecords: mockSales, uploadLogs: mockUploads } = generateMockSalesData();
    const finalUploads = [...uploadLogs, ...mockUploads];
    const mockSalesKeySet = new Set(mockSales.map(r => `${r.storeId}-${r.date}`));
    const filteredCurrentSales = salesRecords.filter(r => !mockSalesKeySet.has(`${r.storeId}-${r.date}`));
    const finalSales = [...filteredCurrentSales, ...mockSales];

    saveStateToLocal(stores, finalSales, finalUploads);
    setUploadStatusMsg({ type: "success", text: "데모 데이터가 성공적으로 복구되었습니다!" });
    setTimeout(() => setUploadStatusMsg({ type: "", text: "" }), 5000);
  };

  // ----------------------------------------------------
  // FILTERED SALES DATA CALCULATION
  // ----------------------------------------------------
  const filteredSalesData = useMemo(() => {
    return salesRecords.filter(r => {
      if (selectedStoreId !== "total" && r.storeId !== selectedStoreId) {
        return false;
      }
      if (selectedPeriod !== "all") {
        if (startDate && r.date < startDate) return false;
        if (endDate && r.date > endDate) return false;
      }
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
  }, [salesRecords, selectedStoreId, selectedPeriod, startDate, endDate, selectedCategory]);

  // ----------------------------------------------------
  // TOTAL SUMMARY KPI METRICS (Including Formulas)
  // ----------------------------------------------------
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

    // Calculate Peak Sales Day for this store
    const storeTargetSales = salesRecords.filter(r => selectedStoreId === "total" || r.storeId === selectedStoreId);
    const dailySalesMap = {};
    storeTargetSales.forEach(r => {
      if (r.date) {
        dailySalesMap[r.date] = (dailySalesMap[r.date] || 0) + (r.netSales || 0);
      }
    });

    let peakDay = "-";
    let peakSales = 0;
    Object.keys(dailySalesMap).forEach(d => {
      if (dailySalesMap[d] > peakSales) {
        peakSales = dailySalesMap[d];
        peakDay = d;
      }
    });

    // Current Month metrics based on active data (August 2026)
    const today = new Date();
    const currentYear = 2026;
    const currentMonthNum = 8;
    const currentMonthStr = "2026-08";
    const currentMonthLabel = `26년 8월 총매출`;

    let currentMonthSalesSum = 0;
    const currentMonthDaysWithSales = new Set();

    storeTargetSales.forEach(r => {
      if (r.date && r.date.startsWith(currentMonthStr)) {
        currentMonthSalesSum += r.netSales || 0;
        currentMonthDaysWithSales.add(r.date);
      }
    });

    const currentMonthDays = currentMonthDaysWithSales.size || 26;
    const currentMonthTotalDays = 31; // August has 31 days
    const currentMonthAvgSales = currentMonthDays > 0 ? (currentMonthSalesSum / currentMonthDays) : 0;
    
    // Formula: (조회기준 매출 / 해당일수 * 해당월 총 일수)
    const currentMonthEstimatedSales = currentMonthAvgSales * currentMonthTotalDays;

    return {
      netSales,
      discount,
      quantity,
      dailyAvgSales,
      peakDay,
      peakSales,
      currentMonthLabel,
      currentMonthNum,
      currentMonthSalesSum,
      currentMonthDays,
      currentMonthTotalDays,
      currentMonthAvgSales,
      currentMonthEstimatedSales
    };
  }, [filteredSalesData, salesRecords, selectedStoreId]);

  // ----------------------------------------------------
  // TIME SLOT TREND DATA (아침+점심 vs 저녁 분리 추이)
  // ----------------------------------------------------
  const timeSlotTrendChartData = useMemo(() => {
    if (selectedStoreId === "total") return [];
    
    const dailyMap = {};
    const storeName = storeMap[selectedStoreId] || "";
    const storeProfile = STORE_TIME_PROFILES[storeName] || { morningRatio: 0.02, lunchRatio: 0.35, dinnerRatio: 0.63, avgTicket: 40000 };

    filteredSalesData.forEach(r => {
      if (!r.date || r.storeId !== selectedStoreId) return;
      if (!dailyMap[r.date]) {
        dailyMap[r.date] = {
          date: r.date,
          dateLabel: r.date.substring(5), // MM-DD
          morningSales: 0,
          morningCount: 0,
          lunchSales: 0,
          lunchCount: 0,
          dinnerSales: 0,
          dinnerCount: 0,
          totalSales: 0,
          totalCount: 0
        };
      }

      const dayObj = dailyMap[r.date];
      dayObj.totalSales += r.netSales || 0;
      dayObj.totalCount += r.quantity || 0;

      if (r.timeSlot === "morning" || r.category === "시간대_아침") {
        dayObj.morningSales += r.netSales || 0;
        dayObj.morningCount += r.quantity || 0;
      } else if (r.timeSlot === "lunch" || r.category === "시간대_점심") {
        dayObj.lunchSales += r.netSales || 0;
        dayObj.lunchCount += r.quantity || 0;
      } else if (r.timeSlot === "dinner" || r.category === "시간대_저녁") {
        dayObj.dinnerSales += r.netSales || 0;
        dayObj.dinnerCount += r.quantity || 0;
      } else {
        if (r.category === "정식류" || r.category === "식사류" || r.category === "찌개류" || (r.itemName && r.itemName.includes("점심"))) {
          dayObj.lunchSales += Math.round((r.netSales || 0) * 0.85);
          dayObj.dinnerSales += Math.round((r.netSales || 0) * 0.15);
          dayObj.lunchCount += Math.round((r.quantity || 0) * 0.85);
          dayObj.dinnerCount += Math.round((r.quantity || 0) * 0.15);
        } else if (r.category === "주류" || r.category === "막창류" || (r.itemName && (r.itemName.includes("소주") || r.itemName.includes("맥주") || r.itemName.includes("막창")))) {
          dayObj.dinnerSales += Math.round((r.netSales || 0) * 0.90);
          dayObj.lunchSales += Math.round((r.netSales || 0) * 0.10);
          dayObj.dinnerCount += Math.round((r.quantity || 0) * 0.90);
          dayObj.lunchCount += Math.round((r.quantity || 0) * 0.10);
        } else {
          dayObj.morningSales += Math.round((r.netSales || 0) * storeProfile.morningRatio);
          dayObj.lunchSales += Math.round((r.netSales || 0) * storeProfile.lunchRatio);
          dayObj.dinnerSales += Math.round((r.netSales || 0) * storeProfile.dinnerRatio);
          dayObj.lunchCount += Math.round((r.quantity || 0) * (storeProfile.lunchRatio + storeProfile.morningRatio));
          dayObj.dinnerCount += Math.round((r.quantity || 0) * storeProfile.dinnerRatio);
        }
      }
    });

    const sortedDates = Object.keys(dailyMap).sort();
    return sortedDates.map(d => {
      const item = dailyMap[d];
      const morningLunchSales = item.morningSales + item.lunchSales;
      const morningLunchCount = Math.max(item.morningCount + item.lunchCount, 1);
      const dinnerSales = item.dinnerSales;
      const dinnerCount = Math.max(item.dinnerCount, 1);
      const totalSales = morningLunchSales + dinnerSales;
      const totalCount = morningLunchCount + dinnerCount;

      const morningLunchAvg = Math.round(morningLunchSales / morningLunchCount);
      const dinnerAvg = Math.round(dinnerSales / dinnerCount);
      const morningLunchRatio = totalSales > 0 ? (morningLunchSales / totalSales) * 100 : 0;
      const dinnerRatio = totalSales > 0 ? (dinnerSales / totalSales) * 100 : 0;

      return {
        date: d,
        dateLabel: item.dateLabel,
        morningSales: item.morningSales,
        lunchSales: item.lunchSales,
        morningLunchSales,
        morningLunchSalesManwon: Math.round(morningLunchSales / 10000),
        dinnerSales,
        dinnerSalesManwon: Math.round(dinnerSales / 10000),
        totalSales,
        totalSalesManwon: Math.round(totalSales / 10000),
        morningLunchCount,
        dinnerCount,
        totalCount,
        morningLunchAvg,
        dinnerAvg,
        morningLunchRatio: Math.round(morningLunchRatio * 10) / 10,
        dinnerRatio: Math.round(dinnerRatio * 10) / 10
      };
    });
  }, [filteredSalesData, selectedStoreId, storeMap]);

  // Summary indicators for time slots
  const timeSlotSummary = useMemo(() => {
    if (timeSlotTrendChartData.length === 0) {
      return {
        totalMorningLunch: 0,
        totalDinner: 0,
        totalSales: 0,
        morningLunchRatio: 0,
        dinnerRatio: 0,
        morningLunchCount: 0,
        dinnerCount: 0,
        morningLunchAvg: 0,
        dinnerAvg: 0,
        patternType: "데이터 없음",
        patternColor: "text-slate-400",
        strategyHint: "해당 기간의 매출 데이터가 없습니다."
      };
    }

    let totalML = 0;
    let totalD = 0;
    let countML = 0;
    let countD = 0;

    timeSlotTrendChartData.forEach(d => {
      totalML += d.morningLunchSales;
      totalD += d.dinnerSales;
      countML += d.morningLunchCount;
      countD += d.dinnerCount;
    });

    const totalSales = totalML + totalD;
    const mlRatio = totalSales > 0 ? (totalML / totalSales) * 100 : 0;
    const dRatio = totalSales > 0 ? (totalD / totalSales) * 100 : 0;
    const mlAvg = countML > 0 ? Math.round(totalML / countML) : 0;
    const dAvg = countD > 0 ? Math.round(totalD / countD) : 0;

    let patternType = "주야 균형형 매장";
    let patternColor = "text-indigo-400 bg-indigo-500/10 border-indigo-500/20";
    let strategyHint = "점심과 저녁의 매출 밸런스가 균형을 이루고 있습니다. 피크타임 회전율과 고마진 사이드 메뉴 업셀링에 집중하세요.";

    if (mlRatio >= 65) {
      patternType = "점심 집중형 (런치 피크)";
      patternColor = "text-cyan-400 bg-cyan-500/10 border-cyan-500/20";
      strategyHint = "점심 식사 비중이 매우 높습니다. 저녁 시간대 객단가를 높이기 위해 퇴근 직장인 타겟 '해피아워 주류/사이드 묶음 할인' 및 사전 예약 프로모션을 추천합니다.";
    } else if (dRatio >= 65) {
      patternType = "저녁 골든타임형 (디너/주류)";
      patternColor = "text-purple-400 bg-purple-500/10 border-purple-500/20";
      strategyHint = "저녁 및 주류 소비 비중이 높습니다. 평일 점심의 유휴 공간을 채우기 위해 '1~2인 가성비 점심특선' 메뉴를 도입하여 고정비 부담을 경감하세요.";
    }

    return {
      totalMorningLunch: totalML,
      totalDinner: totalD,
      totalSales,
      morningLunchRatio: Math.round(mlRatio * 10) / 10,
      dinnerRatio: Math.round(dRatio * 10) / 10,
      morningLunchCount: countML,
      dinnerCount: countD,
      morningLunchAvg: mlAvg,
      dinnerAvg: dAvg,
      patternType,
      patternColor,
      strategyHint
    };
  }, [timeSlotTrendChartData]);

  // ----------------------------------------------------
  // MENU ABC ANALYSIS DATA
  // ----------------------------------------------------
  const menuAbcAnalysisData = useMemo(() => {
    if (filteredSalesData.length === 0) return [];
    
    const menuMap = {};
    let storeTotalSales = 0;

    filteredSalesData.forEach(r => {
      if (!r.itemName || r.itemName.startsWith("시간대_")) return;

      if (!menuMap[r.itemName]) {
        menuMap[r.itemName] = {
          name: r.itemName,
          category: r.category || "메뉴",
          code: r.itemCode || "00001",
          quantity: 0,
          totalSales: 0,
          discount: 0,
          netSales: 0
        };
      }
      menuMap[r.itemName].quantity += r.quantity || 0;
      menuMap[r.itemName].totalSales += r.totalSales || 0;
      menuMap[r.itemName].discount += r.discount || 0;
      menuMap[r.itemName].netSales += r.netSales || 0;
      storeTotalSales += r.netSales || 0;
    });

    const sortedMenus = Object.values(menuMap).sort((a, b) => b.netSales - a.netSales);

    let cumulativeSales = 0;
    return sortedMenus.map((menu, index) => {
      cumulativeSales += menu.netSales;
      const sharePercent = storeTotalSales > 0 ? (menu.netSales / storeTotalSales) * 100 : 0;
      const cumulativePercent = storeTotalSales > 0 ? (cumulativeSales / storeTotalSales) * 100 : 0;
      
      let grade = "C";
      let badgeStyle = "bg-amber-900/40 text-amber-400 border border-amber-800/60";
      let badgeLabel = "C등급";

      if (cumulativePercent <= 70) {
        grade = "A";
        badgeStyle = "bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 shadow-[0_0_8px_rgba(234,179,8,0.2)]";
        badgeLabel = "A등급 (핵심)";
      } else if (cumulativePercent <= 90) {
        grade = "B";
        badgeStyle = "bg-slate-300/25 text-slate-200 border border-slate-400/30";
        badgeLabel = "B등급";
      }

      if (menu.netSales === 0) {
        grade = "Z";
        badgeStyle = "bg-zinc-800 text-zinc-400 border border-zinc-700";
        badgeLabel = "Z등급";
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

  // Set default selected menu to top A menu on store change
  useEffect(() => {
    if (menuAbcAnalysisData.length > 0 && !selectedMenuName) {
      setSelectedMenuName(menuAbcAnalysisData[0].name);
    }
  }, [menuAbcAnalysisData, selectedMenuName]);

  // Filtered ABC menu table by grade tabs & search
  const filteredAbcMenus = useMemo(() => {
    let list = menuAbcAnalysisData;
    if (abcGradeFilter !== "all") {
      list = list.filter(m => m.grade === abcGradeFilter);
    }
    if (abcSearchTerm.trim()) {
      const q = abcSearchTerm.toLowerCase();
      list = list.filter(m => 
        m.name.toLowerCase().includes(q) || 
        m.category.toLowerCase().includes(q) || 
        (m.code && m.code.toLowerCase().includes(q))
      );
    }
    return list;
  }, [menuAbcAnalysisData, abcGradeFilter, abcSearchTerm]);

  // Selected Menu Statistics
  const selectedMenuStats = useMemo(() => {
    if (!selectedMenuName || selectedStoreId === "total") return null;
    const targetRecords = salesRecords.filter(r => r.storeId === selectedStoreId && r.itemName === selectedMenuName);
    if (targetRecords.length === 0) return null;

    let totalSales = 0;
    let totalQty = 0;
    const dailyMap = {};

    targetRecords.forEach(r => {
      totalSales += r.netSales || 0;
      totalQty += r.quantity || 0;
      if (r.date) {
        dailyMap[r.date] = (dailyMap[r.date] || 0) + (r.netSales || 0);
      }
    });

    let peakDay = "-";
    let peakSales = 0;
    Object.keys(dailyMap).forEach(d => {
      if (dailyMap[d] > peakSales) {
        peakSales = dailyMap[d];
        peakDay = d;
      }
    });

    const dayCount = Object.keys(dailyMap).length || 1;
    const dailyAvgQty = Math.round((totalQty / dayCount) * 10) / 10;
    const dailyAvgSales = Math.round(totalSales / dayCount);

    const storeTotal = filteredSalesData.reduce((sum, r) => sum + (r.netSales || 0), 0);
    const storeShare = storeTotal > 0 ? ((totalSales / storeTotal) * 100).toFixed(1) : 0;

    const matchedAbc = menuAbcAnalysisData.find(m => m.name === selectedMenuName);

    return {
      name: selectedMenuName,
      category: matchedAbc?.category || targetRecords[0]?.category || "메뉴",
      grade: matchedAbc?.grade || "A",
      rank: matchedAbc?.rank || 1,
      badgeStyle: matchedAbc?.badgeStyle || "bg-yellow-500/20 text-yellow-300 border border-yellow-500/40",
      totalSales,
      totalQty,
      dailyAvgQty,
      dailyAvgSales,
      peakDay,
      peakSales,
      storeShare
    };
  }, [selectedMenuName, selectedStoreId, salesRecords, filteredSalesData, menuAbcAnalysisData]);

  // Selected Menu Trend Chart Data
  const menuTrendChartData = useMemo(() => {
    if (!selectedMenuName || selectedStoreId === "total") return [];
    
    const filtered = salesRecords.filter(r => {
      if (r.storeId !== selectedStoreId || r.itemName !== selectedMenuName) return false;
      if (selectedPeriod !== "all") {
        if (startDate && r.date < startDate) return false;
        if (endDate && r.date > endDate) return false;
      }
      return true;
    });

    if (menuChartPeriod === "daily") {
      const dailyMap = {};
      filtered.forEach(r => {
        if (r.date) {
          if (!dailyMap[r.date]) dailyMap[r.date] = { sales: 0, qty: 0 };
          dailyMap[r.date].sales += (r.netSales || 0);
          dailyMap[r.date].qty += (r.quantity || 0);
        }
      });
      return Object.keys(dailyMap).sort().map(d => ({
        date: d,
        dateLabel: d.substring(5), // MM-DD
        sales: dailyMap[d].sales,
        salesManwon: Math.round(dailyMap[d].sales / 10000),
        quantity: dailyMap[d].qty
      }));
    } else if (menuChartPeriod === "monthly") {
      const monthlyMap = {};
      filtered.forEach(r => {
        if (r.date) {
          const m = r.date.substring(0, 7);
          if (!monthlyMap[m]) monthlyMap[m] = { sales: 0, qty: 0 };
          monthlyMap[m].sales += (r.netSales || 0);
          monthlyMap[m].qty += (r.quantity || 0);
        }
      });
      return Object.keys(monthlyMap).sort().map(m => ({
        date: m,
        dateLabel: `${parseInt(m.split("-")[1], 10)}월`,
        sales: monthlyMap[m].sales,
        salesManwon: Math.round(monthlyMap[m].sales / 10000),
        quantity: monthlyMap[m].qty
      }));
    } else {
      const yearlyMap = {};
      filtered.forEach(r => {
        if (r.date) {
          const y = r.date.substring(0, 4);
          if (!yearlyMap[y]) yearlyMap[y] = { sales: 0, qty: 0 };
          yearlyMap[y].sales += (r.netSales || 0);
          yearlyMap[y].qty += (r.quantity || 0);
        }
      });
      return Object.keys(yearlyMap).sort().map(y => ({
        date: y,
        dateLabel: `${y}년`,
        sales: yearlyMap[y].sales,
        salesManwon: Math.round(yearlyMap[y].sales / 10000),
        quantity: yearlyMap[y].qty
      }));
    }
  }, [salesRecords, selectedStoreId, selectedMenuName, menuChartPeriod, selectedPeriod, startDate, endDate]);

  // ----------------------------------------------------
  // WHAT-IF STRATEGY SIMULATOR LOGIC
  // ----------------------------------------------------
  const whatIfSimulation = useMemo(() => {
    if (selectedStoreId === "total") return null;
    const baseSales = totalSummary.currentMonthSalesSum || 100000000;
    const days = totalSummary.currentMonthDays || 26;
    const totalMonthDays = totalSummary.currentMonthTotalDays || 31;
    const baseEstSales = totalSummary.currentMonthEstimatedSales || (baseSales / days) * totalMonthDays;
    
    const dailyDinnerCount = timeSlotSummary.dinnerCount > 0 ? (timeSlotSummary.dinnerCount / Math.max(days, 1)) : 40;
    const remainDays = Math.max(totalMonthDays - days, 5);
    const dinnerRevenueImpact = whatIfTicketDelta * dailyDinnerCount * remainDays;

    const dailyLunchSales = timeSlotSummary.totalMorningLunch > 0 ? (timeSlotSummary.totalMorningLunch / Math.max(days, 1)) : (baseSales / days * 0.4);
    const lunchRevenueImpact = dailyLunchSales * (whatIfLunchTurnDelta / 100) * remainDays;

    const totalRevenueGain = dinnerRevenueImpact + lunchRevenueImpact;
    const newEstSales = baseEstSales + totalRevenueGain;
    const estProfitGain = Math.round(totalRevenueGain * 0.45); // 45% contribution margin

    return {
      baseEstSales,
      newEstSales,
      totalRevenueGain,
      estProfitGain,
      dinnerRevenueImpact,
      lunchRevenueImpact,
      remainDays
    };
  }, [selectedStoreId, totalSummary, timeSlotSummary, whatIfTicketDelta, whatIfLunchTurnDelta]);

  // Helper formatters
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

  // Unmounted state loader
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
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDelay: "2s" }}></div>

        <div className="w-full max-w-md glass-card border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-8 relative z-10">
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

          <form onSubmit={handleLogin} className="space-y-5">
            {loginError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span className="font-semibold">{loginError}</span>
              </div>
            )}

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

            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 mt-6 active:scale-[0.98]"
            >
              <ShieldCheck className="w-4 h-4" />
              보안 로그인
            </button>
          </form>

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
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                  (주)올이유
                </span>
                <span className="text-xs text-slate-500 font-medium">F&B 데이터 허브</span>
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Supabase Cloud
                </span>
              </div>
              <h1 className="text-lg md:text-xl font-black text-white tracking-tight">
                매장 데이터 분석 시스템
              </h1>
            </div>
          </div>

          {/* Global Mode Tabs */}
          <nav className="flex items-center bg-[#131722] p-1 rounded-xl border border-white/5 text-xs">
            <button
              onClick={() => setGlobalTab("dashboard")}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                globalTab === "dashboard"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              대시보드
            </button>
            <button
              onClick={() => setGlobalTab("upload")}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                globalTab === "upload"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              엑셀 업로드
            </button>
            <button
              onClick={handleLogout}
              className="px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-rose-400 transition-colors ml-1"
              title="로그아웃"
            >
              <Lock className="w-3.5 h-3.5" />
            </button>
          </nav>
        </div>
      </header>

      {/* ----------------------------------------------------
          SUB-HEADER: STORE SELECTOR & DATE RANGE CONTROLS
          ---------------------------------------------------- */}
      {globalTab === "dashboard" && (
        <div className="bg-[#0c0f17] border-b border-white/5 px-4 py-3 lg:px-6 flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          {/* Store Tabs Horizontal Slider */}
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar w-full lg:w-auto pb-1 lg:pb-0">
            <button
              onClick={() => setSelectedStoreId("total")}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedStoreId === "total"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "bg-[#131722] text-slate-400 hover:text-slate-200 border border-white/5"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              전체 매장 통합
            </button>
            {stores.map((store) => (
              <div
                key={store.id}
                onClick={() => setSelectedStoreId(store.id)}
                className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                  selectedStoreId === store.id
                    ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30"
                    : "bg-[#131722] text-slate-400 hover:text-slate-200 border-white/5 hover:border-white/10"
                }`}
              >
                <span>{store.name}</span>
                <button
                  onClick={(e) => handleOpenEditStore(store, e)}
                  className="hover:text-amber-400 p-0.5 text-slate-500 ml-1"
                  title="매장명 수정"
                >
                  <Edit className="w-2.5 h-2.5" />
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

          {/* Quick Date Range Preset Buttons & Custom Picker */}
          <div className="flex items-center gap-2 w-full lg:w-auto justify-start sm:justify-between lg:justify-start flex-wrap">
            {/* Quick Presets */}
            <div className="flex items-center bg-[#131722] p-0.5 rounded-lg border border-white/5 text-[10px]">
              <button
                onClick={() => applyQuickPreset("7d")}
                className="px-2 py-1 rounded font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                최근 7일
              </button>
              <button
                onClick={() => applyQuickPreset("14d")}
                className="px-2 py-1 rounded font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                14일
              </button>
              <button
                onClick={() => applyQuickPreset("30d")}
                className="px-2 py-1 rounded font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                30일
              </button>
              <button
                onClick={() => applyQuickPreset("currentMonth")}
                className="px-2 py-1 rounded font-semibold text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-all"
              >
                8월 (당월)
              </button>
              <button
                onClick={() => applyQuickPreset("prevMonth")}
                className="px-2 py-1 rounded font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                7월 (전월)
              </button>
              <button
                onClick={() => applyQuickPreset("all")}
                className="px-2 py-1 rounded font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                전체
              </button>
            </div>

            {/* Custom Range Picker */}
            <div className="flex items-center bg-[#131722] rounded-lg px-2 py-1 border border-white/5 text-xs gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="bg-transparent border-none text-slate-200 text-[11px] font-semibold focus:outline-none cursor-pointer"
                style={{ colorScheme: 'dark' }}
              />
              <span className="text-slate-500 font-bold">~</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="bg-transparent border-none text-slate-200 text-[11px] font-semibold focus:outline-none cursor-pointer"
                style={{ colorScheme: 'dark' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          MAIN CONTENT CONTAINER
          ---------------------------------------------------- */}
      <main className="flex-1 p-4 lg:p-6 overflow-y-auto space-y-6 max-w-7xl mx-auto w-full animate-fade-in">
        
        {/* Global Notifications Panel */}
        {uploadStatusMsg.text && (
          <div className={`p-4 rounded-xl border flex items-start gap-3 shadow-lg ${
            uploadStatusMsg.type === "success" 
              ? "bg-emerald-950/30 text-emerald-300 border-emerald-500/20"
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
            {/* Top 4 KPI Cards for Integrated view */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-card p-5 rounded-2xl border-l-4 border-l-indigo-500 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                    <span>전체 당월 일매출 총합</span>
                    <DollarSign className="w-4 h-4 text-indigo-400" />
                  </div>
                  <h3 className="text-2xl font-black text-white mt-2">
                    {formatRawWon(totalSummary.currentMonthSalesSum)}
                  </h3>
                </div>
                <p className="text-[10px] text-indigo-300/80 mt-2 font-medium">
                  {totalSummary.currentMonthLabel} (총 {stores.length}개 지점 합산)
                </p>
              </div>

              <div className="glass-card p-5 rounded-2xl border-l-4 border-l-cyan-500 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                    <span>전체 일평균 매출</span>
                    <TrendingUp className="w-4 h-4 text-cyan-400" />
                  </div>
                  <h3 className="text-2xl font-black text-white mt-2">
                    {formatRawWon(totalSummary.dailyAvgSales)}
                  </h3>
                </div>
                <p className="text-[10px] text-slate-400 mt-2 font-medium">
                  영업 {totalSummary.currentMonthDays}일 기준 일일 평균
                </p>
              </div>

              <div className="glass-card p-5 rounded-2xl border-l-4 border-l-purple-500 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                    <span>당월 예상 매출</span>
                    <Target className="w-4 h-4 text-purple-400" />
                  </div>
                  <h3 className="text-2xl font-black text-purple-300 mt-2">
                    {formatRawWon(Math.round(totalSummary.currentMonthEstimatedSales))}
                  </h3>
                </div>
                <p className="text-[10px] text-purple-300/80 mt-2 font-medium" title="공식: 조회기준 매출 / 해당일수 * 해당월 총 일수">
                  공식: (일매출 총합 ÷ {totalSummary.currentMonthDays}일 × {totalSummary.currentMonthTotalDays}일)
                </p>
              </div>

              <div className="glass-card p-5 rounded-2xl border-l-4 border-l-emerald-500 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                    <span>역대 최고 매출금액</span>
                    <Award className="w-4 h-4 text-emerald-400" />
                  </div>
                  <h3 className="text-2xl font-black text-emerald-400 mt-2">
                    {formatRawWon(totalSummary.peakSales)}
                  </h3>
                </div>
                <p className="text-[10px] text-slate-400 mt-2 font-medium">
                  최고 매출일: {totalSummary.peakDay}
                </p>
              </div>
            </div>

            {/* Store Grid Cards */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Store className="w-4 h-4 text-indigo-400" />
                지점별 상세 대시보드 바로가기
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stores.map((store) => (
                  <div
                    key={store.id}
                    onClick={() => setSelectedStoreId(store.id)}
                    className="glass-card p-5 rounded-2xl cursor-pointer hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 transition-all group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          {store.category}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                      </div>
                      <h5 className="text-base font-bold text-white mt-2 group-hover:text-indigo-400 transition-colors">
                        {store.name}
                      </h5>
                    </div>
                    <div className="mt-4 pt-3 border-t border-white/5 text-xs text-slate-400 flex items-center justify-between">
                      <span>최신 데이터</span>
                      <span className="font-semibold text-slate-200">{latestDateByStore[store.id] || "데이터 없음"}</span>
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
            {/* Header: Store Name & Category */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-5 rounded-2xl border-l-4 border-l-indigo-500">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    {stores.find(s => s.id === selectedStoreId)?.category}
                  </span>
                  <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Calendar className="w-3 h-3 text-emerald-400" />
                    최신 데이터: {latestDateByStore[selectedStoreId] || "데이터 없음"}
                  </span>
                </div>
                <h2 className="text-2xl font-black text-white mt-1.5 flex items-center gap-2">
                  {storeMap[selectedStoreId]}
                  <span className="text-sm font-normal text-slate-400">매장 분석 대시보드</span>
                </h2>
              </div>
            </div>

            {/* ----------------------------------------------------
                1. TOP 4 KEY KPI CARDS
                ---------------------------------------------------- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. 해당월의 일매출 총합 */}
              <div className="glass-card p-5 rounded-2xl border-l-4 border-l-indigo-500 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                    <span>해당월 일매출 총합</span>
                    <DollarSign className="w-4 h-4 text-indigo-400" />
                  </div>
                  <h3 className="text-2xl font-black text-white mt-2">
                    {formatRawWon(totalSummary.currentMonthSalesSum)}
                  </h3>
                </div>
                <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400">
                  <span>선택 기간 실매출액</span>
                  <span className="font-bold text-indigo-300">{formatRawWon(totalSummary.netSales)}</span>
                </div>
              </div>

              {/* 2. 일평균 매출 */}
              <div className="glass-card p-5 rounded-2xl border-l-4 border-l-cyan-500 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                    <span>일평균 매출</span>
                    <TrendingUp className="w-4 h-4 text-cyan-400" />
                  </div>
                  <h3 className="text-2xl font-black text-cyan-300 mt-2">
                    {formatRawWon(totalSummary.dailyAvgSales)}
                  </h3>
                </div>
                <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400">
                  <span>분석 영업일수</span>
                  <span className="font-bold text-white">{totalSummary.currentMonthDays}일 기준</span>
                </div>
              </div>

              {/* 3. 예상매출 (조회기준 매출 / 해당일수 * 해당월 총 일수) */}
              <div className="glass-card p-5 rounded-2xl border-l-4 border-l-purple-500 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-xl pointer-events-none"></div>
                <div>
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                    <span className="flex items-center gap-1">
                      <Target className="w-3.5 h-3.5 text-purple-400" />
                      당월 예상 매출
                    </span>
                    <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-bold">
                      {totalSummary.currentMonthNum}월 환산
                    </span>
                  </div>
                  <h3 className="text-2xl font-black text-purple-300 mt-2">
                    {formatRawWon(Math.round(totalSummary.currentMonthEstimatedSales))}
                  </h3>
                </div>
                <div className="mt-3 pt-2 border-t border-white/5 text-[10px] text-purple-300/80 font-medium cursor-help" title={`공식: (${formatRawWon(totalSummary.currentMonthSalesSum)} / ${totalSummary.currentMonthDays}일) * ${totalSummary.currentMonthTotalDays}일`}>
                  (조회기준 매출 ÷ {totalSummary.currentMonthDays}일 × {totalSummary.currentMonthTotalDays}일)
                </div>
              </div>

              {/* 4. 역대 최고 매출금액 */}
              <div className="glass-card p-5 rounded-2xl border-l-4 border-l-emerald-500 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                    <span>역대 최고 매출금액</span>
                    <Award className="w-4 h-4 text-emerald-400" />
                  </div>
                  <h3 className="text-2xl font-black text-emerald-400 mt-2">
                    {formatRawWon(totalSummary.peakSales)}
                  </h3>
                </div>
                <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400">
                  <span>최고 매출 일자</span>
                  <span className="font-bold text-emerald-400">{totalSummary.peakDay}</span>
                </div>
              </div>
            </div>

            {/* ----------------------------------------------------
                2. 시간대별 매출 추이 (아침+점심 vs 저녁 분리 그래프)
                ---------------------------------------------------- */}
            <div className="glass-card p-6 rounded-2xl space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-indigo-400" />
                    시간대별 매출 추이 분석 (아침·점심 vs 저녁)
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    OKPOS 시간대별 결제 데이터를 바탕으로 <span className="text-cyan-400 font-bold">아침+점심(06~16시)</span>과 <span className="text-purple-400 font-bold">저녁(16~24시)</span> 매출을 분리하여 추이를 비교합니다.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-cyan-400"></span>
                      <span className="text-slate-300 font-medium">아침+점심 (06~16시)</span>
                    </div>
                    <div className="flex items-center gap-1.5 ml-2">
                      <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                      <span className="text-slate-300 font-medium">저녁 (16~24시)</span>
                    </div>
                  </div>
                  <span className="text-xs text-indigo-400 font-semibold">(단위: 만원)</span>
                </div>
              </div>

              {/* Chart */}
              <div className="h-72">
                {timeSlotTrendChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={timeSlotTrendChartData}
                      margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient id="lunchGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="dinnerGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="dateLabel" stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#131722", borderColor: "rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "12px" }}
                        formatter={(val, name) => {
                          if (name === "morningLunchSalesManwon") return [`${val.toLocaleString()} 만원`, "☀️ 아침+점심 실매출"];
                          if (name === "dinnerSalesManwon") return [`${val.toLocaleString()} 만원`, "🌙 저녁 실매출"];
                          return [`${val} 만원`, name];
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="morningLunchSalesManwon"
                        stroke="#06b6d4"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#lunchGrad)"
                      />
                      <Area
                        type="monotone"
                        dataKey="dinnerSalesManwon"
                        stroke="#a855f7"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#dinnerGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500 text-xs">시간대별 매출 데이터가 없습니다.</div>
                )}
              </div>

              {/* 3 Summary Cards underneath */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="bg-[#121622] p-4 rounded-xl border border-white/5 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                      <Sun className="w-4 h-4 text-cyan-400" />
                      아침 + 점심 (06~16시)
                    </span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                      비중 {timeSlotSummary.morningLunchRatio}%
                    </span>
                  </div>
                  <div className="mt-3 space-y-1">
                    <p className="text-lg font-extrabold text-white">{formatRawWon(timeSlotSummary.totalMorningLunch)}</p>
                    <p className="text-[11px] text-slate-400">
                      영수건수: <span className="text-slate-200 font-bold">{timeSlotSummary.morningLunchCount.toLocaleString()}건</span> · 평균단가: <span className="text-cyan-300 font-bold">{timeSlotSummary.morningLunchAvg.toLocaleString()}원</span>
                    </p>
                  </div>
                </div>

                <div className="bg-[#121622] p-4 rounded-xl border border-white/5 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                      <Moon className="w-4 h-4 text-purple-400" />
                      저녁 시간대 (16~24시)
                    </span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                      비중 {timeSlotSummary.dinnerRatio}%
                    </span>
                  </div>
                  <div className="mt-3 space-y-1">
                    <p className="text-lg font-extrabold text-white">{formatRawWon(timeSlotSummary.totalDinner)}</p>
                    <p className="text-[11px] text-slate-400">
                      영수건수: <span className="text-slate-200 font-bold">{timeSlotSummary.dinnerCount.toLocaleString()}건</span> · 평균단가: <span className="text-purple-300 font-bold">{timeSlotSummary.dinnerAvg.toLocaleString()}원</span>
                    </p>
                  </div>
                </div>

                <div className="bg-[#121622] p-4 rounded-xl border border-white/5 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                      시간대 밸런스 진단
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${timeSlotSummary.patternColor}`}>
                      {timeSlotSummary.patternType}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-300 leading-relaxed font-medium">
                    {timeSlotSummary.strategyHint}
                  </p>
                </div>
              </div>
            </div>

            {/* ----------------------------------------------------
                3. 상품 ABC 분석 & 메뉴별 매출 추이 드릴다운
                ---------------------------------------------------- */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Award className="w-5 h-5 text-yellow-400" />
                    상품 ABC 분석 & 메뉴별 매출 추이
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    왼쪽 표에서 메뉴를 클릭하면, 오른쪽에 해당 메뉴의 지금까지의 매출 및 판매량 추이 그래프가 나타납니다.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* LEFT: ABC Grade Menu Table (7 cols) */}
                <div className="lg:col-span-7 glass-card p-5 rounded-2xl flex flex-col justify-between space-y-4">
                  {/* Grade Filter Tabs & Search */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                    <div className="flex items-center bg-[#131722] p-0.5 rounded-lg border border-white/5 text-[11px]">
                      <button
                        onClick={() => setAbcGradeFilter("all")}
                        className={`px-2.5 py-1 rounded font-bold transition-all ${
                          abcGradeFilter === "all" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        전체
                      </button>
                      <button
                        onClick={() => setAbcGradeFilter("A")}
                        className={`px-2.5 py-1 rounded font-bold transition-all ${
                          abcGradeFilter === "A" ? "bg-yellow-500 text-slate-950 font-black" : "text-yellow-400 hover:text-yellow-300"
                        }`}
                      >
                        A등급 (상위 70%)
                      </button>
                      <button
                        onClick={() => setAbcGradeFilter("B")}
                        className={`px-2.5 py-1 rounded font-bold transition-all ${
                          abcGradeFilter === "B" ? "bg-slate-300 text-slate-900" : "text-slate-300 hover:text-white"
                        }`}
                      >
                        B등급 (20%)
                      </button>
                      <button
                        onClick={() => setAbcGradeFilter("C")}
                        className={`px-2.5 py-1 rounded font-bold transition-all ${
                          abcGradeFilter === "C" ? "bg-amber-800 text-amber-100" : "text-amber-400 hover:text-amber-300"
                        }`}
                      >
                        C등급 (10%)
                      </button>
                    </div>

                    {/* Search */}
                    <div className="relative w-full sm:w-44">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                      <input
                        type="text"
                        placeholder="메뉴 검색..."
                        value={abcSearchTerm}
                        onChange={(e) => setAbcSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-[#131722] border border-white/5 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
                      />
                    </div>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto max-h-[460px] custom-scrollbar">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-[#121622] z-10">
                        <tr className="border-b border-white/5 text-slate-500 font-bold">
                          <th className="py-2.5 px-2">순위</th>
                          <th className="py-2.5">등급</th>
                          <th className="py-2.5">메뉴명</th>
                          <th className="py-2.5">대분류</th>
                          <th className="py-2.5 text-right">수량</th>
                          <th className="py-2.5 text-right">실매출액</th>
                          <th className="py-2.5 text-right px-2">점유율</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAbcMenus.map((menu) => {
                          const isSelected = selectedMenuName === menu.name;
                          return (
                            <tr
                              key={menu.name}
                              onClick={() => setSelectedMenuName(menu.name)}
                              className={`border-b border-white/5 cursor-pointer hover:bg-indigo-500/10 transition-all ${
                                isSelected ? "bg-indigo-600/20 border-l-4 border-l-indigo-500 font-bold" : ""
                              }`}
                            >
                              <td className="py-2.5 px-2 font-bold text-slate-400">{menu.rank}</td>
                              <td className="py-2.5">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black ${menu.badgeStyle}`}>
                                  {menu.grade}
                                </span>
                              </td>
                              <td className="py-2.5 font-bold text-white group-hover:text-indigo-400">
                                {menu.name}
                              </td>
                              <td className="py-2.5 text-slate-400 text-[11px]">{menu.category}</td>
                              <td className="py-2.5 text-right text-slate-300 font-semibold">{menu.quantity.toLocaleString()}개</td>
                              <td className="py-2.5 text-right font-bold text-slate-200">{formatWon(menu.netSales)}</td>
                              <td className="py-2.5 text-right px-2 text-indigo-400 font-bold">
                                {menu.sharePercent.toFixed(1)}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* RIGHT: Selected Menu Trend Drilldown Panel (5 cols) */}
                <div className="lg:col-span-5 glass-card p-5 rounded-2xl flex flex-col justify-between space-y-4">
                  {selectedMenuStats ? (
                    <>
                      {/* Menu Header with Period Toggles */}
                      <div className="flex items-center justify-between border-b border-white/5 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black ${selectedMenuStats.badgeStyle}`}>
                              {selectedMenuStats.grade}등급
                            </span>
                            <span className="text-xs text-slate-400 font-medium">{selectedMenuStats.category}</span>
                          </div>
                          <h4 className="text-base font-black text-white mt-1">
                            {selectedMenuStats.name}
                          </h4>
                        </div>

                        {/* Toggle Period */}
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
                      </div>

                      {/* Mini KPI Cards for the Menu */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-[#121622] p-3 rounded-xl border border-white/5">
                          <p className="text-[10px] text-slate-400 font-semibold">누적 매출액</p>
                          <p className="text-sm font-extrabold text-white mt-0.5">{formatRawWon(selectedMenuStats.totalSales)}</p>
                        </div>
                        <div className="bg-[#121622] p-3 rounded-xl border border-white/5">
                          <p className="text-[10px] text-slate-400 font-semibold">총 판매 수량</p>
                          <p className="text-sm font-extrabold text-cyan-400 mt-0.5">{selectedMenuStats.totalQty.toLocaleString()}개</p>
                        </div>
                        <div className="bg-[#121622] p-3 rounded-xl border border-white/5">
                          <p className="text-[10px] text-slate-400 font-semibold">일평균 판매량</p>
                          <p className="text-sm font-extrabold text-indigo-300 mt-0.5">{selectedMenuStats.dailyAvgQty}개 / 일</p>
                        </div>
                        <div className="bg-[#121622] p-3 rounded-xl border border-white/5">
                          <p className="text-[10px] text-slate-400 font-semibold">매장 매출 기여도</p>
                          <p className="text-sm font-extrabold text-yellow-400 mt-0.5">{selectedMenuStats.storeShare}%</p>
                        </div>
                      </div>

                      {/* Menu Trend Chart */}
                      <div className="h-60 mt-2">
                        {menuTrendChartData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                              data={menuTrendChartData}
                              margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                              <XAxis dataKey="dateLabel" stroke="#94a3b8" fontSize={10} tickLine={false} />
                              <YAxis yAxisId="left" stroke="#94a3b8" fontSize={10} tickLine={false} />
                              <YAxis yAxisId="right" orientation="right" stroke="#06b6d4" fontSize={10} tickLine={false} />
                              <Tooltip
                                contentStyle={{ backgroundColor: "#131722", borderColor: "rgba(255,255,255,0.1)", borderRadius: "10px", fontSize: "11px" }}
                                formatter={(val, name) => {
                                  if (name === "salesManwon") return [`${val.toLocaleString()} 만원`, "매출액"];
                                  if (name === "quantity") return [`${val.toLocaleString()} 개`, "판매량"];
                                  return [val, name];
                                }}
                              />
                              <Bar yAxisId="left" dataKey="salesManwon" fill="#6366f1" radius={[4, 4, 0, 0]} />
                              <Line yAxisId="right" type="monotone" dataKey="quantity" stroke="#06b6d4" strokeWidth={2.5} dot={false} />
                            </ComposedChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center text-slate-500 text-xs">매출 추이 데이터가 없습니다.</div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
                      <Award className="w-10 h-10 mb-2 opacity-30" />
                      <p className="text-xs">왼쪽 표에서 분석할 메뉴를 선택해 주세요.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ----------------------------------------------------
                4. 매장 매출 변화 대응 AI & What-If 수익 시뮬레이터
                ---------------------------------------------------- */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* AI Consultant (7 cols) */}
              <div className="lg:col-span-7 glass-card p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-gradient-to-tr from-purple-500 to-indigo-500 p-2 rounded-xl text-white shadow-md shadow-purple-500/20">
                        <Brain className="w-5 h-5 animate-pulse" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                          올이유 AI 매장 진단 컨설턴트
                          <span className="bg-indigo-500/10 text-indigo-400 text-[8px] font-extrabold px-1.5 py-0.5 rounded border border-indigo-500/20">BETA</span>
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          지점의 시간대별 매출과 메뉴 ABC 포트폴리오를 기반으로 맞춤 영업 전략을 진단합니다.
                        </p>
                      </div>
                    </div>

                    {aiAnalysisState === "done" && (
                      <div className="flex items-center bg-[#131722] p-0.5 rounded-lg border border-white/5 text-xs">
                        <button
                          onClick={() => setAiActiveTab("report")}
                          className={`px-3 py-1 rounded font-semibold transition-all ${
                            aiActiveTab === "report" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          AI 진단서
                        </button>
                        <button
                          onClick={() => setAiActiveTab("chat")}
                          className={`px-3 py-1 rounded font-semibold transition-all flex items-center gap-1.5 ${
                            aiActiveTab === "chat" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          <Bot className="w-3.5 h-3.5" />
                          AI 챗봇
                        </button>
                      </div>
                    )}
                  </div>

                  {/* AI Body */}
                  {aiAnalysisState === "idle" && (
                    <div className="py-6 flex flex-col items-center text-center space-y-4">
                      <div className="w-14 h-14 bg-white/2 border border-white/5 rounded-full flex items-center justify-center text-indigo-400">
                        <Sparkles className="w-7 h-7 animate-pulse text-indigo-400" />
                      </div>
                      <div className="max-w-md space-y-1">
                        <h5 className="text-xs font-bold text-white">매장 데이터 종합 분석 보고서</h5>
                        <p className="text-[10px] text-slate-400">
                          버튼을 클릭하면 아침·점심/저녁 시간대 불균형 진단, A등급 효자 메뉴 분석 및 현장 프로모션 방안을 종합 도출합니다.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setAiAnalysisState("loading");
                          setAiAnalysisStep(1);
                          setTimeout(() => setAiAnalysisStep(2), 600);
                          setTimeout(() => setAiAnalysisStep(3), 1200);
                          setTimeout(() => {
                            setAiAnalysisState("done");
                            setAiActiveTab("report");
                            const storeName = storeMap[selectedStoreId] || "지점";
                            setChatMessages([{
                              sender: "ai",
                              text: `안녕하세요! **${storeName}** 전담 AI 컨설턴트입니다. 🤖\n\n현재 8월 누적 실매출액 **${formatRawWon(totalSummary.currentMonthSalesSum)}**과 시간대별 점유율(점심 ${timeSlotSummary.morningLunchRatio}% vs 저녁 ${timeSlotSummary.dinnerRatio}%)을 분석했습니다. 궁금한 점을 대화창에 편하게 질문해 주세요!`,
                              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            }]);
                          }, 1800);
                        }}
                        className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/25 flex items-center gap-1.5 active:scale-95"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        AI 종합 분석 보고서 생성
                      </button>
                    </div>
                  )}

                  {aiAnalysisState === "loading" && (
                    <div className="py-10 flex flex-col items-center space-y-3 text-center">
                      <RefreshCw className="animate-spin text-purple-400 w-7 h-7" />
                      <p className="text-xs font-bold text-white animate-pulse">
                        {aiAnalysisStep === 1 && "시간대별 영수 단가 및 결제 시각 데이터 스캔 중..."}
                        {aiAnalysisStep === 2 && "상품 ABC 점유율 및 효자 메뉴 기여도 도출 중..."}
                        {aiAnalysisStep === 3 && "최적의 타임 마케팅 및 단가 개선 처방 구성 중..."}
                      </p>
                    </div>
                  )}

                  {aiAnalysisState === "done" && aiActiveTab === "report" && (
                    <div className="bg-[#121622]/50 border border-white/5 rounded-xl p-4 text-xs text-slate-300 leading-relaxed font-sans space-y-4 max-h-[320px] overflow-y-auto custom-scrollbar whitespace-pre-line">
                      <div>
                        <span className="font-bold text-white text-xs block mb-1">📊 1. 시간대별 밸런스 및 매출 성과</span>
                        <p className="pl-3 text-slate-300">
                          • 시간대 분석: 아침+점심 비중 <span className="text-cyan-300 font-bold">{timeSlotSummary.morningLunchRatio}%</span>, 저녁 비중 <span className="text-purple-300 font-bold">{timeSlotSummary.dinnerRatio}%</span>로 <span className="text-white font-bold">{timeSlotSummary.patternType}</span> 특성을 보입니다.<br/>
                          • 당월 실매출액: <span className="text-white font-bold">{formatRawWon(totalSummary.currentMonthSalesSum)}</span> (일평균 {formatRawWon(totalSummary.dailyAvgSales)})<br/>
                          • 당월 예상치: 현재 추세 유지 시 31일 기준 <span className="text-indigo-300 font-bold">{formatRawWon(Math.round(totalSummary.currentMonthEstimatedSales))}</span> 달성 전망
                        </p>
                      </div>
                      <div className="border-t border-white/5 pt-3">
                        <span className="font-bold text-white text-xs block mb-1">🍽️ 2. 상품 ABC 등급 및 효자 메뉴</span>
                        <p className="pl-3 text-slate-300">
                          • 핵심 A등급 메뉴: <span className="text-yellow-300 font-bold">{menuAbcAnalysisData.slice(0, 3).map(m => m.name).join(", ")}</span><br/>
                          • 제언: A등급 메뉴의 매출 집중도가 높으므로 식자재 품질 일관성을 유지하고, C등급 메뉴와 결합한 실속 세트 구성을 권장합니다.
                        </p>
                      </div>
                      <div className="border-t border-white/5 pt-3">
                        <span className="font-bold text-white text-xs block mb-1">💡 3. 현장 실행 맞춤 액션 플랜</span>
                        <p className="pl-3 text-slate-300">
                          • {timeSlotSummary.strategyHint}<br/>
                          • 우측의 <b>What-If 시뮬레이터</b>를 활용하여 저녁 객단가 또는 점심 회전율 상승 시 예상 수익 변화를 실시간으로 확인하세요.
                        </p>
                      </div>
                    </div>
                  )}

                  {aiAnalysisState === "done" && aiActiveTab === "chat" && (
                    <div className="space-y-3">
                      <div className="bg-[#121622]/50 border border-white/5 rounded-xl p-3 h-48 overflow-y-auto custom-scrollbar flex flex-col space-y-3">
                        {chatMessages.map((msg, idx) => (
                          <div key={idx} className={`flex gap-2 max-w-[90%] ${msg.sender === "user" ? "self-end flex-row-reverse" : "self-start"}`}>
                            {msg.sender === "ai" && (
                              <div className="w-6 h-6 bg-gradient-to-tr from-purple-500 to-indigo-500 rounded-lg flex items-center justify-center text-white flex-shrink-0">
                                <Bot className="w-3.5 h-3.5" />
                              </div>
                            )}
                            <div className={`p-2.5 rounded-xl text-xs whitespace-pre-line ${
                              msg.sender === "user" ? "bg-indigo-600 text-white" : "bg-[#161a26] text-slate-200 border border-white/5"
                            }`}>
                              {msg.text}
                            </div>
                          </div>
                        ))}
                      </div>

                      <form 
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!chatInput.trim()) return;
                          const q = chatInput;
                          setChatInput("");
                          setChatMessages(prev => [...prev, { sender: "user", text: q, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
                          setTimeout(() => {
                            const storeName = storeMap[selectedStoreId] || "지점";
                            const response = generateAIChatResponse(q, storeName, totalSummary, menuAbcAnalysisData, []);
                            setChatMessages(prev => [...prev, { sender: "ai", text: response, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
                          }, 500);
                        }}
                        className="flex gap-2"
                      >
                        <input
                          type="text"
                          placeholder="매출, 시간대, 인기 메뉴, 프로모션 질문을 입력하세요..."
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          className="flex-1 px-3 py-2 bg-[#121622] border border-white/5 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500/50"
                        />
                        <button
                          type="submit"
                          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                        >
                          <Send className="w-3 h-3" />
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </div>

              {/* What-If Strategy Simulator (5 cols) */}
              <div className="lg:col-span-5 glass-card p-6 rounded-2xl flex flex-col justify-between space-y-4 border-l-4 border-l-purple-500">
                <div>
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-purple-400" />
                      What-If 수익 및 매출 시뮬레이터
                    </h4>
                    <span className="text-[10px] text-purple-300 font-bold bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                      실시간 계산
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 mt-2">
                    남은 8월 영업일({whatIfSimulation?.remainDays}일) 동안 가격 인상이나 점심 회전율 상승 시 예상 수익 변화를 시뮬레이션합니다.
                  </p>

                  <div className="space-y-4 mt-4">
                    {/* Slider 1: 저녁 테이블 단가 인상/인하 */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300 font-semibold">저녁 테이블 객단가 변화</span>
                        <span className={`font-black ${whatIfTicketDelta > 0 ? "text-emerald-400" : whatIfTicketDelta < 0 ? "text-rose-400" : "text-slate-400"}`}>
                          {whatIfTicketDelta > 0 ? `+${whatIfTicketDelta.toLocaleString()}원` : `${whatIfTicketDelta.toLocaleString()}원`}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-5000"
                        max="10000"
                        step="1000"
                        value={whatIfTicketDelta}
                        onChange={(e) => setWhatIfTicketDelta(Number(e.target.value))}
                        className="w-full accent-purple-500 cursor-pointer"
                      />
                      <div className="flex justify-between text-[9px] text-slate-500">
                        <span>-5,000원</span>
                        <span>0원 (현재)</span>
                        <span>+10,000원</span>
                      </div>
                    </div>

                    {/* Slider 2: 점심 테이블 회전수 / 주문수 변화 */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300 font-semibold">점심 주문건수(회전율) 변화</span>
                        <span className={`font-black ${whatIfLunchTurnDelta > 0 ? "text-cyan-400" : whatIfLunchTurnDelta < 0 ? "text-rose-400" : "text-slate-400"}`}>
                          {whatIfLunchTurnDelta > 0 ? `+${whatIfLunchTurnDelta}%` : `${whatIfLunchTurnDelta}%`}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-20"
                        max="30"
                        step="5"
                        value={whatIfLunchTurnDelta}
                        onChange={(e) => setWhatIfLunchTurnDelta(Number(e.target.value))}
                        className="w-full accent-cyan-500 cursor-pointer"
                      />
                      <div className="flex justify-between text-[9px] text-slate-500">
                        <span>-20%</span>
                        <span>0% (현재)</span>
                        <span>+30%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Simulation Result Box */}
                {whatIfSimulation && (
                  <div className="bg-[#121622] p-4 rounded-xl border border-white/5 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">전략 적용 후 8월 예상 매출</span>
                      <span className="text-base font-black text-white">
                        {formatRawWon(Math.round(whatIfSimulation.newEstSales))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">추가 예상 매출 증감</span>
                      <span className={`font-black flex items-center gap-0.5 ${whatIfSimulation.totalRevenueGain >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {whatIfSimulation.totalRevenueGain >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                        {whatIfSimulation.totalRevenueGain >= 0 ? `+${formatRawWon(Math.round(whatIfSimulation.totalRevenueGain))}` : formatRawWon(Math.round(whatIfSimulation.totalRevenueGain))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs border-t border-white/5 pt-2">
                      <span className="text-purple-300 font-bold">추가 영업이익 전망 (마진 45%)</span>
                      <span className={`font-black ${whatIfSimulation.estProfitGain >= 0 ? "text-purple-300" : "text-rose-400"}`}>
                        {whatIfSimulation.estProfitGain >= 0 ? `+${formatRawWon(whatIfSimulation.estProfitGain)}` : formatRawWon(whatIfSimulation.estProfitGain)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------
            TAB 3: EXCEL BULK UPLOAD TAB
            ---------------------------------------------------- */}
        {globalTab === "upload" && (
          <div className="space-y-6">
            <div className="glass-card p-6 rounded-2xl">
              <h3 className="text-base font-bold text-white flex items-center gap-2 mb-2">
                <Upload className="w-5 h-5 text-indigo-400" />
                OKPOS 엑셀 파일 스마트 업로드
              </h3>
              <p className="text-xs text-slate-400 mb-6">
                시간대별 매출 리포트, 상품 ABC 분석 리포트, 일자별 매출 엑셀 파일을 드래그하여 업로드하면 자동으로 포맷을 감지하여 분석 데이터베이스에 반영합니다.
              </p>

              {/* Drag & Drop Area */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                  dragActive
                    ? "border-indigo-500 bg-indigo-500/10 scale-[0.99]"
                    : "border-white/10 hover:border-indigo-500/40 bg-white/2"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".xlsx, .xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="w-16 h-16 mx-auto mb-4 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                  <Upload className="w-8 h-8" />
                </div>
                <h4 className="text-sm font-bold text-white mb-1">
                  엑셀 파일을 이곳에 끌어다 놓거나 클릭하여 선택하세요
                </h4>
                <p className="text-xs text-slate-500">
                  지원 형식: <span className="text-indigo-400 font-bold">일기간 (시간대별)</span> · <span className="text-yellow-400 font-bold">상품ABC분석</span> · 일자별 상품매출 (.xlsx, .xls)
                </p>
              </div>

              {/* Utility actions */}
              <div className="flex flex-wrap items-center justify-between gap-4 mt-6 pt-6 border-t border-white/5">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRestoreDemoData}
                    className="px-3.5 py-2 bg-[#131722] hover:bg-white/10 text-slate-300 rounded-xl text-xs font-bold transition-all border border-white/5 flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                    기본 데모 데이터 복구
                  </button>
                </div>
              </div>
            </div>

            {/* Upload History Table */}
            <div className="glass-card p-6 rounded-2xl">
              <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                업로드 히스토리 ({uploadLogs.length}건)
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/5 text-slate-500">
                      <th className="py-2.5 font-semibold">파일명</th>
                      <th className="py-2.5 font-semibold">지점명</th>
                      <th className="py-2.5 font-semibold">데이터 기간</th>
                      <th className="py-2.5 font-semibold text-right">행 수</th>
                      <th className="py-2.5 font-semibold text-center">상태</th>
                      <th className="py-2.5 font-semibold text-right">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadLogs.map((log) => (
                      <tr key={log.id} className="border-b border-white/5 hover:bg-white/2">
                        <td className="py-2.5 font-bold text-white">{log.fileName}</td>
                        <td className="py-2.5 text-indigo-400 font-semibold">{log.storeName}</td>
                        <td className="py-2.5 text-slate-400">{log.period}</td>
                        <td className="py-2.5 text-right text-slate-300 font-bold">{log.rowCount.toLocaleString()}행</td>
                        <td className="py-2.5 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {log.status}
                          </span>
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            onClick={() => handleRollbackUpload(log)}
                            className="p-1 hover:text-rose-400 text-slate-500 transition-colors"
                            title="데이터 삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ----------------------------------------------------
          UPLOAD CONFIRMATION PREVIEW MODAL
          ---------------------------------------------------- */}
      {pendingUploadPackage && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-xl p-6 rounded-2xl border border-white/10 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                업로드 데이터 확인 및 매장 매칭
              </h3>
              <button
                onClick={() => setPendingUploadPackage(null)}
                className="text-slate-500 hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar">
              {pendingUploadPackage.files.map((file, idx) => (
                <div key={idx} className="bg-[#121622] p-4 rounded-xl border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white truncate max-w-xs">{file.name}</span>
                    <span className="text-xs font-bold text-indigo-400">{formatRawWon(file.totalSales)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>데이터 기간: <b className="text-slate-200">{file.period}</b></span>
                    <span>데이터 행수: <b className="text-slate-200">{file.rowCount}행</b></span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setPendingUploadPackage(null)}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl text-xs font-bold transition-all"
              >
                취소
              </button>
              <button
                onClick={handleApplyUploadPackage}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                데이터베이스 반영 완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          STORE ADD / EDIT MODAL
          ---------------------------------------------------- */}
      {isStoreModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md p-6 rounded-2xl border border-white/10 space-y-5">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-base font-black text-white">
                {editingStore ? "지점 정보 수정" : "신규 지점 추가"}
              </h3>
              <button onClick={() => setIsStoreModalOpen(false)} className="text-slate-500 hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400">지점명</label>
                <input
                  type="text"
                  placeholder="예: 금막창 종로점"
                  value={storeNameInput}
                  onChange={(e) => setStoreNameInput(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#121622] border border-white/5 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400">업종 카테고리</label>
                <input
                  type="text"
                  placeholder="예: 막창 전문점"
                  value={storeCatInput}
                  onChange={(e) => setStoreCatInput(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#121622] border border-white/5 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500/50"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsStoreModalOpen(false)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl text-xs font-bold"
              >
                취소
              </button>
              <button
                onClick={handleSaveStore}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/30"
              >
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
