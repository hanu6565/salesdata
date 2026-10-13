# 📊 (주)올이유 OKPOS 매장 데이터 분석 및 손익 예측 시스템

> **프랜차이즈 7개 매장(포크팬, 금막창, 신영웅, 들안길금등어 등)의 POS 원천 데이터와 손익계산서를 통합 분석하고, 3-Way 교차 대조 및 데이터 품질 진단, 자동 수집 관제, 메뉴 ABC 포트폴리오를 제공하는 Next.js 16 기반 엔터프라이즈 BI 대시보드입니다.**

---

## ⚡ 주요 기능 및 최근 아키텍처

1. **3-Way 원본 대조 및 데이터 품질 진단 (Data Quality Engine)**
   - 일별 종합 매출 vs 상품별 판매 합계 vs 영수증별 결제 내역 3자 교차 검증 (오차 0원 검증).
   - 결측일·누락 구간(Gaps) 자동 탐지 및 데이터 무결성 건강도(100점 만점) 산출.
   - 업로드 전 사전 검증(Pre-upload Audit) 모달 제공.

2. **일일 자동 수집 관제탑 & POS 어댑터 규격 (Auto Collection Engine)**
   - KST 04:30 자동 스케줄링 (심야 마감정산 및 POS 서버 배치 완료 후 자동 실행).
   - 최근 14일 롤링 재확인(Rolling Audit)으로 취소·반품·지연 반영분 갱신.
   - 멱등성(Idempotent Upsert)을 보장하는 고유 자연키 기반 DB 적재.
   - 서버 자격증명 볼트(Credential Vault)로 비밀번호 클라이언트 노출 원천 차단.

3. **고도화 비교 분석 및 Dual ABC 메뉴 매트릭스**
   - 동일 경과일 대조(예: 8월 1~26일 vs 7월 1~26일) 및 동일 요일 가중치 보정.
   - 매출액 기여도(70/90%)와 판매량(70/90%)을 결합한 4분면(Star, Cash Cow, Volume, Drain) 분석.
   - 매장별 상이 표기 메뉴의 체인 표준 품목 매핑 사전(Common Menu Mapping).

4. **프랜차이즈 멀티 롤 권한 분리 (RBAC Guard)**
   - 본사 총괄 관리자(전 매장 및 종합 통계 조회) vs 매장 점주(본인 매장 전용 조회) 엄격 분리.

---

## 🚀 Vercel 배포 가이드 (Optimized for Vercel)

본 프로젝트는 Next.js 16 App Router와 Turbopack, Dynamic Import를 기반으로 Vercel 서버리스 환경에 최적화되어 있습니다.

### 1. Vercel 원클릭 연동
1. [Vercel 대시보드](https://vercel.com)에 로그인 후 **"Add New Project"** 클릭
2. GitHub 저장소(`salesdata`)를 Import
3. Framework Preset: **Next.js** 자동 감지 확인
4. **Environment Variables (환경 변수)** 설정에 아래 값 등록:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
   ```
5. **Deploy** 버튼 클릭! (약 1분 이내 전 세계 Edge CDN 배포 완료)

### 2. Vercel 성능 최적화 적용 내역
- **Dynamic Imports (`next/dynamic`)**: 무거운 차트 및 대시보드 뷰(`DataQualityView`, `OperationsAnalysisView`, `AutoCollectionView`, `ForecastingProfitabilityView` 등)를 온디맨드 청크로 분리하여 초기 번들 크기 대폭 감소.
- **Route Handler 런타임 제어**: `/api/collection/run`, `/api/collection/status`에 `export const dynamic = 'force-dynamic'`, `runtime = 'nodejs'` 적용으로 정적 캐시 오염 방지 및 서버리스 타임아웃 최적화.
- **`next.config.mjs` 패키지 트리쉐이킹**: `lucide-react`, `recharts` 패키지 import 최적화로 번들 크기 경량화.
- **보안 헤더 탑재**: `vercel.json`을 통한 XSS 및 Frame 보호 헤더 기본 적용.

---

## 🗄️ Supabase 데이터베이스 설정 가이드

### 1. 스키마 마이그레이션 실행
1. [Supabase 대시보드](https://supabase.com) 접속 후 프로젝트 생성
2. 좌측 메뉴 **SQL Editor** 클릭 -> **New query** 선택
3. 본 저장소의 [`supabase_schema.sql`](./supabase_schema.sql) 파일 내용을 전체 복사하여 붙여넣고 **Run (Ctrl + Enter)** 실행
4. 생성되는 테이블 및 인덱스:
   - `stores`: 7개 매장 기본 정보
   - `sales_records`: 상세 판매 데이터 (복합 인덱스: `store_id + date`, `store_id + item_name`)
   - `upload_logs`: 엑셀 업로드 이력
   - `cost_data`: 월별 원가 및 손익계산서 데이터
   - `common_menu_mappings`: 체인 공통 표준 메뉴 사전
   - `collection_history`: 자동 수집 실행 및 감사 이력
   - `data_quality_audits`: 3-Way 대조 이상치 진단 로그

### 2. 무결성 및 멱등성 보장
- `src/lib/supabase.js`의 `saveSalesToSupabase` 함수는 `${storeId}_${date}_${sanitizedItem}_${timeSlot}` 결정론적 고유 키를 기반으로 Upsert를 수행하므로, 엑셀을 중복 업로드하거나 수집 스케줄러가 재실행되어도 데이터가 중복 등록되지 않습니다.

---

## 🐙 GitHub Actions & CI 파이프라인

본 저장소는 [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)을 통해 지속적 통합(CI)이 구성되어 있습니다:
- `main`/`master` 브랜치에 코드를 푸시하거나 Pull Request를 생성할 때마다:
  1. Node.js 20 런타임 환경 구성
  2. `npm ci`로 의존성 무결성 검증
  3. `npm run lint`로 ESLint 코드 스타일 및 React 규칙 검증
  4. `npm run build`로 Next.js 프로덕션 빌드 성공 여부 검증
- 이를 통해 GitHub에 머지되는 모든 코드가 Vercel 배포 시 100% 빌드 성공을 보장합니다.

---

## 💻 로컬 개발 환경 실행

```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env.local
# .env.local 파일에 본인의 Supabase 키 입력

# 개발 서버 실행 (Turbopack)
npm run dev

# 프로덕션 빌드 테스트
npm run build
npm run start
```
