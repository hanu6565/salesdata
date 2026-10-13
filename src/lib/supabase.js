// src/lib/supabase.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zciylyymplgfvzqqgsck.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjaXlseXltcGxnZnZ6cXFnc2NrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0MTYwMDQsImV4cCI6MjEwNTk5MjAwNH0.i7UA4fepZPUwQdDHSk8b5mm3yytxOgVFCwa-gjJBKQ4";

// Client-side singleton Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

/**
 * Check if Supabase client is properly configured with custom env vars
 */
export function isSupabaseConfigured() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Server-side Admin client for API routes (bypassing RLS when necessary)
 */
export function getSupabaseAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;
  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false
    }
  });
}

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
      category: s.category || "기타",
      updated_at: new Date().toISOString()
    }));
    const { error } = await supabase.from("stores").upsert(formatted, { onConflict: "id" });
    if (error) throw error;
  } catch (err) {
    console.warn("Supabase stores save error:", err.message);
  }
}

/**
 * Load sales records from Supabase with batch pagination support
 */
export async function loadSalesFromSupabase(limit = 10000) {
  try {
    const { data, error } = await supabase
      .from("sales_records")
      .select("*")
      .order("date", { ascending: false })
      .limit(limit);
      
    if (error) throw error;
    if (data && data.length > 0) {
      return data.map(r => ({
        id: r.id,
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
 * Filtered range query to minimize payload over network
 */
export async function loadSalesByStoreAndRange(storeId, startDate, endDate) {
  try {
    let query = supabase.from("sales_records").select("*");
    if (storeId && storeId !== "total") {
      query = query.eq("store_id", storeId);
    }
    if (startDate) {
      query = query.gte("date", startDate);
    }
    if (endDate) {
      query = query.lte("date", endDate);
    }
    const { data, error } = await query.order("date", { ascending: false });
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      date: r.date,
      storeId: r.store_id,
      storeName: r.store_name,
      category: r.category,
      itemCode: r.item_code,
      itemName: r.item_name,
      quantity: Number(r.quantity) || 0,
      totalSales: Number(r.total_sales) || 0,
      discount: Number(r.discount) || 0,
      netSales: Number(r.net_sales) || 0,
      timeSlot: r.time_slot || "dinner",
      uploadId: r.upload_id
    }));
  } catch (err) {
    console.warn("Supabase filtered sales load error:", err.message);
    return null;
  }
}

/**
 * Save sales records in chunks to Supabase with IDEMPOTENT NATURAL KEYS
 * (Prevents duplicate entries upon re-upload or re-sync)
 */
export async function saveSalesToSupabase(sales) {
  try {
    if (!sales || sales.length === 0) return;
    
    // Chunking to 400 rows per batch for reliable payload delivery
    const chunkSize = 400;
    for (let i = 0; i < sales.length; i += chunkSize) {
      const chunk = sales.slice(i, i + chunkSize).map((r, idx) => {
        // Natural deterministic key to guarantee idempotency
        const sanitizedItem = (r.itemName || `item_${idx}`).replace(/[^a-zA-Z0-9가-힣]/g, "_");
        const deterministicId = r.id || `${r.storeId}_${r.date}_${sanitizedItem}_${r.timeSlot || 'all'}`;

        return {
          id: deterministicId,
          date: r.date,
          store_id: r.storeId,
          store_name: r.storeName,
          category: r.category || "기타",
          item_code: r.itemCode || "N/A",
          item_name: r.itemName,
          quantity: Number(r.quantity) || 0,
          total_sales: Number(r.totalSales) || 0,
          discount: Number(r.discount) || 0,
          net_sales: Number(r.netSales) || 0,
          time_slot: r.timeSlot || "dinner",
          upload_id: r.uploadId || null
        };
      });

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

/**
 * Load Common Menu Mappings from Supabase
 */
export async function loadMenuMappingsFromSupabase() {
  try {
    const { data, error } = await supabase.from("common_menu_mappings").select("*").order("standard_name");
    if (error) throw error;
    if (data && data.length > 0) {
      return data.map(m => ({
        commonId: m.common_id,
        standardName: m.standard_name,
        category: m.category,
        costPrice: Number(m.cost_price) || 0,
        targetSellingPrice: Number(m.target_selling_price) || 0,
        aliases: m.aliases || []
      }));
    }
    return null;
  } catch (err) {
    console.warn("Supabase menu mappings load fallback:", err.message);
    return null;
  }
}

/**
 * Save Common Menu Mappings to Supabase
 */
export async function saveMenuMappingsToSupabase(mappings) {
  try {
    if (!mappings || mappings.length === 0) return;
    const formatted = mappings.map(m => ({
      common_id: m.commonId,
      standard_name: m.standardName,
      category: m.category || "기타",
      cost_price: m.costPrice || 0,
      target_selling_price: m.targetSellingPrice || 0,
      aliases: m.aliases || [],
      updated_at: new Date().toISOString()
    }));
    const { error } = await supabase.from("common_menu_mappings").upsert(formatted, { onConflict: "common_id" });
    if (error) throw error;
  } catch (err) {
    console.warn("Supabase menu mappings save error:", err.message);
  }
}

/**
 * Save Auto-Collection Run Record to Supabase
 */
export async function saveCollectionHistoryToSupabase(batchResult) {
  try {
    if (!batchResult) return;
    const row = {
      batch_id: batchResult.batchId,
      mode: batchResult.mode,
      executed_at: batchResult.executedAt || new Date().toISOString(),
      duration_ms: batchResult.durationMs || 0,
      stores_processed_count: batchResult.storesProcessedCount || 0,
      success_count: batchResult.successCount || 0,
      pending_count: batchResult.pendingCredentialsCount || 0,
      store_results: batchResult.storeResults || []
    };
    const { error } = await supabase.from("collection_history").upsert(row, { onConflict: "batch_id" });
    if (error) throw error;
  } catch (err) {
    console.warn("Supabase collection history save error:", err.message);
  }
}
