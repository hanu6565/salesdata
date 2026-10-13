// mockData.js
// Dynamically generates realistic OKPOS sales data and Time-Slot / ABC analysis for 7 F&B franchise stores
// Dates: 2026-06-01 to 2026-08-26 (current time in metadata is Aug 26, 2026)

export const INITIAL_STORES = [
  { id: "store-1", name: "포크팬 복현", category: "고기 무한리필", posSite: "NICE OKPOS", posStoreCode: "PP_BOKHYEON_01", aliases: ["포크팬 복현", "포크팬", "복현점", "PP_BOKHYEON_01"] },
  { id: "store-2", name: "고기9단", category: "소고기 전문점", posSite: "OKASP OKPOS", posStoreCode: "GOGI_9DAN_01", aliases: ["고기9단", "고기구단", "GOGI_9DAN_01"] },
  { id: "store-3", name: "들안길금등어 본점(들안길)", category: "화덕 고등어구이", posSite: "EasyPOS", posStoreCode: "EASY_GEUMD_01", aliases: ["들안길금등어", "들안길", "금등어", "EASY_GEUMD_01"] },
  { id: "store-4", name: "신영웅청국장해물뚝배기 성서점", category: "한식 전문점", posSite: "NICE OKPOS", posStoreCode: "N34995", aliases: ["신영웅청국장해물뚝배기 성서점", "신영웅성서", "신영웅 성서", "신영웅청국장", "신영웅", "N34995", "SYW_SEONGSEO_01"] },
  { id: "store-5", name: "금막창 종로", category: "막창 전문점", posSite: "OKASP OKPOS", posStoreCode: "GMC_JONGRO_01", aliases: ["금막창 종로", "금막창종로", "종로점", "GMC_JONGRO_01"] },
  { id: "store-6", name: "금막창 월성", category: "막창 전문점", posSite: "OKASP OKPOS", posStoreCode: "GMC_WOLSEONG_01", aliases: ["금막창 월성", "금막창월성", "월성점", "GMC_WOLSEONG_01"] },
  { id: "store-7", name: "금막창 범어점", category: "막창 전문점", posSite: "NICE OKPOS", posStoreCode: "GMC_BEOMEO_01", aliases: ["금막창 범어점", "금막창 범어", "금막창범어", "범어점", "GMC_BEOMEO_01"] },
];

const MENUS_FORK = [
  { name: "삼겹살 무한리필", code: "P001", cat: "메인메뉴", price: 24900, share: 0.52, timeSlot: "dinner" },
  { name: "우삼겹 단품", code: "P002", cat: "메인메뉴", price: 15000, share: 0.16, timeSlot: "dinner" },
  { name: "수제 물냉면", code: "P003", cat: "사이드", price: 7000, share: 0.09, timeSlot: "lunch" },
  { name: "차돌박이 된장찌개", code: "P004", cat: "사이드", price: 5000, share: 0.07, timeSlot: "lunch" },
  { name: "참이슬 소주", code: "P005", cat: "주류", price: 5000, share: 0.11, timeSlot: "dinner" },
  { name: "테라 맥주", code: "P006", cat: "주류", price: 5000, share: 0.03, timeSlot: "dinner" },
  { name: "코카콜라", code: "P007", cat: "음료", price: 2000, share: 0.02, timeSlot: "lunch" },
];

const MENUS_GOGI9 = [
  { name: "9단 꽃갈비살(200g)", code: "G001", cat: "메인메뉴", price: 32000, share: 0.46, timeSlot: "dinner" },
  { name: "특선 안창살(200g)", code: "G002", cat: "메인메뉴", price: 35000, share: 0.20, timeSlot: "dinner" },
  { name: "한우 육회(150g)", code: "G003", cat: "메인메뉴", price: 25000, share: 0.12, timeSlot: "dinner" },
  { name: "한우 된장찌개(점심특선)", code: "G004", cat: "식사류", price: 8000, share: 0.08, timeSlot: "lunch" },
  { name: "평양식 물냉면(점심특선)", code: "G005", cat: "식사류", price: 9000, share: 0.05, timeSlot: "lunch" },
  { name: "화요 25도", code: "G006", cat: "주류", price: 25000, share: 0.06, timeSlot: "dinner" },
  { name: "클라우드 맥주", code: "G007", cat: "주류", price: 6000, share: 0.03, timeSlot: "dinner" },
];

