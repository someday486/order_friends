# 결제 체계 이원화 통합 명세서

작성일: 2026-04-13
상태: Draft v1
문서 성격: Phase 0~3 통합 로드맵 및 실행 기준서
현재 유지 문서:

- `docs/specs/payment-billing-tiers-master-spec-2026-04-13.md`
- `docs/specs/payment-billing-tiers-phase0-spec-2026-04-13.md`
- `docs/specs/payment-billing-tiers-phase1-spec-2026-04-13.md`
- `docs/specs/payment-billing-tiers-phase2-spec-2026-04-13.md`
- `docs/specs/payment-billing-tiers-phase3-spec-2026-04-13.md`

## 1. 문서 목적

이 문서는 결제 체계를 PG 이용 고객과 비이용 고객으로 이원화하는 전체 설계의 통합 기준서다.

이 문서는 아래 질문에 답하기 위해 존재한다.

- 현재 결제 구조에서 무엇이 바뀌는가
- PG 이용 고객과 비이용 고객의 차이는 무엇인가
- 각 Phase는 무엇을 추가하고 무엇을 미루는가
- Phase 간 의존성은 무엇인가
- 과금 체계는 어떻게 작동하는가

## 2. 제품 비전

현재 Order Friends는 결제수단을 CARD(토스페이먼츠)와 TRANSFER(계좌이체)로 구분하고, 브랜드/매장 단위로 허용 결제수단을 배열로 관리한다.

이를 **브랜드 가입 시점에 결정되는 과금 체계**로 전면 재구성한다.

- **PG 이용 고객** (PG 티어): 토스페이먼츠를 통해 카드, 가상계좌, 모바일 결제 등을 제공. Order Friends가 판매 건당 매출의 일정 %를 수수료로 수취.
- **비이용 고객** (Non-PG 티어): 구매자가 매장/브랜드의 계좌번호를 보고 직접 이체. 브랜드는 Order Friends에 월 구독료를 자동 결제.

## 3. 현재 상태 분석

### 3.1 데이터 모델

| 테이블/컬럼 | 현재 값 | 비고 |
| --- | --- | --- |
| `brands.shop_payment_methods` | TEXT[] `['CARD','TRANSFER','CASH']` | CHECK: CARD, TRANSFER, CASH |
| `branches.allowed_payment_methods` | TEXT[] `['CARD','TRANSFER']` | CHECK: CARD, TRANSFER |
| `branches` JSONB 필드 | `transfer_account` (bankName, accountNumber, accountHolder) | 수동 이체 시 고객에게 노출 |
| `payments` 테이블 | provider: TOSS/STRIPE/MANUAL, status, amount 등 | 주문별 1:1 결제 추적 |
| `payment_webhook_logs` | 웹훅 이벤트 감사 로그 | provider별 |

### 3.2 결제 플로우 (현재)

1. 고객이 주문 시 결제수단 선택 (CARD 또는 TRANSFER)
2. CARD: 토스페이먼츠 위젯 → confirm → 결제 완료
3. TRANSFER: 주문 생성 후 매장 계좌정보 표시 → 고객이 수동 이체 → 입금 확인

### 3.3 Toss Payments 연동 현황

- 플랫폼 단일 가맹점 키 (`TOSS_SECRET_KEY`, `TOSS_CLIENT_KEY`)
- `TossPaymentsClient`: confirm, cancel, webhook 서명 검증
- 위젯 연동 완료

### 3.4 공개 주문 DTO

- `PaymentMethod` enum: `CARD`, `TRANSFER`
- `FulfillmentType` enum: `PICKUP`, `DELIVERY`, `DINE_IN`, `SHIPPING`

## 4. 용어 정의

| 용어 | 정의 |
| --- | --- |
| **PG 티어** | 토스페이먼츠를 통해 결제를 처리하는 브랜드. 판매 건당 수수료(%) 부과 |
| **Non-PG 티어** | 계좌이체 전용 브랜드. 월 구독료 자동 결제 |
| **수수료 (Commission)** | PG 티어 브랜드에 부과하는 판매 건당 매출 비율 |
| **구독료 (Subscription)** | Non-PG 티어 브랜드에 부과하는 월 정액 이용료 |
| **정산 (Settlement)** | PG 결제 대금에서 수수료를 차감 후 브랜드에 지급하는 프로세스 |
| **빌링키 (Billing Key)** | 토스 빌링 API로 발급하는 자동 결제용 키. Non-PG 구독료 청구에 사용 |
| **수수료 구간 (Commission Tier)** | 월 매출 규모에 따라 차등 적용되는 수수료율 구간 |

