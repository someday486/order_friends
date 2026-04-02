# Architecture

---

## 1. High-level
- Backend: Supabase(Postgres + Auth + RLS) 기반
- Business logic / Authorization: 서버(또는 Supabase Edge Functions)에서 전담
- RLS: 테넌트 경계 위반을 막는 최소 안전망으로 적용(MVP)

---

## 2. Tenancy Model
- Brand: 최상위 테넌트
- Branch: Brand 하위
- 모든 도메인 테이블은 궁극적으로 brand_id 또는 branch_id(또는 둘 다)로 스코프가 명확해야 한다.

---

## 3. Authorization Strategy
### 3.1 SSOT
권한 로직은 단일 모듈(authorize)로 중앙화한다.
- 입력: user_id, brand_id/branch_id, action
- 상태: ACTIVE만 유효
- Branch 요청은 branch_members 우선, 이후 brand_members로 effective role 계산

### 3.2 RLS (MVP)
- 서버를 우회한 접근 방지 목적
- RLS에서 “세부 role 판정”까지 강제하지 않고,
  최소한 “테넌트 범위를 벗어난 데이터 접근”을 차단한다.

---

## 4. Data Access Pattern
- 서버/함수에서 요청 → user_id 확보(auth)
- authorize()로 권한 확인
- DB 쿼리에 tenant filter(brand_id/branch_id) 강제
- RLS는 최종 안전망

---

## 5. Deployment Notes (초안)
- Supabase Project 분리: dev / prod 환경 권장
- DB migration은 SQL 기반으로 버전 관리 권장(supabase migrations)

## Authentication

Authentication architecture and usage rules are defined in:

- [Auth Foundation](./auth-foundation.md)