const MENUS_GEUMD = [
  { name: "화덕 고등어구이 정식", code: "M001", cat: "정식류", price: 14000, share: 0.54, timeSlot: "lunch" },
  { name: "직화 제육볶음 정식", code: "M002", cat: "정식류", price: 13000, share: 0.22, timeSlot: "lunch" },
  { name: "화덕 삼치구이 정식", code: "M003", cat: "정식류", price: 16000, share: 0.11, timeSlot: "lunch" },
  { name: "수제 감자전", code: "M004", cat: "사이드", price: 10000, share: 0.05, timeSlot: "dinner" },
  { name: "경주법주 쌀막걸리", code: "M005", cat: "주류", price: 4000, share: 0.06, timeSlot: "dinner" },
  { name: "사이다", code: "M006", cat: "음료", price: 2000, share: 0.02, timeSlot: "lunch" },
];

const MENUS_SYW = [
  { name: "영웅 청국장 정식", code: "H001", cat: "찌개류", price: 10000, share: 0.42, timeSlot: "lunch" },
  { name: "해물 뚝배기", code: "H002", cat: "찌개류", price: 12000, share: 0.28, timeSlot: "lunch" },
  { name: "뚝배기 제육볶음", code: "H003", cat: "단품요리", price: 9000, share: 0.14, timeSlot: "lunch" },
  { name: "해물 파전", code: "H004", cat: "단품요리", price: 15000, share: 0.08, timeSlot: "dinner" },
  { name: "지평 생막걸리", code: "H005", cat: "주류", price: 4000, share: 0.06, timeSlot: "dinner" },
  { name: "콜라", code: "H006", cat: "음료", price: 2000, share: 0.02, timeSlot: "lunch" },
];

const MENUS_GMC = [
  { name: "바삭 돼지막창(150g)", code: "K001", cat: "막창류", price: 12000, share: 0.49, timeSlot: "dinner" },
  { name: "쫄깃 소막창(150g)", code: "K002", cat: "막창류", price: 15000, share: 0.18, timeSlot: "dinner" },
  { name: "직화 불막창(150g)", code: "K003", cat: "막창류", price: 13000, share: 0.12, timeSlot: "dinner" },
  { name: "날치알 주먹밥", code: "K004", cat: "식사류", price: 4000, share: 0.08, timeSlot: "dinner" },
  { name: "얼큰 김치말이국수", code: "K005", cat: "식사류", price: 6000, share: 0.06, timeSlot: "dinner" },
  { name: "참이슬", code: "K006", cat: "주류", price: 5000, share: 0.05, timeSlot: "dinner" },
  { name: "테라", code: "K007", cat: "주류", price: 5000, share: 0.02, timeSlot: "dinner" },
];

export const STORE_MENUS = {
  "포크팬": MENUS_FORK,
  "포크팬 복현": MENUS_FORK,
  "고기9단": MENUS_GOGI9,
  "금등어": MENUS_GEUMD,
  "들안길금등어 본점(들안길)": MENUS_GEUMD,
  "신영웅청국장해물뚝배기": MENUS_SYW,
  "신영웅청국장해물뚝배기 성서점": MENUS_SYW,
  "금막창 종로": MENUS_GMC,
  "금막창 종로점": MENUS_GMC,
  "금막창 월성": MENUS_GMC,
  "금막창 월성점": MENUS_GMC,
  "금막창 범어점": MENUS_GMC,
};

export const STORE_BASE_SALES = {
  "포크팬": 3500000,
  "포크팬 복현": 3500000,
  "고기9단": 4200000,
  "금등어": 2500000,
  "들안길금등어 본점(들안길)": 2500000,
  "신영웅청국장해물뚝배기": 1800000,
  "신영웅청국장해물뚝배기 성서점": 1800000,
  "금막창 종로": 2800000,
  "금막창 종로점": 2800000,
  "금막창 월성": 2400000,
  "금막창 월성점": 2400000,
  "금막창 범어점": 2100000,
};

