# ADR-0001: Authorization Model (RBAC + Status Gate)

- Status: Accepted
- Date: 2026-01-14
- Context: Order Friends MVP

---

## Context

Order Friends는 Brand / Branch 구조를 가지는 멀티 테넌트 서비스로,
사용자 접근 제어는 프로젝트 전반(DB, API, RLS, UX)에 영향을 미친다.

초기 설계 단계에서 다음과 같은 요구가 있었다.

- Brand 단위와 Branch 단위의 권한을 분리하고 싶다.
- 멤버 초대/정지/탈퇴 같은 상태 변화가 권한에 직접 영향을 미쳐야 한다.
- 브랜드 운영자는 지점 이슈에 빠르게 대응할 수 있어야 한다.
- Supabase(Postgres + RLS)를 사용하지만, MVP 단계에서는 과도한 RLS 복잡성을 피하고 싶다.

이에 따라 권한 모델을 명확히 정의하고,
이후 구현의 기준점으로 삼기 위해 본 결정을 기록한다.

---

## Decision

Order Friends는 다음의 권한 모델을 채택한다.

### 1. Authorization Pattern
- **RBAC(Role-Based Access Control)** + **Status Gate**
- 멤버십 status가 `ACTIVE`인 경우에만 role이 유효하다.

### 2. Role Separation
- Brand 단위 권한과 Branch 단위 권한을 분리한다.
- 각 단위는 독립적인 멤버십 테이블을 가진다.
  - brand_members
  - branch_members

### 3. Effective Role (Brand → Branch)
Branch 범위 요청 시 다음 규칙을 적용한다.

1. Branch 멤버십이 ACTIVE인 경우, branch_role을 우선 사용한다.
2. Branch 멤버십이 없을 경우 Brand 멤버십을 확인한다.
   - Brand OWNER / ADMIN → Branch BRANCH_ADMIN 수준으로 간주
   - Brand MANAGER → Branch STAFF 수준으로 간주
   - Brand MEMBER → 대체 권한 없음

상위 권한 대체는 DB row 생성이 아닌 **런타임 계산**으로 처리한다.

### 4. Status Model
모든 멤버십은 동일한 상태 체계를 사용한다.

- INVITED
- ACTIVE
- SUSPENDED
- LEFT

권한 판정 시 ACTIVE만 허용한다.

### 5. RLS Strategy (MVP)
- 권한 계산은 서버 또는 Edge Function에서 전담한다.
- Supabase RLS는 테넌트 경계 침범을 막는 **최소 안전망**으로 적용한다.
- Effective role 로직을 RLS에 과도하게 중복 구현하지 않는다.

---

## Alternatives Considered

### A. Full RLS-based Authorization
- 모든 권한 판단을 Postgres RLS에서 처리
- 장점: DB 레벨에서 강력한 보안
- 단점: 정책 복잡도 증가, 디버깅/유지보수 비용 상승, MVP 속도 저하

### B. Flat Permission Model (Brand only)
- Branch 권한을 Brand 권한으로 단순화
- 장점: 단순
- 단점: 지점 운영/현장 역할을 표현하기 어려움

---

## Consequences

### Positive
- 권한 로직이 단일 기준(authorize)으로 수렴
- Brand/Branch 운영 현실을 반영한 유연한 구조
- MVP 단계에서 구현/변경 비용 최소화

### Trade-offs
- 서버 권한 로직의 중요도가 높아짐
- 향후 DB 레벨 보안 강화를 원할 경우 RLS 정책 확장이 필요

---

## References
- docs/03-db-schema.md
- docs/02-architecture.md
