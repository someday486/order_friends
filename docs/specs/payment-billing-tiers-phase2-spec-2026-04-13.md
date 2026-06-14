# Phase 2: Non-PG 구독 빌링

작성일: 2026-04-13
상태: Draft v2 (요금제/체험/초과 정책 추가)
상위 문서: `docs/specs/payment-billing-tiers-master-spec-2026-04-13.md`
선행 Phase: Phase 0

## 1. 문서 목적

이 문서는 Non-PG 티어(계좌이체 전용) 브랜드의 월 구독료 자동 결제 시스템을 정의한다.

## 2. 포함 / 제외 범위

### 포함

- 브랜드 생성 시 `billingTier` 선택 플로우
- Non-PG 선택 시 토스 빌링키 발급 (결제 카드 등록)
- 월 자동 결제 배치 잡 (cron)
- 결제 실패 재시도 정책
- 유예 기간 및 비활성화 정책
- 관리자 빌링 관리 UI
- 브랜드 오너 빌링 조회/관리 UI

### 제외

- PG 티어 주문 플로우 (Phase 1)
- 정산 시스템 (Phase 3)
- Non-PG 주문의 입금 확인 플로우 (기존 deposit_match_rows 시스템 그대로 유지)

## 3. 요금제 (Subscription Plans)

### 3.1 플랜 구조

| 플랜 | 월 주문 한도 | 월 이용료 | 대상 |
| --- | --- | --- | --- |
| **Starter** | 100~200건 | ₩29,000~39,000 | 1인 셀러, 테스트 판매 |
| **Seller** | 1,000건 | ₩79,000~99,000 | 꾸준히 판매하는 소상공인 |
| **Growth** | 협의 | ₩149,000~199,000 | 다중 출고지/팀 운영 브랜드 |
| **Pro** | 협의 | ₩299,000+ | 고주문량 브랜드 |

- 차등 기준: **월 주문 건수**
- 기본 플랜: Starter (가입 시 기본 선택)
- 스토어/출고지 수, 팀원 수, 고급 정산/재고 기능은 상위 플랜 차등 기준으로 둔다.
- 현재 DB seed의 33,000/44,000/55,000원 플랜은 초기 실험값이며 상용 가격 확정 전 조정 대상이다.

### 3.2 초과 주문 정책

Starter/Growth에서 월 주문 한도 초과 시:

1. **주문을 차단하지 않음** (매출 손실 방지)
2. 한도 초과 시 브랜드 오너에게 알림: "이번 달 주문이 N건을 초과했습니다. 상위 플랜을 확인해보세요."
3. **3개월 연속 초과 시 다음 결제 시점에 자동 업그레이드** (사전 7일 전 알림)

### 3.3 체험 기간

- **14일 무료 체험** (빌링키 등록 필수)
- 체험 중 구독 상태: `TRIAL`
- `next_billing_at` = 가입일 + 14일
- 14일 후 Starter 플랜으로 첫 결제 자동 실행
- 체험 기간 중 해지 가능 (결제 없이 종료)

### 3.4 플랜 변경 규칙

| 변경 | 처리 |
| --- | --- |
| 업그레이드 (Starter→Growth) | 즉시 적용, 차액 일할 계산 |
| 다운그레이드 (Pro→Growth) | 현재 결제 주기 끝나고 적용 |
| 해지 | 현재 결제 주기까지 이용 가능, 이후 비활성화 |

## 4. 브랜드 온보딩 플로우 변경

### 4.1 현재 플로우

```
브랜드 생성 → Brand Owner 등록 → 스토어/출고지 생성 → 온라인샵 운영 시작
```

### 4.2 변경 후 플로우

```
브랜드 생성 시 billing_tier 선택
  ├─ PG 선택 → 기존 플로우 (토스 결제 바로 가능)
  └─ NON_PG 선택 → 빌링키 등록 (결제 카드 등록, 필수)
                  → 구독 생성 (status: TRIAL, plan: Starter)
                  → next_billing_at = 가입일 + 14일
                  → 스토어/출고지 생성 → 온라인샵 운영 시작
                  → 14일 후 첫 결제 자동 실행
```

빌링키 미등록 시 브랜드 생성을 완료할 수 없다. 브랜드 생성 후 빌링키 등록 화면으로 강제 리다이렉트한다.

### 4.3 API 변경: 브랜드 생성