## 5. Non-PG 비용 체계

### 5.1 요금제

| 플랜 | 월 주문 한도 | 월 이용료 | 대상 |
| --- | --- | --- | --- |
| **Starter** | 100건 | ₩33,000 | 단일 매장 소규모 자영업 |
| **Growth** | 500건 | ₩44,000 | 다매장 또는 중간 규모 |
| **Pro** | 무제한 | ₩55,000 | 고주문량 프랜차이즈 |

### 5.2 체험 기간

- 14일 무료 (빌링키 등록 필수)
- 체험 중 구독 상태: TRIAL
- 14일 후 Starter 플랜으로 첫 자동 결제

### 5.3 초과 주문 정책

- 한도 초과 시 주문 차단하지 않음
- 3개월 연속 초과 시 자동 업그레이드 (사전 알림)

## 6. 확정된 설계 결정

| # | 결정 | 근거 |
| --- | --- | --- |
| D1 | 결제 모드 선택 단위는 **브랜드** | 산하 모든 매장에 동일 적용. 과금 체계 단순화 |
| D2 | PG 키는 **플랫폼 단일** 토스 가맹점 | Order Friends가 결제를 대행하고 정산. 브랜드별 가맹점 등록 불필요 |
| D3 | `billing_tier`는 **가입 시 결정, 이후 변경 불가** | 변경 시 정산/빌링 오버랩 발생. 변경 필요 시 관리자 개입 |
| D4 | CASH(현장 결제) **완전 폐지** | 온라인 주문 플랫폼으로 현금 결제 불필요 |
| D5 | 기존 CARD+TRANSFER 브랜드 → PG 전환 시 **TRANSFER 제거 OK** | 수동 이체 경험 제거. 토스 가상계좌로 대체하지 않음 |
| D6 | Non-PG 월 이용료는 **토스 빌링 자동 결제** | 브랜드 가입 시 카드 등록 → 매월 자동 청구 |
| D7 | PG 수수료율은 **매출 규모 기반 차등 적용** | `commission_tiers` 테이블로 구간별 관리 |
| D8 | `deposit_match_rows` 시스템 **Non-PG 티어에서 유지** | 입금 확인 워크플로우 그대로 사용 |
| D9 | 기존 브랜드는 **전부 PG로 배정** | Non-PG는 신규 가입자부터만 적용. 기존 운영 중단 방지 |

## 7. 공통 도메인 모델

### 브랜드 과금 영역 (신규)

- `BillingTier` — PG / NON_PG (브랜드 레벨, 불변)
- `CommissionTier` — 매출 구간별 수수료율 정의
- `SubscriptionPlan` — 구독 요금제 정의
- `BrandSubscription` — 브랜드별 구독 상태
- `BillingRecord` — 구독 결제 이력

### 정산 영역 (신규)

- `SettlementPeriod` — 정산 기간 단위 (월)
- `SettlementLineItem` — 결제별 정산 상세

### 기존 유지

- `Payment` — 주문별 결제 레코드 (provider/status/amount)
- `PaymentWebhookLog` — 웹훅 감사 로그

## 8. 공통 상태 모델

### 구독 상태 (BrandSubscription.status)

- `ACTIVE` — 정상 구독 중
- `PAST_DUE` — 결제 실패, 유예 기간
- `CANCELLED` — 해지됨
- `TRIAL` — 체험 기간 (선택적)

### 빌링 레코드 상태 (BillingRecord.status)

- `PENDING` — 청구 예정
- `SUCCESS` — 결제 완료
- `FAILED` — 결제 실패
- `REFUNDED` — 환불됨

### 정산 기간 상태 (SettlementPeriod.status)

- `PENDING` — 기간 진행 중
- `CALCULATED` — 집계 완료
- `SETTLED` — 정산 완료 (입금 확인)

## 9. Phase 맵

### Phase 0: 데이터 모델 + 마이그레이션

- `brands` 테이블에 `billing_tier`, `commission_rate` 추가
- 구독/빌링/정산 테이블 생성
- `commission_tiers` 테이블 생성
- 기존 브랜드 데이터 마이그레이션 (CASH 제거, 티어 배정)
- CHECK constraint 업데이트

