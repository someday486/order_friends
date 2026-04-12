# Order Friends 종합 진단 - 2026-04-03

## 문서 성격
- 상태: `research`
- 목적: 코드베이스 리스크를 우선순위 기준으로 정리하고, 배치별 개선 진행 상황을 추적하기 위한 감사 스냅샷
- 기준 시점: 2026-04-12 `develop`

## 현재 상태 요약
- 전체 상태: `부분 완료`
- 완료된 배치
  - 배치 1: 내부 재무성 테이블 RLS 보강, 공개 주문/결제 경로 조사
  - 배치 2: `/admin`, `(protected)` 접근 제어 보강, Toss webhook timestamp 검증
  - 배치 3: 공개 주문/결제 E2E 추가, 결제 상태 트리거 canonical migration 추가, CI migration/API contract 가드 추가
  - 배치 4: 레거시 `public` 모듈 제거, OpenAPI 타입 생성 파이프라인 추가, generated 타입의 프론트 1차 연동
- 남은 핵심 후속 작업
  - `/admin/orders` 멀티테넌트 스코핑 재검증
  - 환불, 주문 상태 전이, 입금확인 E2E 확대
  - generated 타입의 프론트 적용 범위 확대
  - 역할 모델 문서와 DB 실제 역할 값 정리

## 우선순위 기준

### 확정 취약점
- 현재 운영 환경에서 데이터 노출, 권한 우회, 민감 정보 노출로 직접 이어질 수 있는 항목

### 재검증 필요
- 위험 신호는 있지만 실제 사용 경로와 운영 조건을 더 확인해야 확정할 수 있는 항목

### 구조적 위험
- 당장 사고로 이어지지 않더라도, 향후 운영 리스크와 유지보수 비용을 높이는 구조적 부채

## 배치별 진행 현황

### 배치 1 - 공개 주문 경로 및 RLS 보강
- 상태: `완료`
- 완료 항목
  - `deposit_match_rows`, `cash_receipts`에 RLS 및 멤버 정책 적용
  - `brand_products`, `order_channels`, `procurement_*` 기본 조회 정책 추가
  - 공개 주문/결제 실사용 경로 조사
  - 미사용 공개 결제 상태 조회 엔드포인트 `GET /payments/:orderId/status` 제거
- 판단 메모
  - 현재 실사용 공개 주문 흐름은 `PublicOrderModule` 기준으로 수렴
  - `PublicModule`은 레거시 경로로 분류 가능

### 배치 2 - 프론트 접근 제어 및 webhook 방어
- 상태: `완료`
- 완료 항목
  - `/admin` 레이아웃을 system admin 기준으로 제한
  - `(protected)` 레이아웃을 실제 활성 멤버십 기준으로 제한
  - Toss webhook timestamp 검증 추가
  - `TOSS_WEBHOOK_MAX_AGE_SECONDS` 환경변수 문서화

### 배치 3 - 자동 검증과 migration governance
- 상태: `완료`
- 완료 항목
  - 공개 주문/결제 E2E 테스트 추가
  - webhook DTO 검증 보강
  - `update_order_payment_status()` canonical migration 추가
  - `scripts/check-migration-governance.js` 추가
  - `scripts/export-openapi.ts` 추가
  - CI에 `Migration Governance`, `API Contracts` 잡 추가
  - backend build가 `web`, `migration-governance`, `api-contracts`를 선행 통과하도록 의존성 강화

### 배치 4 - 공개 모듈 정리와 타입 공유
- 상태: `완료`
- 완료 항목
  - 레거시 `PublicModule` 및 관련 DTO, 서비스, 테스트 제거
  - `PublicModule`이 다시 `AppModule`에 연결되지 않도록 고정 테스트 유지
  - `openapi-typescript` 기반 타입 생성 파이프라인 추가
  - `apps/web/src/types/common.ts`가 generated 타입을 재사용하도록 연결
  - 매장 설정, 주문 체크아웃, 주문 추적 화면 일부가 generated 기반 공통 타입을 사용하도록 정리
  - 역할 enum이 정규화된 앱 권한 역할이라는 점을 코드 주석으로 명시
- 남은 항목
  - generated 타입의 프론트 적용 범위 확대
  - 역할 모델 문서와 DB 실제 역할 값 비교 정리

## 항목별 상태

### 1. `deposit_match_rows`, `cash_receipts` RLS 부재
- 상태: `완료`
- 결과
  - RLS 및 조회 정책 적용 완료

### 2. 공개 주문 조회 정책 과도 개방 가능성
- 상태: `조사 완료`
- 결과
  - 운영 DB 기준 `orders_select_customer_own`, `orders_select_members` 정책 확인
  - 실사용 공개 주문 경로가 백엔드 `public-order` 서비스 경유임을 확인
- 후속
  - 주문 추적 키 정책을 더 강하게 조일지 여부는 공개 주문 UX 변경과 함께 검토

### 3. `/admin` 프론트 레이아웃 역할 검증
- 상태: `완료`

### 4. `/admin/orders` 멀티테넌트 스코핑
- 상태: `미착수`
- 메모
  - `AdminGuard` 허용 범위를 운영 역할 기준으로 재확인해야 함

### 5. 사용자 요청 경로의 `adminClient()` 사용
- 상태: `진행 중`
- 메모
  - 시스템 작업과 사용자 요청을 분리하는 원칙은 정리됐지만, 서비스 계층 전면 정리는 아직 남음

### 6. 공개 결제 상태 조회 엔드포인트
- 상태: `완료`
- 결과
  - 미사용 공개 엔드포인트 제거 완료

### 7. Toss webhook replay 방어
- 상태: `완료`

### 8. 재고 예약 / 스탬프 적립 연결 방식
- 상태: `미착수`
- 메모
  - 트리거 부재 자체보다, 애플리케이션 레벨 보장 여부와 테스트 공백을 먼저 확인해야 함

### 9. 결제 상태 트리거 drift
- 상태: `완료`
- 결과
  - canonical migration과 CI governance 추가

### 10. 고위험 비즈니스 흐름 E2E 공백
- 상태: `부분 완료`
- 완료 범위
  - 공개 주문/결제 경로 E2E 추가
- 남은 범위
  - 환불, 주문 상태 전이, 입금확인, 권한 경계 E2E 확대

### 11. `public` vs `public-order` 모듈 중복
- 상태: `완료`
- 결과
  - 활성 경로는 `public-order`로 확정
  - 레거시 `public` 모듈, DTO, 전용 테스트 제거

### 12. 프론트-백엔드 타입 공유 부재
- 상태: `진행 중`
- 완료 범위
  - OpenAPI export/generation/check 파이프라인 구축
  - generated 타입을 공통 타입과 일부 프론트 화면에서 재사용하도록 연결
- 남은 범위
  - 수동 타입 정의가 많은 화면으로 적용 범위 확대

### 13. 역할 모델 문서-코드 불일치
- 상태: `진행 중`
- 결과
  - enum 주석으로 정규화 역할 개념을 명시
- 남은 범위
  - 문서와 DB 실제 역할 값을 한 표로 정리

## 다음 권장 순서
1. `/admin/orders` 멀티테넌트 스코핑 재검증
2. 환불 / 주문 상태 전이 / 입금확인 E2E 확대
3. generated 타입의 프론트 적용 범위 확대
4. 역할 모델 문서 정합성 정리
