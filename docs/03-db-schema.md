# Database Schema

본 문서는 Order Friends의 핵심 데이터 모델과
멀티 테넌트 권한 구조(Brand / Branch)를 정의한다.

---

## 1. Core Entities Overview

### Tenant Hierarchy
- **Brand**: 최상위 테넌트 단위 (사업자 / 브랜드)
- **Branch**: Brand 하위 운영 단위 (매장 / 지점)

### Identity & Membership
- **Auth User**: 인증 주체 (외부 Auth Provider)
- **Profile**: 사용자 프로필(표시명, 연락처 등)
- **Brand Member**: 사용자 ↔ Brand 소속/권한
- **Branch Member**: 사용자 ↔ Branch 소속/권한

---

## 2. ERD (Current)

```mermaid
erDiagram
  AUTH_USERS ||--|| PROFILES : "1:1 (uid)"
  PROFILES {
    uuid id PK
    text display_name
    text phone
    timestamptz created_at
  }

  BRANDS ||--o{ BRAND_MEMBERS : has
  PROFILES ||--o{ BRAND_MEMBERS : member_of
  BRANDS {
    uuid id PK
    text name
    uuid owner_user_id
    text biz_name
    text biz_reg_no
    timestamptz created_at
  }

  BRAND_MEMBERS {
    uuid brand_id FK
    uuid user_id FK
    brand_role role
    member_status status
    timestamptz created_at
  }

  BRANDS ||--o{ BRANCHES : has
  BRANCHES ||--o{ BRANCH_MEMBERS : has
  PROFILES ||--o{ BRANCH_MEMBERS : assigned

  BRANCHES {
    uuid id PK
    uuid brand_id FK
    text name
    timestamptz created_at
  }

  BRANCH_MEMBERS {
    uuid branch_id FK
    uuid user_id FK
    branch_role role
    member_status status
    timestamptz created_at
  }
