// excelParser.js
import * as XLSX from "xlsx";
import { matchStoreFromFileName, STORES_MASTER } from "../lib/storesConfig.js";

/**
 * Extracts store name and period (YYYY-MM or YYYY-MM-DD ~ YYYY-MM-DD) from a filename.
 * E.g., "신영웅성서_2026-10-01_2026-10-11_메뉴매출.xls" -> 
 *   { storeId: "store-4", storeName: "신영웅청국장해물뚝배기 성서점", period: "2026-10-01 ~ 2026-10-11", matchReason: "매장 별칭(신영웅성서) 일치", isAmbiguous: false }
 */
export function parseFileNameInfo(fileName, existingStores = STORES_MASTER) {
  const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf(".")) || fileName;

  // 1. Detect Date Range or Year-Month from filename
  let period = null;
  let startDate = null;
  let endDate = null;

  // Pattern A: Range like 2026-10-01_2026-10-11 or 2026.10.01~2026.10.11
  const rangeMatch = nameWithoutExt.match(/(\d{4}[-_.]\d{1,2}[-_.]\d{1,2})\s*[-~_]\s*(\d{4}[-_.]\d{1,2}[-_.]\d{1,2})/);
  if (rangeMatch) {
    startDate = parseDateString(rangeMatch[1]);
    endDate = parseDateString(rangeMatch[2]);
    if (startDate && endDate) {
      period = `${startDate} ~ ${endDate}`;
    }
  }

  // Pattern B: Month level like 2026-10, 26년 10월, 2026.10
  if (!period) {
    const dateRegexes = [
      /(\d{2,4})\s*년\s*(\d{1,2})\s*월/,       // E.g. "24년 11월", "2024년 11월"
      /(\d{4})[-_](\d{1,2})(?:[-_](\d{1,2}))?/, // E.g. "2026-10" or "2026-10-01"
      /(\d{2,4})\s*\.\s*(\d{1,2})/,           // E.g. "24.11", "2024. 11"
      /(\d{2,4})\s+(\d{1,2})/                 // E.g. "24 11", "2024 11"
    ];

    let dateMatch = null;
    for (const regex of dateRegexes) {
      const match = nameWithoutExt.match(regex);
      if (match) {
        const mVal = parseInt(match[2], 10);
        if (mVal >= 1 && mVal <= 12) {
          dateMatch = match;
          break;
        }
      }
    }

    if (dateMatch) {
      let rawYear = dateMatch[1];
      let rawMonth = dateMatch[2];
      
      let year = rawYear.length === 2 ? "20" + rawYear : rawYear;
      let month = rawMonth.padStart(2, "0");
      period = `${year}-${month}`;
    } else {
      const now = new Date();
      period = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;
    }
  }

  // 2. High-precision Store Matching
  const matchResult = matchStoreFromFileName(fileName, existingStores);
  const matchedStore = matchResult.store;

  let storeId = matchedStore ? matchedStore.id : null;
  let storeName = matchedStore ? matchedStore.name : "미지정 (선택 필요)";
  let matchReason = matchResult.matchReason;
  let isAmbiguous = !matchedStore;

  return {
    storeId,
    storeName,
    period,
    startDate,
    endDate,
    matchReason,
    isAmbiguous
  };
}

/**
 * Robust date parser supporting Excel numeric serials, formatted strings, and JS Dates.
 * Avoids UTC timezone conversion shifts.
 */
export function parseDateCell(val, cellFormatted) {
  if (cellFormatted && typeof cellFormatted === "string") {
    const s = cellFormatted.trim();
    const parsed = parseDateString(s);
    if (parsed) return parsed;
  }

  if (typeof val === "number" && val > 30000 && val < 60000) {
    try {
      const dc = XLSX.SSF.parse_date_code(val);
      if (dc && dc.y) {
        return `${dc.y}-${String(dc.m).padStart(2, "0")}-${String(dc.d).padStart(2, "0")}`;
      }
    } catch (e) {}
  }

  if (val instanceof Date) {
    try {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, "0");
      const d = String(val.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    } catch (e) {
      return null;
    }
  }

  return parseDateString(val);
}

