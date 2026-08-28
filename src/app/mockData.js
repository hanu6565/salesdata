// mockData.js
// Dynamically generates realistic OKPOS sales data for the 7 initial F&B franchise stores
// Dates: 2026-06-01 to 2026-08-26 (current time in metadata is Aug 26, 2026)

export const INITIAL_STORES = [
  { id: "store-1", name: "포크팬", category: "고기 무한리필" },
  { id: "store-2", name: "고기9단", category: "소고기 전문점" },
  { id: "store-3", name: "금등어", category: "화덕 고등어구이" },
  { id: "store-4", name: "신영웅청국장해물뚝배기", category: "한식 전문점" },
  { id: "store-5", name: "금막창 종로점", category: "막창 전문점" },
  { id: "store-6", name: "금막창 월성점", category: "막창 전문점" },
  { id: "store-7", name: "금막창 범어점", category: "막창 전문점" },
];

const STORE_MENUS = {
  "포크팬": [
    { name: "삼겹살 무한리필", code: "P001", cat: "메인메뉴", price: 24900, share: 0.50 },
    { name: "우삼겹 단품", code: "P002", cat: "메인메뉴", price: 15000, share: 0.15 },
    { name: "수제 물냉면", code: "P003", cat: "사이드", price: 7000, share: 0.10 },
    { name: "차돌박이 된장찌개", code: "P004", cat: "사이드", price: 5000, share: 0.08 },
    { name: "참이슬 소주", code: "P005", cat: "주류", price: 5000, share: 0.12 },
    { name: "테라 맥주", code: "P006", cat: "주류", price: 5000, share: 0.03 },
    { name: "코카콜라", code: "P007", cat: "음료", price: 2000, share: 0.02 },
  ],
  "고기9단": [
    { name: "9단 꽃갈비살(200g)", code: "G001", cat: "메인메뉴", price: 32000, share: 0.45 },
    { name: "특선 안창살(200g)", code: "G002", cat: "메인메뉴", price: 35000, share: 0.20 },
    { name: "한우 육회(150g)", code: "G003", cat: "메인메뉴", price: 25000, share: 0.12 },
    { name: "한우 된장찌개", code: "G004", cat: "식사류", price: 8000, share: 0.08 },
    { name: "평양식 물냉면", code: "G005", cat: "식사류", price: 9000, share: 0.05 },
    { name: "화요 25도", code: "G006", cat: "주류", price: 25000, share: 0.06 },
    { name: "클라우드 맥주", code: "G007", cat: "주류", price: 6000, share: 0.04 },
  ],
  "금등어": [
    { name: "화덕 고등어구이 정식", code: "M001", cat: "정식류", price: 14000, share: 0.55 },
    { name: "직화 제육볶음 정식", code: "M002", cat: "정식류", price: 13000, share: 0.22 },
    { name: "화덕 삼치구이 정식", code: "M003", cat: "정식류", price: 16000, share: 0.10 },
    { name: "수제 감자전", code: "M004", cat: "사이드", price: 10000, share: 0.05 },
    { name: "경주법주 쌀막걸리", code: "M005", cat: "주류", price: 4000, share: 0.06 },
    { name: "사이다", code: "M006", cat: "음료", price: 2000, share: 0.02 },
  ],
  "신영웅청국장해물뚝배기": [
    { name: "영웅 청국장 정식", code: "H001", cat: "찌개류", price: 10000, share: 0.40 },
    { name: "해물 뚝배기", code: "H002", cat: "찌개류", price: 12000, share: 0.30 },
    { name: "뚝배기 제육볶음", code: "H003", cat: "단품요리", price: 9000, share: 0.15 },
    { name: "해물 파전", code: "H004", cat: "단품요리", price: 15000, share: 0.08 },
    { name: "지평 생막걸리", code: "H005", cat: "주류", price: 4000, share: 0.05 },
    { name: "콜라", code: "H006", cat: "음료", price: 2000, share: 0.02 },
  ],
  "금막창 종로점": [
    { name: "바삭 돼지막창(150g)", code: "K001", cat: "막창류", price: 12000, share: 0.48 },
    { name: "쫄깃 소막창(150g)", code: "K002", cat: "막창류", price: 15000, share: 0.18 },
    { name: "직화 불막창(150g)", code: "K003", cat: "막창류", price: 13000, share: 0.12 },
    { name: "날치알 주먹밥", code: "K004", cat: "식사류", price: 4000, share: 0.08 },
    { name: "얼큰 김치말이국수", code: "K005", cat: "식사류", price: 6000, share: 0.06 },
    { name: "참이슬", code: "K006", cat: "주류", price: 5000, share: 0.06 },
    { name: "테라", code: "K007", cat: "주류", price: 5000, share: 0.02 },
  ],
  "금막창 월성점": [
    { name: "바삭 돼지막창(150g)", code: "K001", cat: "막창류", price: 12000, share: 0.50 },
    { name: "쫄깃 소막창(150g)", code: "K002", cat: "막창류", price: 15000, share: 0.16 },
    { name: "직화 불막창(150g)", code: "K003", cat: "막창류", price: 13000, share: 0.10 },
    { name: "날치알 주먹밥", code: "K004", cat: "식사류", price: 4000, share: 0.10 },
    { name: "얼큰 김치말이국수", code: "K005", cat: "식사류", price: 6000, share: 0.05 },
    { name: "참이슬", code: "K006", cat: "주류", price: 5000, share: 0.07 },
    { name: "테라", code: "K007", cat: "주류", price: 5000, share: 0.02 },
  ],
  "금막창 범어점": [
    { name: "바삭 돼지막창(150g)", code: "K001", cat: "막창류", price: 12000, share: 0.45 },
    { name: "쫄깃 소막창(150g)", code: "K002", cat: "막창류", price: 15000, share: 0.20 },
    { name: "직화 불막창(150g)", code: "K003", cat: "막창류", price: 13000, share: 0.11 },
    { name: "날치알 주먹밥", code: "K004", cat: "식사류", price: 4000, share: 0.09 },
    { name: "얼큰 김치말이국수", code: "K005", cat: "식사류", price: 6000, share: 0.07 },
    { name: "참이슬", code: "K006", cat: "주류", price: 5000, share: 0.06 },
    { name: "테라", code: "K007", cat: "주류", price: 5000, share: 0.02 },
  ],
};

