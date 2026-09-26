-- =========================================================================
-- (주)올이유 OKPOS 매장 데이터 분석 시스템 - Supabase Database Schema
-- Supabase 대시보드 -> SQL Editor 에서 이 전체 쿼리를 복사하여 실행(Run)해 주세요!
-- =========================================================================

-- 1. 매장 테이블 (stores)
CREATE TABLE IF NOT EXISTS public.stores (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT DEFAULT '기타',
    created_at TIMESTAMPTZ DEFAULT NOW()
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
    time_slot TEXT DEFAULT 'dinner', -- 'morning', 'lunch', 'dinner', 'other'
    upload_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_records_store_date ON public.sales_records(store_id, date);
CREATE INDEX IF NOT EXISTS idx_sales_records_item_name ON public.sales_records(item_name);

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

-- 4. 원가 및 손익계산서 테이블 (cost_data)
CREATE TABLE IF NOT EXISTS public.cost_data (
    store_id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- Row Level Security (RLS) 정책 설정 (익명/웹 접근 허용)
-- =========================================================================

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_data ENABLE ROW LEVEL SECURITY;

-- 모든 사용자에게 읽기 및 쓰기 권한 부여 (Anon & Authenticated)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow public all on stores" ON public.stores;
    DROP POLICY IF EXISTS "Allow public all on sales_records" ON public.sales_records;
    DROP POLICY IF EXISTS "Allow public all on upload_logs" ON public.upload_logs;
    DROP POLICY IF EXISTS "Allow public all on cost_data" ON public.cost_data;

    CREATE POLICY "Allow public all on stores" ON public.stores FOR ALL TO public USING (true) WITH CHECK (true);
    CREATE POLICY "Allow public all on sales_records" ON public.sales_records FOR ALL TO public USING (true) WITH CHECK (true);
    CREATE POLICY "Allow public all on upload_logs" ON public.upload_logs FOR ALL TO public USING (true) WITH CHECK (true);
    CREATE POLICY "Allow public all on cost_data" ON public.cost_data FOR ALL TO public USING (true) WITH CHECK (true);
END $$;
