// excelParser.js
import * as XLSX from "xlsx";

/**
 * Extracts store name and period (YYYY-MM) from a filename.
 * E.g., "금막창 종로점 26년 7월 일자별 매출.xlsx" -> { storeName: "금막창 종로점", period: "2026-07" }
 */
export function parseFileNameInfo(fileName, existingStores = []) {
  // Remove file extension
  const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf(".")) || fileName;

  // 1. Detect Year and Month from filename (cues)
  let year = null;
  let month = null;
  
  // Pattern A: "26년 7월" or "2026년 07월" or "26년07월"
  const koreanDateRegex = /(\d{2,4})\s*년\s*(\d{1,2})\s*월/;
  // Pattern B: "2026-07" or "26-07" or "2026_07"
  const hyphenDateRegex = /(\d{2,4})[-_](\d{1,2})/;
  
  let dateMatch = nameWithoutExt.match(koreanDateRegex);
  if (!dateMatch) {
    dateMatch = nameWithoutExt.match(hyphenDateRegex);
  }

  if (dateMatch) {
    let rawYear = dateMatch[1];
    let rawMonth = dateMatch[2];
    
    // Normalize year
    if (rawYear.length === 2) {
      year = "20" + rawYear; // assume 20xx
    } else {
      year = rawYear;
    }
    
    // Normalize month
    month = rawMonth.padStart(2, "0");
  } else {
    // Default to current year and month if not found
    const now = new Date();
    year = now.getFullYear().toString();
    month = (now.getMonth() + 1).toString().padStart(2, "0");
  }

  const period = `${year}-${month}`;

  // 2. Detect Store Name
  let detectedStoreName = "";

  // Sort existing store names by length descending to match longer names first
  const sortedStoreNames = [...existingStores]
    .map(s => s.name)
    .sort((a, b) => b.length - a.length);

  // A. Match exact substring first
  for (const storeName of sortedStoreNames) {
    if (nameWithoutExt.includes(storeName)) {
      detectedStoreName = storeName;
      break;
    }
  }

  // B. Fuzzy Match (If no exact match, guess store name and search candidate matches)
  if (!detectedStoreName) {
    let guessed = nameWithoutExt;
    if (dateMatch) {
      guessed = guessed.replace(dateMatch[0], "");
    }
    
    // Remove common descriptive keywords
    const keywords = [
      "일자별", "매출", "상품별", "상세", "현황", "데이터", "엑셀", 
      "정산", "OKPOS", "okpos", "소계", "월별", "다운로드", "copy", "복사본", 
      "\\(\\d+\\)", "결제", "일별", "보고서"
    ];
    
    keywords.forEach(keyword => {
      guessed = guessed.replace(new RegExp(keyword, "gi"), "");
    });

    // Remove range months and numbers e.g. "4월~8월 25", "4~8월"
    guessed = guessed.replace(/\d+\s*월\s*[-~]\s*\d+\s*월/g, "");
    guessed = guessed.replace(/\d+\s*[-~]\s*\d+\s*월/g, "");
    guessed = guessed.replace(/\d+\s*[-~]\s*\d+/g, "");
    
    // Clean spaces and special characters
    guessed = guessed.replace(/[-_()]/g, " ").replace(/\s+/g, " ").trim();
    
    if (guessed.length >= 2) {
      // Find candidate stores whose names contain 'guessed' or are contained within 'guessed'
      // E.g. guessed = "신영웅", candidate = "신영웅청국장해물뚝배기"
      const candidates = existingStores.filter(store => 
        store.name.includes(guessed) || guessed.includes(store.name)
      );

      if (candidates.length === 1) {
        detectedStoreName = candidates[0].name;
      } else if (candidates.length > 1) {
        // Resolve ambiguous matches like "금막창" matching "금막창 종로점" etc.
        const branchMatch = candidates.find(c => {
          // Remove the matched keyword and check if branch suffix is in filename
          const branchPart = c.name.replace(guessed, "").trim(); // e.g. "종로점"
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
function parseDateString(val) {
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

  // Remove time part if exists (e.g. "2024-11-01 12:00:00" -> "2024-11-01")
  const timeIndex = str.search(/\s+\d{1,2}:\d{2}/);
  if (timeIndex !== -1) {
    str = str.substring(0, timeIndex).trim();
  }

  // Pattern 1: YYYY-MM-DD or YYYY/MM/DD, optionally followed by (Mon) or (월)
  // E.g., "2024-11-01 (금)", "2024/11/01"
  const m1 = str.match(/^(\d{2,4})[-/](\d{1,2})[-/](\d{1,2})(?:\s*\([^)]+\))?$/);
  if (m1) {
    let year = m1[1];
    if (year.length === 2) year = "20" + year;
    return `${year}-${m1[2].padStart(2, "0")}-${m1[3].padStart(2, "0")}`;
  }

  // Pattern 2: YYYY.MM.DD or YY.MM.DD, optionally with spaces and trailing dot
  // E.g., "2024.11.01", "24. 11. 01.", "2024.11.01 (금)"
  const m2 = str.match(/^(\d{2,4})\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})\s*\.?(?:\s*\([^)]+\))?$/);
  if (m2) {
    let year = m2[1];
    if (year.length === 2) year = "20" + year;
    return `${year}-${m2[2].padStart(2, "0")}-${m2[3].padStart(2, "0")}`;
  }

  // Pattern 3: YYYY년 MM월 DD일 or YY년 MM월 DD일
  // E.g., "2024년 11월 01일", "24년 11월 1일"
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

// Utility to parse numeric values from Excel cells (strips commas)
function parseNumeric(val) {
  if (typeof val === "number") return val;
  if (!val) return 0;
  const cleanStr = String(val).replace(/,/g, "").trim();
  const num = parseFloat(cleanStr);
  return isNaN(num) ? 0 : num;
}

/**
 * Parses OKPOS sales excel file.
 * Handles both Standard List format and Horizontal Pivot format dynamically.
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

        // 2. Detect format type: Standard List vs Horizontal Pivot
        // We count date cells in the first row (row index 0)
        let dateCellCount = 0;
        for (let c = 0; c < allRows[0].length; c++) {
          if (parseDateString(allRows[0][c])) {
            dateCellCount++;
          }
        }

        const isHorizontalPivot = dateCellCount > 2;
        const parsedRows = [];

        if (isHorizontalPivot) {
          // ----------------------------------------------------
          // PARSE HORIZONTAL PIVOT FORMAT (e.g. 금등어)
          // ----------------------------------------------------
          // Row 0 has dates (merged)
          // Row 1 has sub-headers (수량, 총매출액, NET매출액...)
          // Row 2 starts the data
          
          // Map of column groups by date
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

          // Resolve metadata columns (Category, Item Name, Item Code) from Row 0
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

          // Parse data rows starting from row index 2 (3rd row)
          for (let r = 2; r < allRows.length; r++) {
            const rowData = allRows[r];
            if (!rowData || rowData.length === 0) continue;

            const itemName = String(rowData[nameColIndex] || "").trim();
            // Skip empty/summary rows
            if (!itemName || itemName.includes("합계") || itemName.includes("소계")) {
              continue;
            }

            const category = String(rowData[categoryColIndex] || "기타").trim();
            const itemCode = String(rowData[codeColIndex] || "N/A").trim();

            // Loop over dates
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
          // ----------------------------------------------------
          // PARSE STANDARD FLAT LIST FORMAT (e.g. 신영웅)
          // ----------------------------------------------------
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

          // To propagate date downwards for merged cells / missing cell values in OKPOS tables
          let lastValidDate = null;

          for (let i = 0; i < rawJson.length; i++) {
            const row = rawJson[i];
            
            const rawDate = getValueByKeyKeywords(row, ["일자", "일시", "매출일"]);
            const category = String(getValueByKeyKeywords(row, ["대분류", "분류", "카테고리"]) || "기타").trim();
            const itemCode = String(getValueByKeyKeywords(row, ["상품코드", "단축코드", "코드"]) || "").trim();
            const itemName = String(getValueByKeyKeywords(row, ["상품명", "메뉴명", "품명"]) || "").trim();
            
            let dateStr = String(rawDate || "").trim();

            // Forward fill missing date cell values
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

            // Save the last valid formatted date
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
          throw new Error("OKPOS 형식의 매출 행을 찾을 수 없습니다. 헤더를 확인해 주세요.");
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