// Utility to parse dates in different text formats
export function parseDateString(val) {
  if (val instanceof Date) {
    try {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, "0");
      const d = String(val.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    } catch (e) {
      return null;
    }
  }
  
  let str = String(val || "").trim();
  if (!str) return null;

  const timeIndex = str.search(/\s+\d{1,2}:\d{2}/);
  if (timeIndex !== -1) {
    str = str.substring(0, timeIndex).trim();
  }

  // Pattern 1: YYYY-MM-DD or YYYY/MM/DD
  const m1 = str.match(/^(\d{2,4})[-/](\d{1,2})[-/](\d{1,2})(?:\s*\([^)]+\))?$/);
  if (m1) {
    let year = m1[1];
    if (year.length === 2) year = "20" + year;
    return `${year}-${m1[2].padStart(2, "0")}-${m1[3].padStart(2, "0")}`;
  }

  // Pattern 2: YYYY.MM.DD
  const m2 = str.match(/^(\d{2,4})\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})\s*\.?(?:\s*\([^)]+\))?$/);
  if (m2) {
    let year = m2[1];
    if (year.length === 2) year = "20" + year;
    return `${year}-${m2[2].padStart(2, "0")}-${m2[3].padStart(2, "0")}`;
  }

  // Pattern 3: YYYY년 MM월 DD일
  const m3 = str.match(/^(\d{2,4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일?$/);
  if (m3) {
    let year = m3[1];
    if (year.length === 2) year = "20" + year;
    return `${year}-${m3[2].padStart(2, "0")}-${m3[3].padStart(2, "0")}`;
  }

  // Pattern 4: YYYYMMDD (8 digits)
  const m4 = str.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m4) {
    return `${m4[1]}-${m4[2]}-${m4[3]}`;
  }

  return null;
}

// Utility to parse numeric values from Excel cells (strips commas, currency signs)
export function parseNumeric(val) {
  if (typeof val === "number") return val;
  if (!val) return 0;
  const cleanStr = String(val).replace(/[^\d.-]/g, "").trim();
  const num = parseFloat(cleanStr);
  return isNaN(num) ? 0 : num;
}

/**
 * Parses OKPOS sales excel file.
 * Handles:
 * 1. 일기간 (시간대별) 포맷 -> 아침 / 점심 / 저녁 / 전체
 * 2. 상품 ABC 분석 포맷 -> 등급, 상품명, 실매출액, 판매수량, 점유율
 * 3. Horizontal Pivot 포맷
 * 4. Standard Flat List 포맷
 */
async function readWorkbook(file) {
  if (file && typeof file.arrayBuffer === "function") {
    const ab = await file.arrayBuffer();
    return XLSX.read(ab, { type: "array", cellDates: false });
  }
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(file)) {
    return XLSX.read(file, { type: "buffer", cellDates: false });
  }
  if (typeof file === "string") {
    return XLSX.readFile(file, { cellDates: false });
  }
  if (typeof FileReader !== "undefined" && file instanceof Blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          resolve(XLSX.read(e.target.result, { type: "binary", cellDates: false }));
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error("파일을 읽는 중에 오류가 발생했습니다."));
      reader.readAsBinaryString(file);
    });
  }
  throw new Error("지원하지 않는 파일 형식이거나 파일 데이터가 없습니다.");
}

