# Phase 3: PG 정산 시스템

작성일: 2026-04-13
상태: Draft v1
상위 문서: `docs/specs/payment-billing-tiers-master-spec-2026-04-13.md`
선행 Phase: Phase 0, Phase 1

## 1. 문서 목적

이 문서는 PG 티어 브랜드에 대한 정산 시스템을 정의한다. Order Friends가 토스페이먼츠를 통해 수취한 결제 대금에서 수수료를 차감하고 브랜드에 정산하는 전체 프로세스를 다룬다.

## 2. 포함 / 제외 범위

### 포함

- 월별 정산 기간 자동 생성
- 매출 구간별 수수료 자동 계산 (commission_tiers)
- 정산 보고서 생성
- 관리자 정산 확인 후 SETTLED 처리
- 브랜드 오너 정산 조회 UI
- 환불 발생 시 정산 조정

### 제외

- 자동 송금 (MVP에서는 관리자 수동 정산)
- 세금계산서 발행
- 외부 회계 시스템 연동

## 3. 정산 주기

| 항목 | 값 |
| --- | --- |
| 정산 단위 | 월 (매월 1일 ~ 말일) |
| 계산 시점 | 익월 1일 배치 실행 |
| 정산 확인 | 관리자 수동 확인 후 SETTLED |
| 정산 기한 | 계산 후 N 영업일 이내 (설정 가능) |

## 4. 수수료 구간 자동 적용

### 4.1 적용 로직

```
1. 정산 기간의 총 매출 계산 (settlement_line_items.sale_amount 합계)
2. commission_tiers에서 해당 매출 구간의 수수료율 조회
   - min_monthly_sales <= 총매출 < max_monthly_sales (또는 max가 NULL)
3. 해당 수수료율을 정산 기간에 적용
4. 개별 브랜드에 commission_rate 오버라이드가 있으면 우선 적용
```

### 4.2 수수료율 결정 우선순위

1. `brands.commission_rate` (NOT NULL이면 수동 오버라이드)
2. `commission_tiers`에서 매출 구간 매칭
3. 매칭 실패 시 시스템 기본값 (환경변수 또는 설정 테이블)

### 4.3 수수료율 변경 시점

- 정산 기간 계산 시점에 적용 수수료율을 `settlement_periods.commission_rate`에 스냅샷
- 이후 commission_tiers가 변경되어도 이미 계산된 정산 기간에는 영향 없음

## 5. 정산 계산 배치 잡

### 5.1 실행 조건

- 매월 1일 실행 (예: 01:00 KST)
- 직전 월의 모든 PG 브랜드에 대해 정산 계산

### 5.2 처리 로직

```
1. PG 티어 브랜드 목록 조회
   SELECT * FROM brands WHERE billing_tier = 'PG' AND is_active = true

2. 각 브랜드에 대해:
   a. 직전 월 settlement_period 생성 (또는 기존 PENDING 조회)
   b. 해당 기간의 settlement_line_items 집계:
      - total_sales = SUM(sale_amount) WHERE sale_amount > 0
      - total_refunds = ABS(SUM(sale_amount)) WHERE sale_amount < 0
   c. 수수료율 결정 (Section 4.2)
   d. commission_amount 계산:
      - 각 line item의 commission_amount 합계
      - 또는 (total_sales - total_refunds) * commission_rate
   e. net_settlement = total_sales - total_refunds - commission_amount
   f. settlement_periods UPDATE:
      - total_sales, total_refunds, commission_rate, commission_amount, net_settlement
      - status = 'CALCULATED'
```

### 5.3 Line Item 기준 vs 기간 합산 기준

Phase 1에서 결제 성공 시 settlement_line_items를 생성할 때 이미 commission_amount를 계산한다.

정산 배치에서는:
- line item 합산 값과 기간 합산 재계산 값을 비교
- 차이가 있으면 (구간 변동 등) 기간 합산 값을 우선 적용
- line item은 상세 내역 용도로 유지

## 6. 환불 정산 처리

### 6.1 같은 정산 기간 내 환불

```
- 기존 settlement_line_item의 sale_amount를 차감하지 않음 (불변)
- 마이너스 line item 추가:
  sale_amount: -refund_amount
  commission_amount: -Math.round(refund_amount * commission_rate)
  net_amount: -(refund_amount - commission_refund)
```

### 6.2 다른 정산 기간의 환불

```
- 현재 정산 기간(환불 발생 시점)에 마이너스 line item 추가
- 원래 결제의 정산 기간은 변경하지 않음 (SETTLED 상태 보존)
```

### 6.3 부분 환불

```
- 환불 금액 기준으로 마이너스 line item 생성
- 전액 환불과 동일 로직, 금액만 다름
```

## 7. 신규 모듈: src/modules/settlement/

### 파일 구조

```
src/modules/settlement/
  settlement.module.ts
  settlement.service.ts
  settlement.controller.ts
  settlement.scheduler.ts      -- 월별 정산 계산 배치 잡
  dto/
    settlement.dto.ts           -- 정산 조회/관리 DTO
```

### API 엔드포인트

#### 브랜드 오너용

| Method | Path | 권한 | 설명 |
| --- | --- | --- | --- |
| GET | `/settlement/periods` | Brand Owner/Admin | 내 브랜드 정산 기간 목록 |
| GET | `/settlement/periods/:periodId` | Brand Owner/Admin | 정산 기간 상세 (line items 포함) |
| GET | `/settlement/summary` | Brand Owner/Admin | 정산 요약 (최근 N개월) |