const STORE_BASE_SALES = {
  "포크팬": 3500000,
  "고기9단": 4200000,
  "금등어": 2500000,
  "신영웅청국장해물뚝배기": 1800000,
  "금막창 종로점": 2800000,
  "금막창 월성점": 2400000,
  "금막창 범어점": 2100000,
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
      // Calculate row count and period
      const storeName = store.name;
      const baseSales = STORE_BASE_SALES[storeName] || 2000000;
      const menus = STORE_MENUS[storeName] || STORE_MENUS["금막창 범어점"];
      
      // Determine day count for this month in mock data
      let dayCount = 30;
      if (month === "2026-07") dayCount = 31;
      if (month === "2026-08") dayCount = 26; // up to current date
      
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

  // Generate actual sales details
  dates.forEach((dateStr) => {
    const dateObj = new Date(dateStr);
    const dayOfWeek = dateObj.getDay(); // 0: Sunday, 6: Saturday
    const yearMonth = dateStr.substring(0, 7); // YYYY-MM
    
    // Weekday multipliers
    let dayMultiplier = 1.0;
    if (dayOfWeek === 5) dayMultiplier = 1.3; // Fri
    else if (dayOfWeek === 6) dayMultiplier = 1.5; // Sat
    else if (dayOfWeek === 0) dayMultiplier = 1.4; // Sun
    else if (dayOfWeek === 1) dayMultiplier = 0.8; // Mon (slowest)
    
    // Seasonal multiplier (July is busy, June is normal, August is slightly higher)
    let monthMultiplier = 1.0;
    if (yearMonth === "2026-07") monthMultiplier = 1.15;
    if (yearMonth === "2026-08") monthMultiplier = 1.08;

    INITIAL_STORES.forEach((store) => {
      const storeName = store.name;
      const menus = STORE_MENUS[storeName] || STORE_MENUS["금막창 범어점"];
      const baseDailySales = STORE_BASE_SALES[storeName] || 2000000;
      
      // Random variation +/- 10%
      const randomFactor = 0.9 + Math.random() * 0.2;
      const targetDailySales = baseDailySales * dayMultiplier * monthMultiplier * randomFactor;
      
      menus.forEach((menu) => {
        // Target sales for this menu
        const menuTargetSales = targetDailySales * menu.share;
        // Estimate quantity
        let qty = Math.round(menuTargetSales / menu.price);
        if (qty < 1) qty = 1;
        
        const totalSales = qty * menu.price;
        // Discount is around 2-5% randomly, only for main menus
        const discountRate = menu.cat === "메인메뉴" || menu.cat === "정식류" ? (Math.random() > 0.6 ? 0.05 : 0.02) : 0;
        const discountAmount = Math.round(totalSales * discountRate);
        const netSales = totalSales - discountAmount;

        salesRecords.push({
          date: dateStr, // YYYY-MM-DD
          storeId: store.id,
          storeName: store.name,
          category: menu.cat,
          itemCode: menu.code,
          itemName: menu.name,
          quantity: qty,
          totalSales: totalSales,
          discount: discountAmount,
          netSales: netSales,
        });
      });
    });
  });

  return { salesRecords, uploadLogs };
}