export async function parseOKPOSExcel(file) {
  const workbook = await readWorkbook(file);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // 1. Read sheet as raw 2D array of cells
  const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  
  if (allRows.length === 0) {
    throw new Error("엑셀 파일에 데이터가 없거나 형식이 다릅니다.");
  }

        // Check first 10 rows for keywords
        let allTextInHeader = "";
        for (let r = 0; r < Math.min(allRows.length, 12); r++) {
          allTextInHeader += " " + allRows[r].join(" ");
        }

        const cleanHeaderText = allTextInHeader.replace(/\s+/g, " ");

        // =========================================================================
        // CASE A: 시간대별 매출 리포트 ("일기간 (시간대별)")
        // =========================================================================
        const isTimeSlotReport = cleanHeaderText.includes("시간대별") || 
                                (cleanHeaderText.includes("시간대") && cleanHeaderText.includes("영수건수") && cleanHeaderText.includes("실매출"));

        if (isTimeSlotReport) {
          // Extract date from "조회일자 : 2026-09-26 ~ 2026-09-26" or similar
          let reportDate = null;
          let reportDateRange = null;

          const dateRangeMatch = cleanHeaderText.match(/(\d{4}[-./]\d{1,2}[-./]\d{1,2})\s*~\s*(\d{4}[-./]\d{1,2}[-./]\d{1,2})/);
          if (dateRangeMatch) {
            const startD = parseDateString(dateRangeMatch[1]);
            const endD = parseDateString(dateRangeMatch[2]);
            reportDate = startD || endD;
            reportDateRange = { start: startD, end: endD };
          } else {
            const singleDateMatch = cleanHeaderText.match(/(\d{4}[-./]\d{1,2}[-./]\d{1,2})/);
            if (singleDateMatch) {
              reportDate = parseDateString(singleDateMatch[1]);
            }
          }

          if (!reportDate) {
            const fileInfo = parseFileNameInfo(file.name);
            reportDate = `${fileInfo.period}-01`;
          }

          // Locate table header row with "No.", "시간대", "영수건수", "실매출", "영수단가"
          let headerRowIdx = -1;
          let colIdxMap = { no: -1, timeSlot: -1, count: -1, sales: -1, avgPrice: -1 };

          for (let r = 0; r < Math.min(allRows.length, 20); r++) {
            const row = allRows[r].map(c => String(c || "").trim().replace(/\s+/g, ""));
            const timeCol = row.findIndex(c => c.includes("시간대") || c === "시간");
            const salesCol = row.findIndex(c => c.includes("실매출") || c.includes("매출액"));
            const countCol = row.findIndex(c => c.includes("영수건수") || c.includes("건수"));

            if (timeCol !== -1 && (salesCol !== -1 || countCol !== -1)) {
              headerRowIdx = r;
              colIdxMap.timeSlot = timeCol;
              colIdxMap.sales = salesCol !== -1 ? salesCol : timeCol + 2;
              colIdxMap.count = countCol !== -1 ? countCol : timeCol + 1;
              colIdxMap.avgPrice = row.findIndex(c => c.includes("단가") || c.includes("영수단가"));
              break;
            }
          }

          if (headerRowIdx === -1) {
            // fallback standard column positions
            headerRowIdx = 4;
            colIdxMap = { no: 0, timeSlot: 1, count: 2, sales: 3, avgPrice: 4 };
          }

          let morningSales = 0, morningCount = 0;
          let lunchSales = 0, lunchCount = 0;
          let dinnerSales = 0, dinnerCount = 0;
          let totalSales = 0, totalCount = 0;

          const parsedRows = [];

          for (let r = headerRowIdx + 1; r < allRows.length; r++) {
            const row = allRows[r];
            if (!row || row.length === 0) continue;

            const timeSlotText = String(row[colIdxMap.timeSlot] || "").trim();
            if (!timeSlotText) continue;

            const countVal = parseNumeric(row[colIdxMap.count]);
            const salesVal = parseNumeric(row[colIdxMap.sales]);
            const avgPriceVal = colIdxMap.avgPrice !== -1 ? parseNumeric(row[colIdxMap.avgPrice]) : (countVal > 0 ? Math.round(salesVal / countVal) : 0);

            if (timeSlotText.includes("전체") || timeSlotText.includes("합계")) {
              totalSales = salesVal;
              totalCount = countVal;
            } else if (timeSlotText.includes("아침") || timeSlotText.includes("06~11") || timeSlotText.includes("06 ~ 11")) {
              morningSales += salesVal;
              morningCount += countVal;
              parsedRows.push({
                date: reportDate,
                category: "시간대_아침",
                itemCode: "TIME-MORN",
                itemName: "아침 [06 ~ 11]",
                timeSlot: "morning",
                quantity: countVal,
                totalSales: salesVal,
                discount: 0,
                netSales: salesVal,
                avgPrice: avgPriceVal
              });
            } else if (timeSlotText.includes("점심") || timeSlotText.includes("11~16") || timeSlotText.includes("11 ~ 16")) {
              lunchSales += salesVal;
              lunchCount += countVal;
              parsedRows.push({
                date: reportDate,
                category: "시간대_점심",
                itemCode: "TIME-LUNCH",
                itemName: "점심 [11 ~ 16]",
                timeSlot: "lunch",
                quantity: countVal,
                totalSales: salesVal,
                discount: 0,
                netSales: salesVal,
                avgPrice: avgPriceVal
              });
            } else if (timeSlotText.includes("저녁") || timeSlotText.includes("16~24") || timeSlotText.includes("16 ~ 24") || timeSlotText.includes("야간")) {
              dinnerSales += salesVal;
              dinnerCount += countVal;
              parsedRows.push({
                date: reportDate,
                category: "시간대_저녁",
                itemCode: "TIME-DINNER",
                itemName: "저녁 [16 ~ 24]",
                timeSlot: "dinner",
                quantity: countVal,
                totalSales: salesVal,
                discount: 0,
                netSales: salesVal,
                avgPrice: avgPriceVal
              });
            } else {
              // Custom hourly slot
              parsedRows.push({
                date: reportDate,
                category: "시간대_기타",
                itemCode: `TIME-${r}`,
                itemName: timeSlotText,
                timeSlot: "other",
                quantity: countVal,
                totalSales: salesVal,
                discount: 0,
                netSales: salesVal,
                avgPrice: avgPriceVal
              });
            }
          }

          if (parsedRows.length > 0) {
            parsedRows.isTimeSlotReport = true;
            parsedRows.timeSlotSummary = {
              date: reportDate,
              dateRange: reportDateRange,
              morningSales,
              morningCount,
              lunchSales,
              lunchCount,
              morningLunchSales: morningSales + lunchSales,
              morningLunchCount: morningCount + lunchCount,
              dinnerSales,
              dinnerCount,
              totalSales: totalSales || (morningSales + lunchSales + dinnerSales),
              totalCount: totalCount || (morningCount + lunchCount + dinnerCount)
            };
            return parsedRows;
          }
        }

        // =========================================================================
        // CASE B: 상품 ABC 분석 리포트 ("매출관리 > 매출분석 > 상품ABC분석")
        // =========================================================================
        const isAbcReport = cleanHeaderText.includes("ABC분석") || 
                           cleanHeaderText.includes("상품ABC") || 
                           (cleanHeaderText.includes("등급") && cleanHeaderText.includes("점유율") && cleanHeaderText.includes("실매출액"));

        if (isAbcReport) {
          let reportDate = null;
          let reportDateRange = null;

          const dateRangeMatch = cleanHeaderText.match(/(\d{4}[-./]\d{1,2}[-./]\d{1,2})\s*~\s*(\d{4}[-./]\d{1,2}[-./]\d{1,2})/);
          if (dateRangeMatch) {
            const startD = parseDateString(dateRangeMatch[1]);
            const endD = parseDateString(dateRangeMatch[2]);
            reportDate = startD || endD;
            reportDateRange = { start: startD, end: endD };
          } else {
            const singleDateMatch = cleanHeaderText.match(/(\d{4}[-./]\d{1,2}[-./]\d{1,2})/);
            if (singleDateMatch) {
              reportDate = parseDateString(singleDateMatch[1]);
            }
          }

          if (!reportDate) {
            const fileInfo = parseFileNameInfo(file.name);
            reportDate = `${fileInfo.period}-01`;
          }

          let headerRowIdx = -1;
          let colIdxMap = { grade: -1, rank: -1, category: -1, code: -1, name: -1, sales: -1, qty: -1, share: -1 };

          for (let r = 0; r < Math.min(allRows.length, 20); r++) {
            const row = allRows[r].map(c => String(c || "").trim().replace(/\s+/g, ""));
            const gradeCol = row.findIndex(c => c.includes("등급"));
            const nameCol = row.findIndex(c => c.includes("상품명") || c.includes("메뉴명") || c.includes("품명"));
            const salesCol = row.findIndex(c => c.includes("실매출") || c.includes("매출액"));

            if (gradeCol !== -1 && nameCol !== -1 && salesCol !== -1) {
              headerRowIdx = r;
              colIdxMap.grade = gradeCol;
              colIdxMap.rank = row.findIndex(c => c.includes("No") || c === "순위" || c === "번호");
              colIdxMap.category = row.findIndex(c => c.includes("대분류") || c.includes("분류") || c.includes("카테고리"));
              colIdxMap.code = row.findIndex(c => c.includes("상품코드") || c.includes("코드"));
              colIdxMap.name = nameCol;
              colIdxMap.sales = salesCol;
              colIdxMap.qty = row.findIndex(c => c.includes("판매수량") || c.includes("수량"));
              colIdxMap.share = row.findIndex(c => c.includes("점유율") || c.includes("비율"));
              break;
            }
          }

          if (headerRowIdx === -1) {
            headerRowIdx = 4;
            colIdxMap = { grade: 0, rank: 1, category: 2, code: 3, name: 4, sales: 5, qty: 6, share: 7 };
          }

          const parsedRows = [];
          for (let r = headerRowIdx + 1; r < allRows.length; r++) {
            const row = allRows[r];
            if (!row || row.length === 0) continue;

            const name = String(row[colIdxMap.name] || "").trim();
            if (!name || name.includes("합계") || name.includes("소계")) continue;

            const grade = String(row[colIdxMap.grade] || "C").trim().toUpperCase();
            const category = colIdxMap.category !== -1 ? String(row[colIdxMap.category] || "메뉴").trim() : "메뉴";
            const code = colIdxMap.code !== -1 ? String(row[colIdxMap.code] || "").trim() : "";
            const sales = parseNumeric(row[colIdxMap.sales]);
            const qty = colIdxMap.qty !== -1 ? Math.round(parseNumeric(row[colIdxMap.qty])) : 1;
            const share = colIdxMap.share !== -1 ? parseNumeric(row[colIdxMap.share]) : 0;

            parsedRows.push({
              date: reportDate,
              category: category || "메뉴",
              itemCode: code || `ITEM-${r}`,
              itemName: name,
              quantity: qty || 1,
              totalSales: sales,
              discount: 0,
              netSales: sales,
              grade: grade || "C",
              sharePercent: share
            });
          }

          if (parsedRows.length > 0) {
            parsedRows.isAbcReport = true;
            parsedRows.abcSummary = {
              date: reportDate,
              dateRange: reportDateRange,
              itemCount: parsedRows.length,
              totalSales: parsedRows.reduce((sum, r) => sum + r.netSales, 0)
            };
            return parsedRows;
          }
        }

        // =========================================================================
        // CASE C: Horizontal Pivot (가로 피벗) vs Standard Flat List (표준 리스트)
        // =========================================================================
        let dateCellCount = 0;
        for (let c = 0; c < allRows[0].length; c++) {
          if (parseDateString(allRows[0][c])) {
            dateCellCount++;
          }
        }

        const isHorizontalPivot = dateCellCount > 2;
        const parsedRows = [];

        if (isHorizontalPivot) {
          const columnMaps = {};
          let currentDate = null;

          for (let c = 0; c < allRows[0].length; c++) {
            const dateStr = parseDateString(allRows[0][c]);
            if (dateStr) {
              currentDate = dateStr;
              if (!columnMaps[currentDate]) {
                columnMaps[currentDate] = { quantity: -1, totalSales: -1, netSales: -1, discount: -1 };
              }
            }

            if (currentDate) {
              const subLabel = String(allRows[1][c] || "").trim().replace(/\s+/g, "");
              if (subLabel.includes("수량")) {
                columnMaps[currentDate].quantity = c;
              } else if (subLabel.includes("총매출액") || subLabel.includes("총매출")) {
                columnMaps[currentDate].totalSales = c;
              } else if (subLabel.includes("NET매출액") || subLabel.includes("실매출액") || subLabel.includes("순매출") || subLabel.includes("실매출")) {
                columnMaps[currentDate].netSales = c;
              } else if (subLabel.includes("할인액") || subLabel.includes("할인")) {
                columnMaps[currentDate].discount = c;
              }
            }
          }

          let categoryColIndex = -1;
          let nameColIndex = -1;
          let codeColIndex = -1;

          for (let c = 0; c < Math.min(allRows[0].length, 12); c++) {
            const val = String(allRows[0][c] || "").trim().replace(/\s+/g, "");
            if (val.includes("대분류") || val.includes("분류")) {
              categoryColIndex = c;
            } else if (val.includes("상품명") || val.includes("메뉴명") || val.includes("품명")) {
              nameColIndex = c;
            } else if (val.includes("바코드") || val.includes("상품코드") || val.includes("코드")) {
              codeColIndex = c;
            }
          }

          if (categoryColIndex === -1) categoryColIndex = 0;
          if (nameColIndex === -1) nameColIndex = 3;
          if (codeColIndex === -1) codeColIndex = 4;

          for (let r = 2; r < allRows.length; r++) {
            const rowData = allRows[r];
            if (!rowData || rowData.length === 0) continue;

            const itemName = String(rowData[nameColIndex] || "").trim();
            if (!itemName || itemName.includes("합계") || itemName.includes("소계")) {
              continue;
            }

            const category = String(rowData[categoryColIndex] || "기타").trim();
            const itemCode = String(rowData[codeColIndex] || "N/A").trim();

            Object.keys(columnMaps).forEach(date => {
              const map = columnMaps[date];
              const qtyVal = map.quantity !== -1 ? rowData[map.quantity] : 0;
              const totalVal = map.totalSales !== -1 ? rowData[map.totalSales] : 0;
              const netVal = map.netSales !== -1 ? rowData[map.netSales] : 0;
              const discVal = map.discount !== -1 ? rowData[map.discount] : 0;

              const quantity = Math.round(parseNumeric(qtyVal));
              const totalSales = parseNumeric(totalVal);
              const netSales = parseNumeric(netVal);
              const discount = parseNumeric(discVal) || (totalSales - netSales);

              if (quantity > 0 || netSales > 0) {
                parsedRows.push({
                  date,
                  category,
                  itemCode: itemCode || "N/A",
                  itemName,
                  quantity,
                  totalSales,
                  discount,
                  netSales
                });
              }
            });
          }

        } else {
          // Standard flat list / Daily Menu Sales format
          let headerRowIndex = -1;
          const colIdxMap = {
            date: -1,
            category: -1,
            code: -1,
            name: -1,
            qty: -1,
            gross: -1,
            disc: -1,
            net: -1
          };

          let isDailySummary = false;
          for (let r = 0; r < Math.min(allRows.length, 40); r++) {
            const rowCells = allRows[r].map(c => String(c || "").trim().replace(/\s+/g, ""));
            
            // Flexible match for date
            const dateIdx = rowCells.findIndex(c => 
              c === "일자" || c === "매출일자" || c === "영업일자" || c === "정산일자" || c === "판매일자" || c === "일시" || c === "일" ||
              c.includes("영업일자") || c.includes("매출일자")
            );
            // Flexible match for name
            const nameIdx = rowCells.findIndex(c => 
              c === "상품명" || c === "메뉴명" || c === "품명" || c === "품목명" || c === "단축명" ||
              c.includes("상품명") || c.includes("메뉴명") || c.includes("품명")
            );
            // Flexible match for net sales
            const netIdx = rowCells.findIndex(c => 
              c === "실매출액" || c === "실매출" || c === "순매출액" || c === "순매출" || c === "NET매출액" || c === "결제금액" ||
              c.includes("실매출") || c.includes("순매출")
            );
            const grossIdx = rowCells.findIndex(c =>
              c === "총매출액" || c === "총매출" || c === "매출총액" || c === "금액" || c === "판매금액" || c === "매출금액" ||
              c.includes("총매출")
            );

            if (dateIdx !== -1 && (nameIdx !== -1 || netIdx !== -1 || grossIdx !== -1)) {
              headerRowIndex = r;
              colIdxMap.date = dateIdx;
              colIdxMap.name = nameIdx;
              isDailySummary = (nameIdx === -1);
              colIdxMap.net = netIdx !== -1 ? netIdx : grossIdx;
              colIdxMap.category = rowCells.findIndex(c => c === "대분류" || c === "분류" || c === "카테고리" || c === "중분류" || c === "코너");
              colIdxMap.code = rowCells.findIndex(c => c === "상품코드" || c === "코드" || c === "단축코드" || c === "메뉴코드" || c === "바코드");
              colIdxMap.qty = rowCells.findIndex(c => c === "수량" || c === "판매수량" || c === "총수량" || c === "건수" || c === "영수건수");
              colIdxMap.gross = grossIdx !== -1 ? grossIdx : netIdx;
              colIdxMap.disc = rowCells.findIndex(c => c === "총할인액" || c === "총할인" || c === "할인액" || c === "할인" || c === "할인금액" || c === "DC");
              break;
            }
          }

          if (headerRowIndex === -1) {
            headerRowIndex = 4;
            colIdxMap.date = 0;
            colIdxMap.category = 1;
            colIdxMap.code = 2;
            colIdxMap.name = 3;
            colIdxMap.qty = 4;
            colIdxMap.gross = 5;
            colIdxMap.disc = 6;
            colIdxMap.net = 7;
          }

          const range = XLSX.utils.decode_range(sheet["!ref"] || `A1:Z${allRows.length}`);
          let lastValidDate = null;
          let fileSummary = null;

          for (let r = headerRowIndex + 1; r <= range.e.r; r++) {
            const getCell = (c) => (c !== -1 ? sheet[XLSX.utils.encode_cell({ r, c })] : null);
            const dateCell = getCell(colIdxMap.date);
            const nameCell = getCell(colIdxMap.name);
            const codeCell = getCell(colIdxMap.code);
            const catCell = getCell(colIdxMap.category);
            const qtyCell = getCell(colIdxMap.qty);
            const grossCell = getCell(colIdxMap.gross);
            const discCell = getCell(colIdxMap.disc);
            const netCell = getCell(colIdxMap.net);

            const rawDateStr = dateCell ? String(dateCell.w || dateCell.v || "").trim() : "";
            let itemName = nameCell ? String(nameCell.w || nameCell.v || "").trim() : "";
            if (isDailySummary && !itemName) {
              itemName = "일별 종합 매출";
            }
            // Preserve leading zeros: prefer formatted text 'w' over raw value 'v'
            const rawCode = codeCell ? String(codeCell.w || codeCell.v || "").trim() : "";
            const category = catCell ? String(catCell.w || catCell.v || "").trim() : (isDailySummary ? "일별종합" : "메뉴");

            // Check if summary row (합계 / 총합계)
            if (rawDateStr === "합계" || rawDateStr === "총합계" || itemName === "합계" || itemName === "총합계") {
              fileSummary = {
                quantity: parseNumeric(qtyCell?.v || qtyCell?.w),
                totalSales: parseNumeric(grossCell?.v || grossCell?.w),
                discount: parseNumeric(discCell?.v || discCell?.w),
                netSales: parseNumeric(netCell?.v || netCell?.w)
              };
              continue; // Exclude summary row from detail rows to prevent double-counting
            }

            // Exclude empty rows and subtotals (소계)
            if ((!itemName && !rawDateStr) || rawDateStr.includes("소계") || itemName.includes("소계")) {
              continue;
            }

            // Parse date using parseDateCell
            let date = parseDateCell(dateCell?.v, dateCell?.w);
            // Inherit merged date if blank within same valid segment
            if (!date && lastValidDate && itemName) {
              date = lastValidDate;
            }
            if (date) {
              lastValidDate = date;
            }

            if (!date || !itemName) continue;

            const quantity = Math.round(parseNumeric(qtyCell?.v || qtyCell?.w));
            const totalSales = parseNumeric(grossCell?.v || grossCell?.w);
            const discount = parseNumeric(discCell?.v || discCell?.w);
            let netSales = parseNumeric(netCell?.v || netCell?.w);

            // Cross-check & validate netSales formula: totalSales - discount
            if (netSales === 0 && totalSales > 0 && discount === 0) {
              netSales = totalSales;
            }
            if (totalSales > 0 && discount > 0 && netSales === totalSales) {
              netSales = totalSales - discount;
            }

            // Tag 0-won option / service items while keeping them preserved in original form
            const isOptionOrService = (netSales === 0 && totalSales === 0 && quantity > 0);

            parsedRows.push({
              date,
              category: category || "메뉴",
              itemCode: rawCode || `ITEM-${r}`,
              itemName,
              quantity,
              totalSales,
              discount,
              netSales,
              isOptionOrService,
              reportType: "daily_menu"
            });
          }

          if (fileSummary) {
            parsedRows.fileSummary = fileSummary;
          }

          const datesSet = new Set(parsedRows.map(r => r.date).filter(Boolean));
          const sortedDates = Array.from(datesSet).sort();
          parsedRows.reportType = "일자별 상품별 매출 (메뉴매출)";
          parsedRows.actualPeriod = {
            start: sortedDates[0] || null,
            end: sortedDates[sortedDates.length - 1] || null
          };
          parsedRows.distinctDays = sortedDates;
          parsedRows.totalNetSales = parsedRows.reduce((sum, r) => sum + r.netSales, 0);
          parsedRows.totalGrossSales = parsedRows.reduce((sum, r) => sum + r.totalSales, 0);
          parsedRows.totalDiscount = parsedRows.reduce((sum, r) => sum + r.discount, 0);
          parsedRows.totalQuantity = parsedRows.reduce((sum, r) => sum + r.quantity, 0);
        }

    if (parsedRows.length === 0) {
      throw new Error("OKPOS 형식의 매출 행을 찾을 수 없습니다. 엑셀 파일 형식을 확인해 주세요.");
    }

    return parsedRows;
}

