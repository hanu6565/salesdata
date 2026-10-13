// src/lib/autoCollection/apiAudit.js
// 공식 API / 정기 파일 제공 / 웹 다운로드 기술 검토서 및 연동 감사 현황

export const API_PROTOCOL_AUDIT = {
  MY_OKPOS_ERP_API: {
    title: "MY OKPOS ERP 표준 API (오케이포스 공식)",
    vendor: "(주)오케이포스",
    docReference: "MY OKPOS OpenAPI v2.1 규격서",
    status: "UNVERIFIED_CONTRACT_PENDING", // 연동 미확인 (계약·비용·서버 미확인)
    statusLabel: "검토 진행 중 (공식 연동 미완료)",
    scopeCheck: {
      serverUrl: "미확정 (가맹점별 ERP 라이선스 서버 여부 확인 필요)",
      contractCost: "유료 ERP 부가서비스 계약 필요 여부 미확인",
      providedItems: "일자별 매출 요약(제공 예상), 영수증 상세(일부 미지원 우려)",
      historicalRange: "최대 30일~90일 제한 가능성 확인 필요"
    },
    accountsApplicable: [
      { site: "NICE OKPOS", store: "신영웅 성서점", supported: false, reason: "NICE 가맹점 웹 로그인 계정으로 ERP API 직접 호출 불가 (API Key 미발급)" },
      { site: "NICE OKPOS", store: "포크팬 복현", supported: false, reason: "API 사용 계약 미체결" },
      { site: "NICE OKPOS", store: "금막창 범어점", supported: false, reason: "API 사용 계약 미체결" },
      { site: "OKASP OKPOS", store: "금막창 종로", supported: false, reason: "OKASP 계정은 웹 ASP 포털 전용" },
      { site: "OKASP OKPOS", store: "금막창 월성", supported: false, reason: "OKASP 계정 전용" },
      { site: "OKASP OKPOS", store: "고기9단", supported: false, reason: "OKASP 계정 전용" }
    ],
    recommendation: "공식 API 계약 비용 및 지원 범위가 확정되기 전까지는 '연동 완료'로 표기하지 않으며, 현재 실제 작동이 입증된 브라우저 자동화 XLS 다운로드 파이프라인을 1순위로 채택함."
  },

  EASYPOS_SMART_API: {
    title: "EasyPOS 스마트 정산 연동 API",
    vendor: "한국정보통신(KICC) EasyPOS",
    docReference: "EasyPOS Smart Web Interface",
    status: "UNVERIFIED_CREDENTIALS_PENDING",
    statusLabel: "검토 진행 중 (공식 연동 미완료)",
    scopeCheck: {
      serverUrl: "https://smart.easypos.net/",
      contractCost: "POS 단말 대리점 승인 필요",
      providedItems: "일자별 매출, 품목별 매출",
      historicalRange: "최근 1년 조회 가능 (웹 기준)"
    },
    accountsApplicable: [
      { site: "EasyPOS", store: "들안길금등어 본점(들안길)", supported: false, reason: "웹 로그인 정보 및 대리점 API 연동키 미확보 상태" }
    ],
    recommendation: "들안길금등어 본점의 웹 로그인 계정 확보 시 자동 수집 어댑터가 즉시 가동될 수 있도록 수집 파서 사전 구축 완료."
  },

  NICE_OKPOS_WEB_XLS: {
    title: "NICE OKPOS 포털 자동 XLS 수집 파이프라인",
    vendor: "NICE정보통신 / OKPOS",
    docReference: "nice.okpos.co.kr 가맹점 관리자",
    status: "VERIFIED_OPERATIONAL", // 실증 완료!
    statusLabel: "실증 완료 (실제 XLS 다운로드 작동 확인)",
    scopeCheck: {
      serverUrl: "https://nice.okpos.co.kr/",
      contractCost: "추가 비용 0원 (기존 가맹점 계정 활용)",
      providedItems: "일별종합, 일자별 상품별, 영수증별 상세 (3종 전체 확보 가능)",
      historicalRange: "과거 전체 기간 (2024~2026년) 엑셀 다운로드 지원 확인"
    },
    accountsApplicable: [
      { site: "NICE OKPOS", store: "신영웅 성서점", supported: true, reason: "실제 일별종합, 상품별, 영수증별 XLS 다운로드 검증 완료" },
      { site: "NICE OKPOS", store: "포크팬 복현", supported: "READY", reason: "NICE 규격 어댑터 파서 준비 완료 (계정 등록 대기)" },
      { site: "NICE OKPOS", store: "금막창 범어점", supported: "READY", reason: "NICE 규격 어댑터 파서 준비 완료 (계정 등록 대기)" }
    ],
    recommendation: "신영웅 성서점에서 검증된 다운로드 셀렉터와 파일 파서를 기반으로 포크팬 및 금막창 범어점에 동일 규격 적용."
  },

  OKASP_WEB_XLS: {
    title: "OKASP 웹 포털 자동 XLS 수집 파이프라인",
    vendor: "(주)오케이포스 ASP 사업부",
    docReference: "okasp.okpos.co.kr 웹 관리자",
    status: "ADAPTER_READY",
    statusLabel: "어댑터 준비 완료 (계정 등록 대기)",
    scopeCheck: {
      serverUrl: "https://okasp.okpos.co.kr/",
      contractCost: "추가 비용 0원",
      providedItems: "일별매출집계, 상품별매출, 영수증상세조회",
      historicalRange: "최대 3년"
    },
    accountsApplicable: [
      { site: "OKASP OKPOS", store: "금막창 종로", supported: "READY", reason: "심야영업(02:00) 마감반영 어댑터 준비 완료" },
      { site: "OKASP OKPOS", store: "금막창 월성", supported: "READY", reason: "어댑터 준비 완료" },
      { site: "OKASP OKPOS", store: "고기9단", supported: "READY", reason: "어댑터 준비 완료" }
    ],
    recommendation: "OKASP 전용 웹 세션 로그인 및 리포트 내보내기 자동화 어댑터 장착 완료."
  }
};