```typescript
// CreateBrandRequest에 billingTier 추가
interface CreateBrandRequest {
  name: string;
  bizName?: string;
  bizRegNo?: string;
  billingTier: 'PG' | 'NON_PG';  // 신규 필수 필드
}
```

- `billingTier`는 브랜드 생성 시 필수
- 생성 후 변경 불가 (관리자만 변경 가능)

## 5. 토스 빌링키 발급 플로우

### 5.1 개요

Non-PG 브랜드 가입 시, 월 구독료 자동 결제를 위한 카드를 등록한다. 토스 빌링 API를 사용한다.

### 5.2 플로우

```
1. 프론트: 빌링 카드 등록 UI 표시 (토스 빌링 위젯)
2. 고객이 카드 정보 입력 → 토스에서 authKey 발급
3. 프론트 → 백엔드: POST /billing/billing-key { authKey, customerKey, brandId }
4. 백엔드 → 토스: POST /billing/authorizations/issue { authKey, customerKey }
5. 토스 응답: billingKey 발급
6. 백엔드: billingKey 암호화 저장 (brand_subscriptions.payment_method_token)
7. 백엔드: brand_subscriptions 레코드 생성 (status: TRIAL, plan: Starter)
8. 백엔드: next_billing_at = NOW() + 14일
```

### 5.3 TossPaymentsClient 확장

```typescript
// toss-payments.client.ts에 빌링 메서드 추가

async issueBillingKey(
  customerKey: string,
  authKey: string,
): Promise<{ billingKey: string; card?: Record<string, unknown> }> {
  return this.callApi('/billing/authorizations/issue', {
    customerKey,
    authKey,
  });
}

async chargeBillingKey(
  billingKey: string,
  amount: number,
  customerKey: string,
  orderId: string,
  orderName: string,
): Promise<Record<string, unknown>> {
  return this.callApi(`/billing/${billingKey}`, {
    amount,
    customerKey,
    orderId,
    orderName,
  });
}
```

## 6. 월 자동 결제 배치 잡

### 6.1 실행 주기

- 매일 1회 실행 (예: 매일 09:00 KST)
- `next_billing_at <= NOW()` 인 구독을 조회하여 청구

### 6.2 처리 로직

```
1. SELECT * FROM brand_subscriptions
   WHERE status IN ('ACTIVE', 'PAST_DUE')
     AND next_billing_at <= NOW()

2. 각 구독에 대해:
   a. billing_records INSERT (status: PENDING)
   b. 토스 빌링 API 호출: chargeBillingKey(billingKey, plan.price, ...)
   c. 성공 시:
      - billing_records UPDATE (status: SUCCESS, paid_at: NOW())
      - brand_subscriptions UPDATE:
        - current_period_start = current_period_end
        - current_period_end = current_period_end + 1 month
        - next_billing_at = current_period_end
        - status = 'ACTIVE' (PAST_DUE였으면 복구)
   d. 실패 시:
      - billing_records UPDATE (status: FAILED, failure_reason: ...)
      - retry_count += 1
      - 재시도 스케줄 적용 (Section 5.3)
```

### 6.3 재시도 정책

| 시도 | 시점 | 설명 |
| --- | --- | --- |
| 1차 | 즉시 | 첫 청구 시도 |
| 2차 | +2일 | 첫 실패 후 2일 뒤 |
| 3차 | +5일 | 두 번째 실패 후 3일 뒤 |
| 4차 | +7일 | 세 번째 실패 후 2일 뒤 (최종) |

- 재시도 간격: 배치 잡이 매일 돌면서 `next_billing_at` 기준으로 처리
- 재시도 시 `billing_records`에 새 레코드 생성 (이전 실패 기록 보존)

### 6.4 유예 및 비활성화 정책

```
결제 성공 → ACTIVE (정상)
1차 실패 → ACTIVE 유지 (재시도 예정)
2차 실패 → PAST_DUE (브랜드 오너에게 알림)
3차 실패 → PAST_DUE 유지 (최종 시도 알림)
4차 실패 (최종) → PAST_DUE → 유예 기간 시작 (7일)
유예 기간 만료 → 브랜드 비활성화 (brands.is_active = false)
```

- PAST_DUE 상태에서도 브랜드는 정상 운영 가능 (주문 접수 가능)
- 유예 기간 만료 후 비활성화되면 주문 접수 중단
- 비활성화 후에도 기존 주문 데이터는 조회 가능

