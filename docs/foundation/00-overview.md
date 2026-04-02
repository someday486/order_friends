# Overview

Order Friends는 Brand/Branch 멀티 테넌트 구조에서 주문/운영 업무를 표준화하고,
권한/멤버십을 기반으로 안전하게 협업할 수 있도록 하는 운영 관리 서비스이다.

---

## 1. Product Intent
- 브랜드(사업자) 단위로 운영 데이터를 분리하고(Brand tenancy)
- 매장/지점 단위 운영을 지원하며(Branch operations)
- 멤버십 기반 권한(RBAC + Status Gate)으로 접근을 통제한다.

---

## 2. Core Concepts
- **Auth User**: 인증 주체(예: Supabase Auth)
- **Profile**: 사용자 프로필(표시명/연락처 등)
- **Brand**: 최상위 테넌트(브랜드/사업자)
- **Branch**: Brand 하위 운영 단위(지점/매장)
- **Brand Member**: user ↔ brand 소속/권한/상태
- **Branch Member**: user ↔ branch 소속/권한/상태

---

## 3. Tenancy & Authorization Summary
- 모든 데이터는 Brand 또는 Branch의 테넌트 경계를 가진다.
- 접근 제어는 멤버십 기반으로 수행한다.
- Status Gate: `ACTIVE`만 권한 유효, 그 외(INVITED/SUSPENDED/LEFT)는 차단.
- Branch 권한은 기본적으로 `branch_members`를 우선하며,
  필요 시 Brand 상위 권한을 Branch로 대체(effective role)한다.

---

## 4. MVP Scope (Phase 1)
- Brand/Branch CRUD (핵심 필드 중심)
- 멤버십 초대/활성/정지/해제 플로우
- RLS 최소 안전망 + 서버 권한 전담 구조 확립
- 주문/결제/정산은 “확장 가능한 스키마 설계 레일”까지만 확보

---

## 5. Non-Goals (Phase 1 Out)
- 복잡한 정산/세무 자동화
- 외부 PG/배달플랫폼 연동
- 재고/원가/발주 고도화

---

## 6. Quality Attributes
- **Security**: 테넌트 경계 강제, 최소 권한
- **Auditability**: 멤버십 변경은 상태 전이로 기록
- **Scalability**: 멤버십/권한 체크가 빈번하므로 인덱스 최적화
- **Maintainability**: 권한 로직(Authorize)을 단일 모듈로 중앙화