/**
 * Parses Monthly Cost / Profit & Loss statement workbook.
 */
export function parseCostExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: "binary", cellDates: true });
        const parsedData = {
          initialCost: null,
          months: {},
          trend: []
        };
        
        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
          if (allRows.length === 0) return;
          
          const title = allRows[0][0] || "";
          
          // 1. Initial Setup Cost Sheet
          if (sheetName === "2510" || String(title).includes("초기비용")) {
            const initialCost = {
              title: String(title).trim(),
              period: "2025-10",
              categories: {},
              totalSum: 0
            };
            
            const headersRow = allRows[1] || [];
            const catCount = Math.floor(headersRow.length / 3);
            
            for (let k = 0; k < catCount; k++) {
              const name = headersRow[3 * k];
              if (name && name !== "최종합계") {
                initialCost.categories[name] = {
                  sum: Number(headersRow[3 * k + 1]) || 0,
                  ratio: Number(headersRow[3 * k + 2]) || 0,
                  items: []
                };
              } else if (name === "최종합계") {
                initialCost.totalSum = Number(headersRow[3 * k + 1]) || 0;
              }
            }
            
            for (let r = 2; r < allRows.length; r++) {
              const row = allRows[r];
              if (!row || row.length === 0) continue;
              
              for (let k = 0; k < catCount; k++) {
                const catName = headersRow[3 * k];
                if (!catName || catName === "최종합계") continue;
                
                const itemName = row[3 * k];
                const itemVal = row[3 * k + 1];
                const itemRatio = row[3 * k + 2];
                
                if (itemName !== undefined && itemName !== null && String(itemName).trim() !== "") {
                  initialCost.categories[catName].items.push({
                    name: String(itemName).trim(),
                    value: Number(itemVal) || 0,
                    ratio: Number(itemRatio) || 0
                  });
                }
              }
            }
            parsedData.initialCost = initialCost;
          }
          // 2. Simple Trend Sheet
          else if (sheetName === "간편 손익분석표" || String(title).includes("간편손익")) {
            const headersRow = allRows[2] || [];
            for (let r = 3; r < allRows.length; r++) {
              const row = allRows[r];
              if (!row || row.length === 0 || !row[0]) continue;
              
              const monthStr = String(row[0]).trim();
              if (monthStr === "null" || monthStr === "" || row[1] === "" || row[1] === null) continue;
              
              const trendRow = {
                month: monthStr,
                sales: Number(row[1]) || 0,
                foodCostRatio: Number(row[3]) || 0,
                laborCostRatio: Number(row[4]) || 0,
                rentRatio: Number(row[6]) || 0,
                adminRatio: Number(row[7]) || 0,
                taxRatio: Number(row[9]) || 0,
                insuranceRatio: Number(row[10]) || 0,
                feeRatio: Number(row[11]) || 0,
                marketingRatio: Number(row[13]) || 0,
                loanRatio: Number(row[15]) || 0,
                netProfit: Number(row[17]) || 0,
                netProfitRatio: Number(row[18]) || 0
              };
              parsedData.trend.push(trendRow);
            }
          }
          // 3. Monthly P&L Sheet
          else if (/^\d{4}$/.test(sheetName)) {
            const year = "20" + sheetName.substring(0, 2);
            const month = sheetName.substring(2, 4);
            const period = `${year}-${month}`;
            
            const sales = Number(allRows[0][4]) || 0;
            const memo = String(allRows[0][6] || "").trim();
            
            const monthData = {
              title: String(title).trim(),
              period,
              sales,
              memo,
              categories: {},
              netProfit: 0,
              netProfitRatio: 0
            };
            
            const headersRow = allRows[1] || [];
            const catCount = Math.floor(headersRow.length / 3);
            
            for (let k = 0; k < catCount; k++) {
              const name = headersRow[3 * k];
              if (name) {
                monthData.categories[name] = {
                  sum: Number(headersRow[3 * k + 1]) || 0,
                  ratio: Number(headersRow[3 * k + 2]) || 0,
                  items: []
                };
                if (name === "손익") {
                  monthData.netProfit = Number(headersRow[3 * k + 1]) || 0;
                  monthData.netProfitRatio = Number(headersRow[3 * k + 2]) || 0;
                }
              }
            }
            
            for (let r = 2; r < allRows.length; r++) {
              const row = allRows[r];
              if (!row || row.length === 0) continue;
              
              for (let k = 0; k < catCount; k++) {
                const catName = headersRow[3 * k];
                if (!catName) continue;
                
                const itemName = row[3 * k];
                const itemVal = row[3 * k + 1];
                const itemRatio = row[3 * k + 2];
                
                if (itemName !== undefined && itemName !== null && String(itemName).trim() !== "") {
                  monthData.categories[catName].items.push({
                    name: String(itemName).trim(),
                    value: Number(itemVal) || 0,
                    ratio: Number(itemRatio) || 0
                  });
                }
              }
            }
            parsedData.months[period] = monthData;
          }
        });
        
        resolve(parsedData);
      } catch (err) {
        reject(err);
      }
    };
    
    reader.onerror = () => reject(new Error("파일 읽기 실패"));
    reader.readAsBinaryString(file);
  });
}