## 7. Non-PG 주문 플로우 (기존 유지)

Non-PG 브랜드의 주문 플로우는 기존과 동일하다:

1. 고객이 주문 생성 (`paymentMethod: 'TRANSFER'`)
2. 주문 확인 페이지에서 브랜드/스토어 `transferAccount` 정보 표시
3. 고객이 해당 계좌로 수동 이체
4. 운영자가 입금 확인 (기존 deposit_match_rows 시스템)
5. 주문 상태 업데이트

변경사항: Phase 1에서 정의한 tier 기반 유효성 검증만 적용.

## 8. 신규 모듈: src/modules/billing/

### 파일 구조

```
src/modules/billing/
  billing.module.ts
  billing.service.ts
  billing.controller.ts
  billing.scheduler.ts        -- 월 자동 결제 배치 잡
  dto/
    billing.dto.ts             -- 빌링키 발급/조회 요청/응답 DTO
    subscription.dto.ts        -- 구독 상태 조회 DTO
```

### API 엔드포인트

| Method | Path | 권한 | 설명 |
| --- | --- | --- | --- |
| POST | `/billing/billing-key` | Brand Owner | 빌링키 발급 (카드 등록) |
| DELETE | `/billing/billing-key` | Brand Owner | 빌링키 삭제 (카드 해지) |
| PUT | `/billing/billing-key` | Brand Owner | 빌링키 변경 (카드 변경) |
| GET | `/billing/subscription` | Brand Owner/Admin | 현재 구독 상태 조회 |
| GET | `/billing/records` | Brand Owner/Admin | 빌링 이력 조회 |
| POST | `/billing/retry` | System Admin | 실패한 빌링 수동 재시도 |
| PUT | `/billing/subscription/cancel` | Brand Owner | 구독 해지 요청 |

### 관리자 전용 엔드포인트

| Method | Path | 권한 | 설명 |
| --- | --- | --- | --- |
| GET | `/admin/billing/subscriptions` | System Admin | 전체 구독 목록 |
| GET | `/admin/billing/subscriptions/:brandId` | System Admin | 특정 브랜드 구독 상세 |
| PUT | `/admin/billing/subscriptions/:brandId/status` | System Admin | 구독 상태 수동 변경 |
| PUT | `/admin/billing/subscriptions/:brandId/extend` | System Admin | 유예 기간 연장 |
| GET | `/admin/billing/records` | System Admin | 전체 빌링 이력 |

## 9. 프론트엔드 변경

### 9.1 브랜드 생성 페이지

파일: `apps/web/src/app/customer/brands/page.tsx`

- billing_tier 선택 UI (이미 구현됨: PG / Non-PG 버튼)
- **Non-PG 선택 시 브랜드 생성 완료 후 빌링키 등록 화면으로 강제 리다이렉트**
- 빌링키 미등록 상태에서는 스토어/출고지 생성 및 주문 접수 불가
- 카드 등록 완료 후 TRIAL 구독 생성 → 정상 이용 시작

### 9.2 빌링키 등록 페이지 (신규)

경로: `/business/billing/setup`

- Non-PG 브랜드 생성 직후 랜딩 페이지
- 토스 빌링 위젯 렌더 (카드 등록)
- 등록 완료 시 `/business` 대시보드로 리다이렉트
- "14일 무료 체험 후 월 ₩33,000부터 자동 결제됩니다" 안내 문구

### 9.3 브랜드 오너 빌링 관리 페이지

경로: `/business/billing` (이미 구현됨, 보강 필요)

- 현재 구독 상태 (TRIAL / ACTIVE / PAST_DUE / CANCELLED)
- **현재 플랜 및 월 주문 한도 표시**
- **플랜 변경 UI (업그레이드/다운그레이드)**
- 다음 결제일 (TRIAL이면 "체험 종료일" 표시)
- 등록된 결제 카드 정보 (마스킹)
- 결제 카드 변경 버튼
- 빌링 이력 테이블 (날짜, 금액, 상태)
- PAST_DUE 시 경고 배너 + "결제 수단 변경" CTA
- TRIAL 시 "체험 기간 N일 남음" 배너

### 9.4 관리자 빌링 관리 페이지

기존 관리자 페이지에 빌링 탭 추가:

- 전체 구독 목록 (상태별 필터: TRIAL / ACTIVE / PAST_DUE / CANCELLED)
- 브랜드별 빌링 이력
- 수동 재시도, 유예 연장, 상태 변경 액션
- **브랜드별 티어(PG/Non-PG) 표시**

## 10. 알림

| 이벤트 | 대상 | 채널 | 내용 |
| --- | --- | --- | --- |
| 구독 결제 성공 | Brand Owner | 앱 내 알림 | "월 이용료 ₩XX,XXX 결제 완료" |
| 구독 결제 실패 (1차) | Brand Owner | 앱 내 알림 | "결제 실패. X일 후 재시도 예정" |
| PAST_DUE 전환 | Brand Owner | 앱 내 알림 + 문자 | "결제 실패. 결제 수단을 확인해주세요" |
| 최종 실패 (비활성화 예정) | Brand Owner | 앱 내 알림 + 문자 | "7일 내 결제하지 않으면 서비스 중단" |
| 브랜드 비활성화 | Brand Owner | 앱 내 알림 + 문자 | "이용료 미납으로 서비스가 중단되었습니다" |

| 주문 한도 초과 | Brand Owner | 앱 내 알림 | "이번 달 주문이 N건을 초과했습니다. 상위 플랜을 확인해보세요" |
| 자동 업그레이드 예정 | Brand Owner | 앱 내 알림 + 문자 | "3개월 연속 한도 초과로 다음 결제부터 Growth 플랜으로 전환됩니다" |
| 체험 종료 임박 (3일 전) | Brand Owner | 앱 내 알림 | "무료 체험이 3일 후 종료됩니다. 등록된 카드로 ₩33,000 결제 예정" |

## 11. 보안 고려사항

- **빌링키 암호화**: `brand_subscriptions.payment_method_token`은 AES-256 등으로 암호화 저장. 평문 저장 금지.
- **빌링키 접근 제한**: 빌링키는 서버에서만 사용. 클라이언트에 노출하지 않음.
- **결제 금액 검증**: 배치 잡에서 청구 시 `subscription_plans.price`와 일치하는지 검증.
- **관리자 액션 로깅**: 수동 상태 변경, 유예 연장 등은 감사 로그 필수.

## 12. 성공 / 실패 시나리오

### 성공

1. Non-PG 브랜드 가입 → 카드 등록 → TRIAL 14일 → 첫 결제 → ACTIVE → 매월 자동 결제
2. 결제 실패 후 카드 변경 → 다음 재시도에서 성공 → ACTIVE 복구
3. 주문 한도 초과 3개월 → 알림 → 자동 업그레이드 → 상위 플랜 결제
4. 체험 기간 중 해지 → 결제 없이 CANCELLED

### 실패

1. 카드 등록 실패 → 브랜드 생성은 되지만 빌링키 등록 완료까지 서비스 이용 불가
2. 4회 연속 결제 실패 → PAST_DUE → 유예 7일 → 비활성화
3. 비활성화 후 카드 변경 + 수동 결제 → ACTIVE 복구 → 브랜드 재활성화

## 13. 검증 체크리스트

- [ ] Non-PG 브랜드 생성 시 빌링키 등록 플로우 정상 작동
- [ ] PG 브랜드 생성 시 빌링키 등록 단계 스킵 확인
- [ ] 월 자동 결제 배치 잡 정상 실행 확인
- [ ] 결제 성공 시 구독 기간 갱신 확인
- [ ] 결제 실패 시 재시도 스케줄 정상 작동
- [ ] PAST_DUE 전환 및 알림 발송 확인
- [ ] 유예 기간 만료 후 비활성화 확인
- [ ] 카드 변경 후 결제 성공 확인
- [ ] 관리자 수동 재시도/유예 연장 정상 작동
- [ ] 빌링키 암호화 저장 확인
- [ ] Non-PG 브랜드 생성 후 빌링키 미등록 시 서비스 이용 차단 확인
- [ ] 14일 체험 → TRIAL→ACTIVE 전환 확인
- [ ] 체험 중 해지 시 결제 없이 CANCELLED 확인
- [ ] 주문 한도 초과 시 알림 발송 확인
- [ ] 3개월 연속 초과 시 자동 업그레이드 확인
- [ ] 플랜 업/다운그레이드 정상 작동 확인
- [ ] subscription_plans 시드 데이터 확인 (Starter/Growth/Pro)
