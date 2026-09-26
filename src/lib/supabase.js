// src/lib/supabase.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zciylyymplgfvzqqgsck.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjaXlseXltcGxnZnZ6cXFnc2NrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0MTYwMDQsImV4cCI6MjEwNTk5MjAwNH0.i7UA4fepZPUwQdDHSk8b5mm3yytxOgVFCwa-gjJBKQ4";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Load stores from Supabase
 */
export async function loadStoresFromSupabase() {
  try {
    const { data, error } = await supabase.from("stores").select("*").order("name");
    if (error) throw error;
    if (data && data.length > 0) {
      return data.map(s => ({
        id: s.id,
        name: s.name,
        category: s.category || "기타"
      }));
    }
    return null;
  } catch (err) {
    console.warn("Supabase stores load fallback:", err.message);
    return null;
  }
}

/**
 * Save stores to Supabase (Upsert)
 */
export async function saveStoresToSupabase(stores) {
  try {
    if (!stores || stores.length === 0) return;
    const formatted = stores.map(s => ({
      id: s.id,
      name: s.name,
      category: s.category || "기타"
    }));
    const { error } = await supabase.from("stores").upsert(formatted, { onConflict: "id" });
    if (error) throw error;
  } catch (err) {
    console.warn("Supabase stores save error:", err.message);
  }
}

/**
 * Load sales records from Supabase
 */
export async function loadSalesFromSupabase() {
  try {
    const { data, error } = await supabase
      .from("sales_records")
      .select("*")
      .limit(10000);
      
    if (error) throw error;
    if (data && data.length > 0) {
      return data.map(r => ({
        date: r.date,
        storeId: r.store_id || r.storeId,
        storeName: r.store_name || r.storeName,
        category: r.category,
        itemCode: r.item_code || r.itemCode,
        itemName: r.item_name || r.itemName,
        quantity: Number(r.quantity) || 0,
        totalSales: Number(r.total_sales || r.totalSales) || 0,
        discount: Number(r.discount) || 0,
        netSales: Number(r.net_sales || r.netSales) || 0,
        timeSlot: r.time_slot || r.timeSlot || "dinner",
        uploadId: r.upload_id || r.uploadId
      }));
    }
    return null;
  } catch (err) {
    console.warn("Supabase sales load fallback:", err.message);
    return null;
  }
}

/**
 * Save sales records in chunks to Supabase
 */
export async function saveSalesToSupabase(sales) {
  try {
    if (!sales || sales.length === 0) return;
    
    // Chunking to 500 rows per batch
    const chunkSize = 500;
    for (let i = 0; i < sales.length; i += chunkSize) {
      const chunk = sales.slice(i, i + chunkSize).map((r, idx) => ({
        id: `${r.storeId}-${r.date}-${r.itemName || idx}-${i + idx}`,
        date: r.date,
        store_id: r.storeId,
        store_name: r.storeName,
        category: r.category || "기타",
        item_code: r.itemCode || "N/A",
        item_name: r.itemName,
        quantity: r.quantity || 0,
        total_sales: r.totalSales || 0,
        discount: r.discount || 0,
        net_sales: r.netSales || 0,
        time_slot: r.timeSlot || "dinner",
        upload_id: r.uploadId || null
      }));

      const { error } = await supabase.from("sales_records").upsert(chunk, { onConflict: "id" });
      if (error) {
        console.warn(`Supabase sales batch ${i} error:`, error.message);
      }
    }
  } catch (err) {
    console.warn("Supabase sales save error:", err.message);
  }
}

/**
 * Load upload logs from Supabase
 */
export async function loadUploadLogsFromSupabase() {
  try {
    const { data, error } = await supabase.from("upload_logs").select("*").order("upload_time", { ascending: false });
    if (error) throw error;
    if (data && data.length > 0) {
      return data.map(l => ({
        id: l.id,
        storeId: l.store_id || l.storeId,
        storeName: l.store_name || l.storeName,
        fileName: l.file_name || l.fileName,
        period: l.period,
        rowCount: Number(l.row_count || l.rowCount) || 0,
        uploadTime: l.upload_time || l.uploadTime,
        status: l.status || "정상 완료"
      }));
    }
    return null;
  } catch (err) {
    console.warn("Supabase upload logs load fallback:", err.message);
    return null;
  }
}

/**
 * Save upload logs to Supabase
 */
export async function saveUploadLogsToSupabase(logs) {
  try {
    if (!logs || logs.length === 0) return;
    const formatted = logs.map(l => ({
      id: l.id,
      store_id: l.storeId,
      store_name: l.storeName,
      file_name: l.fileName,
      period: l.period,
      row_count: l.rowCount,
      upload_time: l.uploadTime,
      status: l.status || "정상 완료"
    }));
    const { error } = await supabase.from("upload_logs").upsert(formatted, { onConflict: "id" });
    if (error) throw error;
  } catch (err) {
    console.warn("Supabase upload logs save error:", err.message);
  }
}

/**
 * Load Cost Data from Supabase
 */
export async function loadCostDataFromSupabase() {
  try {
    const { data, error } = await supabase.from("cost_data").select("*");
    if (error) throw error;
    if (data && data.length > 0) {
      const result = {};
      data.forEach(row => {
        result[row.store_id] = row.data;
      });
      return result;
    }
    return null;
  } catch (err) {
    console.warn("Supabase cost data load fallback:", err.message);
    return null;
  }
}

/**
 * Save Cost Data to Supabase
 */
export async function saveCostDataToSupabase(costData) {
  try {
    if (!costData) return;
    const rows = Object.keys(costData).map(storeId => ({
      store_id: storeId,
      data: costData[storeId],
      updated_at: new Date().toISOString()
    }));
    const { error } = await supabase.from("cost_data").upsert(rows, { onConflict: "store_id" });
    if (error) throw error;
  } catch (err) {
    console.warn("Supabase cost data save error:", err.message);
  }
}
