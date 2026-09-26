// excelParser.js
import * as XLSX from "xlsx";

/**
 * Extracts store name and period (YYYY-MM) from a filename.
 * E.g., "금막창 종로점 26년 7월 일자별 매출.xlsx" -> { storeName: "금막창 종로점", period: "2026-07" }
 */
export function parseFileNameInfo(fileName, existingStores = []) {
  const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf(".")) || fileName;

  // 1. Detect Year and Month from filename
  let year = null;
  let month = null;
  
  const dateRegexes = [
    /(\d{2,4})\s*년\s*(\d{1,2})\s*월/,       // E.g. "24년 11월", "2024년 11월"
    /(\d{2,4})[-_](\d{1,2})/,               // E.g. "24-11", "2024_11"
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
    
    if (rawYear.length === 2) {
      year = "20" + rawYear;
    } else {
      year = rawYear;
    }
    month = rawMonth.padStart(2, "0");
  } else {
    const now = new Date();
    year = now.getFullYear().toString();
    month = (now.getMonth() + 1).toString().padStart(2, "0");
  }

  const period = `${year}-${month}`;

  // 2. Detect Store Name
  let detectedStoreName = "";
  const sortedStoreNames = [...existingStores]
    .map(s => s.name)
    .sort((a, b) => b.length - a.length);

  for (const storeName of sortedStoreNames) {
    if (nameWithoutExt.includes(storeName)) {
      detectedStoreName = storeName;
      break;
    }
  }

  if (!detectedStoreName) {
    let guessed = nameWithoutExt;
    if (dateMatch) {
      guessed = guessed.replace(dateMatch[0], "");
    }
    
    const keywords = [
      "일기간", "시간대별", "시간대", "ABC분석", "상품ABC분석", "ABC", 
      "일자별", "매출", "상품별", "상세", "현황", "데이터", "엑셀", 
      "정산", "OKPOS", "okpos", "소계", "월별", "다운로드", "copy", "복사본", 
      "\\(\\d+\\)", "결제", "일별", "보고서"
    ];
    
    keywords.forEach(keyword => {
      guessed = guessed.replace(new RegExp(keyword, "gi"), "");
    });

    guessed = guessed.replace(/\d+\s*월\s*[-~]\s*\d+\s*월/g, "");
    guessed = guessed.replace(/\d+\s*[-~]\s*\d+\s*월/g, "");
    guessed = guessed.replace(/\d+\s*[-~]\s*\d+/g, "");
    guessed = guessed.replace(/[-_()]/g, " ").replace(/\s+/g, " ").trim();
    
    if (guessed.length >= 2) {
      const candidates = existingStores.filter(store => 
        store.name.includes(guessed) || guessed.includes(store.name)
      );

      if (candidates.length === 1) {
        detectedStoreName = candidates[0].name;
      } else if (candidates.length > 1) {
        const branchMatch = candidates.find(c => {
          const branchPart = c.name.replace(guessed, "").trim();
          const cleanBranch = branchPart.replace("점", "").trim();
          return cleanBranch && nameWithoutExt.includes(cleanBranch);
        });

        if (branchMatch) {
          detectedStoreName = branchMatch.name;
        } else {
          detectedStoreName = candidates[0].name;
        }
      }
    }

    if (!detectedStoreName) {
      detectedStoreName = guessed || "신규 매장";
    }
  }

  return { storeName: detectedStoreName, period };
}

// Utility to parse dates in different formats
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
export function parseOKPOSExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: "binary", cellDates: true });
        
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
            resolve(parsedRows);
            return;
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
            resolve(parsedRows);
            return;
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
          // Standard flat list format
          let headerRowIndex = -1;
          for (let r = 0; r < Math.min(allRows.length, 40); r++) {
            const rowCells = allRows[r].map(c => String(c || "").trim().replace(/\s+/g, ""));
            
            const hasDate = rowCells.some(c => c.includes("일자") || c === "일" || c.includes("매출일"));
            const hasName = rowCells.some(c => c.includes("상품명") || c.includes("메뉴명") || c.includes("품명"));
            const hasCode = rowCells.some(c => c.includes("상품코드") || c.includes("코드") || c.includes("바코드"));
            const hasSales = rowCells.some(c => c.includes("실매출") || c.includes("매출액") || c.includes("금액"));

            if (hasDate && hasName && (hasCode || hasSales)) {
              headerRowIndex = r;
              break;
            }
          }

          const rangeIndex = headerRowIndex !== -1 ? headerRowIndex : 4;
          const rawJson = XLSX.utils.sheet_to_json(sheet, { range: rangeIndex, defval: "" });
          
          if (rawJson.length === 0) {
            throw new Error("엑셀 파일에 데이터가 없거나 형식이 다릅니다.");
          }

          const getValueByKeyKeywords = (rowObj, keywords) => {
            const keys = Object.keys(rowObj);
            for (const key of keys) {
              const cleanKey = String(key).trim().replace(/\s+/g, "");
              for (const kw of keywords) {
                if (cleanKey.includes(kw)) {
                  return rowObj[key];
                }
              }
            }
            return undefined;
          };

          let lastValidDate = null;

          for (let i = 0; i < rawJson.length; i++) {
            const row = rawJson[i];
            
            const rawDate = getValueByKeyKeywords(row, ["일자", "일시", "매출일"]);
            const category = String(getValueByKeyKeywords(row, ["대분류", "분류", "카테고리"]) || "기타").trim();
            const itemCode = String(getValueByKeyKeywords(row, ["상품코드", "단축코드", "코드"]) || "").trim();
            const itemName = String(getValueByKeyKeywords(row, ["상품명", "메뉴명", "품명"]) || "").trim();
            
            let dateStr = String(rawDate || "").trim();

            if (!dateStr && lastValidDate) {
              dateStr = lastValidDate;
            }

            if (!dateStr || dateStr.includes("합계") || dateStr.includes("소계") || !itemName) {
              continue; 
            }

            let formattedDate = parseDateString(rawDate) || parseDateString(dateStr);
            if (!formattedDate) {
              formattedDate = dateStr;
            }

            if (formattedDate && !formattedDate.includes("합계") && !formattedDate.includes("소계")) {
              lastValidDate = formattedDate;
            }

            const quantityVal = getValueByKeyKeywords(row, ["수량", "판매수량"]) || 0;
            const totalSalesVal = getValueByKeyKeywords(row, ["총매출액", "총매출", "매출총액"]) || 0;
            const discountVal = getValueByKeyKeywords(row, ["총할인액", "할인액", "할인"]) || 0;
            const netSalesVal = getValueByKeyKeywords(row, ["실매출액", "실매출", "매출액"]) || 0;

            const quantity = Math.round(parseNumeric(quantityVal));
            const totalSales = parseNumeric(totalSalesVal);
            const discount = parseNumeric(discountVal);
            const netSales = parseNumeric(netSalesVal);

            parsedRows.push({
              date: formattedDate,
              category,
              itemCode: itemCode || "N/A",
              itemName,
              quantity,
              totalSales,
              discount,
              netSales,
            });
          }
        }

        if (parsedRows.length === 0) {
          throw new Error("OKPOS 형식의 매출 행을 찾을 수 없습니다. 엑셀 파일 형식을 확인해 주세요.");
        }

        resolve(parsedRows);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => {
      reject(new Error("파일을 읽는 중에 오류가 발생했습니다."));
    };

    reader.readAsBinaryString(file);
  });
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