export const STORE_TIME_PROFILES = {
  "포크팬": { morningRatio: 0.01, lunchRatio: 0.25, dinnerRatio: 0.74, avgTicket: 48000 },
  "포크팬 복현": { morningRatio: 0.01, lunchRatio: 0.25, dinnerRatio: 0.74, avgTicket: 48000 },
  "고기9단": { morningRatio: 0.02, lunchRatio: 0.28, dinnerRatio: 0.70, avgTicket: 58000 },
  "금등어": { morningRatio: 0.04, lunchRatio: 0.68, dinnerRatio: 0.28, avgTicket: 34000 },
  "들안길금등어 본점(들안길)": { morningRatio: 0.04, lunchRatio: 0.68, dinnerRatio: 0.28, avgTicket: 34000 },
  "신영웅청국장해물뚝배기": { morningRatio: 0.05, lunchRatio: 0.70, dinnerRatio: 0.25, avgTicket: 26000 },
  "신영웅청국장해물뚝배기 성서점": { morningRatio: 0.05, lunchRatio: 0.70, dinnerRatio: 0.25, avgTicket: 26000 },
  "금막창 종로": { morningRatio: 0.01, lunchRatio: 0.18, dinnerRatio: 0.81, avgTicket: 44000 },
  "금막창 종로점": { morningRatio: 0.01, lunchRatio: 0.18, dinnerRatio: 0.81, avgTicket: 44000 },
  "금막창 월성": { morningRatio: 0.01, lunchRatio: 0.20, dinnerRatio: 0.79, avgTicket: 42000 },
  "금막창 월성점": { morningRatio: 0.01, lunchRatio: 0.20, dinnerRatio: 0.79, avgTicket: 42000 },
  "금막창 범어점": { morningRatio: 0.01, lunchRatio: 0.20, dinnerRatio: 0.79, avgTicket: 43000 },
};

// Generates all dates between startDate and endDate in YYYY-MM-DD
function getDatesInRange(startDate, endDate) {
  const dates = [];
  let curr = new Date(startDate);
  const end = new Date(endDate);
  while (curr <= end) {
    dates.push(curr.toISOString().split("T")[0]);
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

export function generateMockSalesData() {
  const dates = getDatesInRange("2026-06-01", "2026-08-26");
  const salesRecords = [];
  const uploadLogs = [];

  // Generate initial uploads logs
  const months = ["2026-06", "2026-07", "2026-08"];
  
  INITIAL_STORES.forEach((store) => {
    months.forEach((month) => {
      const storeName = store.name;
      const menus = STORE_MENUS[storeName] || STORE_MENUS["금막창 범어점"];
      
      let dayCount = 30;
      if (month === "2026-07") dayCount = 31;
      if (month === "2026-08") dayCount = 26;
      
      const uploadTime = new Date(`2026-${month.split("-")[1]}-26T10:00:00Z`);
      const rowCount = dayCount * menus.length;
      
      uploadLogs.push({
        id: `upload-${store.id}-${month}`,
        storeId: store.id,
        storeName: store.name,
        fileName: `${store.name}_${month.replace("-", "년 ")}월_일자별_매출.xlsx`,
        period: month,
        rowCount: rowCount,
        uploadTime: uploadTime.toISOString(),
        status: "정상 완료",
      });
    });
  });

  // Generate actual sales details with time slots
  dates.forEach((dateStr) => {
    const dateObj = new Date(dateStr);
    const dayOfWeek = dateObj.getDay(); // 0: Sun, 6: Sat
    const yearMonth = dateStr.substring(0, 7); // YYYY-MM
    
    // Weekday multipliers
    let dayMultiplier = 1.0;
    if (dayOfWeek === 5) dayMultiplier = 1.3; // Fri
    else if (dayOfWeek === 6) dayMultiplier = 1.5; // Sat
    else if (dayOfWeek === 0) dayMultiplier = 1.4; // Sun
    else if (dayOfWeek === 1) dayMultiplier = 0.8; // Mon
    
    // Seasonal multiplier
    let monthMultiplier = 1.0;
    if (yearMonth === "2026-07") monthMultiplier = 1.15;
    if (yearMonth === "2026-08") monthMultiplier = 1.08;

    INITIAL_STORES.forEach((store) => {
      const storeName = store.name;
      const menus = STORE_MENUS[storeName] || STORE_MENUS["금막창 범어점"];
      const baseDailySales = STORE_BASE_SALES[storeName] || 2000000;
      
      const randomFactor = 0.92 + Math.random() * 0.16;
      const targetDailySales = baseDailySales * dayMultiplier * monthMultiplier * randomFactor;
      
      menus.forEach((menu) => {
        const menuTargetSales = targetDailySales * menu.share;
        let qty = Math.round(menuTargetSales / menu.price);
        if (qty < 1) qty = 1;
        
        const totalSales = qty * menu.price;
        const discountRate = menu.cat === "메인메뉴" || menu.cat === "정식류" ? (Math.random() > 0.6 ? 0.05 : 0.02) : 0;
        const discountAmount = Math.round(totalSales * discountRate);
        const netSales = totalSales - discountAmount;

        salesRecords.push({
          date: dateStr,
          storeId: store.id,
          storeName: store.name,
          category: menu.cat,
          itemCode: menu.code,
          itemName: menu.name,
          quantity: qty,
          totalSales: totalSales,
          discount: discountAmount,
          netSales: netSales,
          timeSlot: menu.timeSlot || "dinner"
        });
      });
    });
  });

  return { salesRecords, uploadLogs };
}
