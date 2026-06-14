# Overview

Order Friends는 브랜드와 셀러가 온라인샵을 열고 상품 판매, 주문 접수,
결제/입금, 재고, 정산을 한 곳에서 운영할 수 있도록 돕는 온라인마켓 운영
플랫폼이다.

이 제품은 테이블오더 서비스가 아니다. `Branch`는 내부 데이터 모델에서는
유지하지만, 제품 언어에서는 매장 내 테이블 주문보다 스토어, 출고지, 판매 채널
개념에 가깝게 다룬다. 공동구매/캠페인 판매는 향후 확장 옵션으로 보류한다.

---

## 1. Product Intent
- 브랜드/셀러 단위로 상품, 주문, 결제, 정산 데이터를 분리한다(Brand tenancy).
- 스토어/출고지/판매 채널 단위 운영을 지원한다(Branch operations).
- 고객은 공개 온라인샵 또는 주문 링크에서 상품을 선택하고 주문한다.
- 운영자는 멤버십 기반 권한(RBAC + Status Gate)으로 안전하게 협업한다.

---

## 2. Core Concepts
- **Auth User**: 인증 주체(예: Supabase Auth)
- **Profile**: 사용자 프로필(표시명/연락처 등)
- **Brand**: 최상위 테넌트(브랜드/셀러/사업자)
- **Branch**: Brand 하위 운영 단위(스토어/출고지/판매 채널)
- **Brand Member**: user ↔ brand 소속/권한/상태
- **Branch Member**: user ↔ branch 소속/권한/상태
- **Online Shop**: 브랜드 공개 판매 페이지(`/shop/:brandSlug`)
- **Order Link / Order Page**: 스토어/채널별 온라인 주문 링크와 주문 화면

---

## 3. Tenancy & Authorization Summary
- 모든 데이터는 Brand 또는 Branch의 테넌트 경계를 가진다.
- 접근 제어는 멤버십 기반으로 수행한다.
- Status Gate: `ACTIVE`만 권한 유효, 그 외(INVITED/SUSPENDED/LEFT)는 차단.
- Branch 권한은 기본적으로 `branch_members`를 우선하며,
  필요 시 Brand 상위 권한을 Branch로 대체(effective role)한다.

---

## 4. MVP Scope (Phase 1)
- Brand/Branch CRUD (브랜드, 스토어/출고지 핵심 필드 중심)
- 공개 온라인샵과 주문 링크
- 상품/카테고리 관리
- 주문 접수, 주문 상태 관리, 결제/입금 운영
- 기본 재고, 판매 분석, 정산 조회
- 멤버십 초대/활성/정지/해제 플로우
- RLS 최소 안전망 + 서버 권한 전담 구조 확립

---

## 5. Non-Goals (Phase 1 Out)
- 복잡한 정산/세무 자동화
- 외부 PG/배달플랫폼 연동
- 재고/원가/발주 고도화
- 테이블오더, 좌석/테이블 단위 주문, 홀 운영 중심 UX
- 공동구매 전용 캠페인 운영(향후 온라인마켓 확장 기능으로 검토)

---

## 6. Quality Attributes
- **Security**: 테넌트 경계 강제, 최소 권한
- **Auditability**: 멤버십 변경은 상태 전이로 기록
- **Scalability**: 멤버십/권한 체크가 빈번하므로 인덱스 최적화
- **Maintainability**: 권한 로직(Authorize)을 단일 모듈로 중앙화
