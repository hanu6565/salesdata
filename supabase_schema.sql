-- =========================================================================
-- (주)올이유 OKPOS 매장 데이터 분석 시스템 - 최적화 Supabase Database Schema
-- Supabase 대시보드 -> SQL Editor 에서 전체 실행(Run)해 주세요!
-- =========================================================================

-- 1. 매장 마스터 테이블 (stores)
CREATE TABLE IF NOT EXISTS public.stores (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT DEFAULT '기타',
    pos_site TEXT DEFAULT 'NICE OKPOS',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 매출 상세 테이블 (sales_records)
CREATE TABLE IF NOT EXISTS public.sales_records (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL,
    store_id TEXT REFERENCES public.stores(id) ON DELETE CASCADE,
    store_name TEXT NOT NULL,
    category TEXT DEFAULT '기타',
    item_code TEXT DEFAULT 'N/A',
    item_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 0,
    total_sales NUMERIC DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    net_sales NUMERIC DEFAULT 0,
    time_slot TEXT DEFAULT 'dinner', -- 'lunch', 'dinner', 'morning', 'late_night', 'other'
    upload_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 성능 최적화 복합 인덱스 (조회 속도 대폭 향상)
CREATE INDEX IF NOT EXISTS idx_sales_records_store_date ON public.sales_records(store_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_records_item_name ON public.sales_records(store_id, item_name);
CREATE INDEX IF NOT EXISTS idx_sales_records_date ON public.sales_records(date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_records_upload ON public.sales_records(upload_id);

-- 3. 엑셀 업로드 로그 테이블 (upload_logs)
CREATE TABLE IF NOT EXISTS public.upload_logs (
    id TEXT PRIMARY KEY,
    store_id TEXT,
    store_name TEXT NOT NULL,
    file_name TEXT NOT NULL,
    period TEXT NOT NULL,
    row_count INTEGER DEFAULT 0,
    upload_time TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT '정상 완료',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_upload_logs_time ON public.upload_logs(upload_time DESC);

-- 4. 원가 및 손익계산서 테이블 (cost_data)
CREATE TABLE IF NOT EXISTS public.cost_data (
    store_id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 공통 메뉴 표준화 매핑 사전 테이블 (common_menu_mappings)
CREATE TABLE IF NOT EXISTS public.common_menu_mappings (
    common_id TEXT PRIMARY KEY,
    standard_name TEXT NOT NULL,
    category TEXT DEFAULT '기타',
    cost_price NUMERIC DEFAULT 0,
    target_selling_price NUMERIC DEFAULT 0,
    aliases JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_mappings_name ON public.common_menu_mappings(standard_name);

-- 6. 일일 자동 수집 실행 로그 테이블 (collection_history)
CREATE TABLE IF NOT EXISTS public.collection_history (
    batch_id TEXT PRIMARY KEY,
    mode TEXT NOT NULL,
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    duration_ms INTEGER DEFAULT 0,
    stores_processed_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    pending_count INTEGER DEFAULT 0,
    store_results JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collection_history_exec ON public.collection_history(executed_at DESC);

-- 7. 3-Way 대조 및 데이터 품질 감사 로그 테이블 (data_quality_audits)
CREATE TABLE IF NOT EXISTS public.data_quality_audits (
    audit_id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    audit_date DATE NOT NULL,
    status TEXT DEFAULT 'NORMAL',
    daily_sales NUMERIC DEFAULT 0,
    item_sales NUMERIC DEFAULT 0,
    diff_amount NUMERIC DEFAULT 0,
    diff_rate NUMERIC DEFAULT 0,
    missing_gaps JSONB DEFAULT '[]'::jsonb,
    audited_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quality_audits_store_date ON public.data_quality_audits(store_id, audit_date DESC);

-- =========================================================================
-- Row Level Security (RLS) 정책 설정 (보안 및 접근 권한)
-- =========================================================================

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.common_menu_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_quality_audits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow public all on stores" ON public.stores;
    DROP POLICY IF EXISTS "Allow public all on sales_records" ON public.sales_records;
    DROP POLICY IF EXISTS "Allow public all on upload_logs" ON public.upload_logs;
    DROP POLICY IF EXISTS "Allow public all on cost_data" ON public.cost_data;
    DROP POLICY IF EXISTS "Allow public all on common_menu_mappings" ON public.common_menu_mappings;
    DROP POLICY IF EXISTS "Allow public all on collection_history" ON public.collection_history;
    DROP POLICY IF EXISTS "Allow public all on data_quality_audits" ON public.data_quality_audits;

    CREATE POLICY "Allow public all on stores" ON public.stores FOR ALL TO public USING (true) WITH CHECK (true);
    CREATE POLICY "Allow public all on sales_records" ON public.sales_records FOR ALL TO public USING (true) WITH CHECK (true);
    CREATE POLICY "Allow public all on upload_logs" ON public.upload_logs FOR ALL TO public USING (true) WITH CHECK (true);
    CREATE POLICY "Allow public all on cost_data" ON public.cost_data FOR ALL TO public USING (true) WITH CHECK (true);
    CREATE POLICY "Allow public all on common_menu_mappings" ON public.common_menu_mappings FOR ALL TO public USING (true) WITH CHECK (true);
    CREATE POLICY "Allow public all on collection_history" ON public.collection_history FOR ALL TO public USING (true) WITH CHECK (true);
    CREATE POLICY "Allow public all on data_quality_audits" ON public.data_quality_audits FOR ALL TO public USING (true) WITH CHECK (true);
END $$;