### Phase 1: PG 티어 주문 플로우

- PG 브랜드 주문 시 토스 위젯 전용 (TRANSFER 제거)
- 주문 생성 시 tier 기반 paymentMethod 유효성 검증
- 결제 성공 시 settlement_line_items 생성
- 프론트엔드 체크아웃 UI 분기

### Phase 2: Non-PG 구독 빌링

- 브랜드 생성 시 `billingTier` 선택
- Non-PG 선택 시 토스 빌링키 발급 (카드 등록)
- 월 자동 결제 배치 잡
- 실패 재시도 + 유예 정책
- 관리자/브랜드 오너 빌링 관리 UI

### Phase 3: PG 정산 시스템

- 월별 정산 기간 자동 생성
- 매출 구간별 수수료 자동 계산
- 정산 보고서 생성
- 관리자 수동 정산 확인 → SETTLED 처리

## 10. Phase 간 의존성

```
Phase 0 (데이터 기반)
  │
  ├──→ Phase 1 (PG 주문 플로우)  ──→ Phase 3 (PG 정산)
  │
  └──→ Phase 2 (Non-PG 구독 빌링)
```

- Phase 0은 **모든 Phase의 전제**
- Phase 1과 Phase 2는 **병렬 진행 가능**
- Phase 3은 Phase 1 완료 후 진행 (PG 결제 데이터 필요)

## 11. 제품 원칙

1. 브랜드 가입 시점에 과금 모델을 결정하고, 이후 모든 결제 경험이 이에 종속된다.
2. PG 티어 고객에게는 토스페이먼츠가 제공하는 다양한 결제수단을 그대로 노출한다.
3. Non-PG 티어 고객에게는 계좌이체라는 단순한 경험을 유지한다.
4. 과금(수수료/구독료)은 플랫폼의 수익 모델이다. 투명하고 추적 가능해야 한다.
5. 매출 규모가 커지는 브랜드에게 수수료 인센티브를 제공한다 (차등 수수료).
6. 정산과 빌링은 감사 가능한 레코드를 남긴다.

## 12. 영향 범위 요약

### 고위험 영역 (CLAUDE.md 기준)

- **결제** (payments): 전체 재구성
- **인증/인가** (auth): 브랜드 온보딩 플로우 변경
- **DB 마이그레이션**: 다수 테이블 생성/변경
- **주문 상태 전이**: 티어별 결제 확인 방식 차이

### 영향받는 주요 파일

| 영역 | 파일 |
| --- | --- |
| 결제 서비스 | `src/modules/payments/payments.service.ts` |
| 결제 DTO | `src/modules/payments/dto/payment.dto.ts` |
| Toss 클라이언트 | `src/modules/payments/toss-payments.client.ts` |
| 공개 주문 서비스 | `src/modules/public-order/public-order.service.ts` |
| 공개 주문 DTO | `src/modules/public-order/dto/public-order.dto.ts` |
| 공개 샵 DTO | `src/modules/public-order/dto/public-shop.dto.ts` |
| 체크아웃 (branch) | `apps/web/src/app/order/branch/[branchId]/checkout/page.tsx` |
| 체크아웃 (shop) | `apps/web/src/app/order/[brandSlug]/[branchSlug]/checkout/page.tsx` |
| 주문 추적 | `apps/web/src/app/order/track/[orderId]/page.tsx` |
| DB 마이그레이션 | `supabase/migrations/` (신규 파일 다수) |

### 신규 모듈

| 모듈 | Phase | 목적 |
| --- | --- | --- |
| `src/modules/billing/` | Phase 2 | Non-PG 구독 빌링 |
| `src/modules/settlement/` | Phase 3 | PG 정산 |

## 13. 롤백 고려

- Phase 0 마이그레이션: `billing_tier` 컬럼에 DEFAULT 설정으로 기존 동작 보존. 롤백 시 컬럼 제거만으로 원복 가능.
- Phase 1: 기존 CARD/TRANSFER 분기 로직 제거 전 feature flag 고려. 롤백 시 flag off로 원복.
- Phase 2: 빌링 모듈은 독립적. 제거해도 주문 플로우에 영향 없음.
- Phase 3: 정산 모듈은 읽기 전용 집계. 제거해도 결제 기능에 영향 없음.