#### 관리자용

| Method | Path | 권한 | 설명 |
| --- | --- | --- | --- |
| GET | `/admin/settlement/periods` | System Admin | 전체 정산 기간 목록 (필터: 상태, 브랜드) |
| GET | `/admin/settlement/periods/:periodId` | System Admin | 정산 기간 상세 |
| PUT | `/admin/settlement/periods/:periodId/settle` | System Admin | SETTLED 처리 (수동 정산 확인) |
| POST | `/admin/settlement/calculate` | System Admin | 수동 정산 계산 트리거 |
| GET | `/admin/settlement/commission-tiers` | System Admin | 수수료 구간 목록 |
| POST | `/admin/settlement/commission-tiers` | System Admin | 수수료 구간 추가 |
| PUT | `/admin/settlement/commission-tiers/:id` | System Admin | 수수료 구간 수정 |
| DELETE | `/admin/settlement/commission-tiers/:id` | System Admin | 수수료 구간 삭제 |

## 8. 정산 보고서

### 8.1 브랜드 오너 뷰

정산 기간별 요약:

```
정산 기간: 2026년 3월 (2026-03-01 ~ 2026-03-31)
상태: CALCULATED (정산 대기)

총 매출:        ₩ 15,230,000
환불 합계:      ₩ -450,000
순 매출:        ₩ 14,780,000
적용 수수료율:  3.5%
수수료:         ₩ -517,300
정산 금액:      ₩ 14,262,700
```

상세 내역 (settlement_line_items):

```
주문번호 | 결제일 | 매출 | 수수료 | 순금액
OF-20260301-0001 | 03-01 | ₩120,000 | ₩4,200 | ₩115,800
OF-20260301-0002 | 03-01 | ₩85,000 | ₩2,975 | ₩82,025
...
```

### 8.2 관리자 뷰

전체 브랜드 정산 현황:

```
브랜드 | 기간 | 매출 | 수수료 | 정산액 | 상태
브랜드A | 2026-03 | ₩15,230,000 | ₩517,300 | ₩14,262,700 | CALCULATED
브랜드B | 2026-03 | ₩8,450,000 | ₩422,500 | ₩8,027,500 | CALCULATED
...
총 수수료 수익: ₩939,800
```

## 9. 프론트엔드 변경

### 9.1 브랜드 오너 정산 페이지 (신규)

경로: `/business/settlement`

- 정산 기간 목록 (월별)
- 각 기간 클릭 시 상세 페이지 (요약 + line items)
- 수수료율 안내
- 정산 상태 배지 (PENDING / CALCULATED / SETTLED)

### 9.2 관리자 정산 관리 페이지

기존 관리자 페이지에 정산 탭 추가:

- 전체 브랜드 정산 현황 테이블
- 상태별 필터 (미정산 / 정산완료)
- 정산 확인 (SETTLED 처리) 버튼
- 수수료 구간 관리 (CRUD)
- 수동 정산 계산 트리거 버튼

## 10. 성공 / 실패 시나리오

### 성공

1. 월말 → 익월 1일 배치 → 모든 PG 브랜드 정산 계산 완료 → 관리자 확인 → SETTLED
2. 환불 발생 → 마이너스 line item → 정산 금액 자동 조정
3. 브랜드 매출 증가 → 수수료 구간 변경 → 다음 정산부터 낮은 수수료율 적용

### 실패

1. 배치 잡 실패 → 관리자에게 알림 → 수동 트리거로 재실행
2. Line item 누락 (Phase 1 비동기 생성 실패) → 정산 계산 시 payments 테이블과 대조 → 누락분 보정
3. 수수료 구간 매칭 실패 → 시스템 기본값 적용 + 관리자 알림

## 11. 감사 추적

- `settlement_periods` 상태 변경 로그 (who, when, from_status, to_status)
- 관리자 SETTLED 처리 시 처리자 ID, 처리 시각 기록
- `commission_tiers` 변경 이력 (관리자 액션 로깅)
- 수수료율 오버라이드 변경 이력

## 12. 향후 확장 (Phase 3 범위 밖)

- 자동 송금: 토스 Payouts API 또는 은행 API 연동으로 자동 정산 입금
- 세금계산서 자동 발행: 정산 확정 시 전자세금계산서 발행
- 정산 주기 커스터마이즈: 브랜드별 주간/격주/월간 선택
- 대시보드: 실시간 매출/수수료/정산 현황 차트

## 13. 검증 체크리스트

- [ ] 월별 정산 배치 잡 정상 실행 확인
- [ ] 수수료 구간별 자동 수수료율 적용 확인
- [ ] 수수료율 오버라이드 우선 적용 확인
- [ ] 환불 시 마이너스 line item 생성 확인
- [ ] 정산 보고서 금액 정합성 확인 (매출 - 환불 - 수수료 = 정산액)
- [ ] 관리자 SETTLED 처리 정상 작동 확인
- [ ] 브랜드 오너 정산 페이지 데이터 정확성 확인
- [ ] 수수료 구간 CRUD 정상 작동 확인
- [ ] 배치 잡 실패 시 재실행 가능 확인
- [ ] Line item 누락 보정 로직 확인
