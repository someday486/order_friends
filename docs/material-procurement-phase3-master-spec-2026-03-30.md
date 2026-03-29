# 자재 발주 시스템 Phase 3 통합 명세서

작성일: 2026-03-30
상태: Draft v1
문서 성격: Phase 3 분석 / 가격 / 권장 발주 기준서
현재 유지 문서:

- `docs/material-procurement-phase3-master-spec-2026-03-30.md`
- `docs/material-procurement-phase1-master-spec-2026-03-30.md`
- `docs/material-procurement-all-phases-master-spec-2026-03-30.md`

## 1. 문서 목적

이 문서는 Phase 3에서 추가되는 분석 기능과 운영 고도화 영역을 정리한 문서다.

Phase 3의 핵심은 “발주를 기록하는 시스템”에서 “더 잘 발주하게 만드는 시스템”으로 올라가는 것이다.

## 2. Phase 3 목표

아래 기능이 가능해야 한다.

- 가격 변동 이력 추적
- 매장별 par level 관리
- 권장 발주량 계산
- 공급사별 성과 분석
- 예외와 지출 리포트

## 3. 포함 범위

### 포함

- price history
- par level
- suggested orders
- spend report
- supplier performance report
- exception / variance report

### 제외

- 완전 자동 발주 생성
- AI 예측 고도화
- 공급사 포털 분석 공유

## 4. 대상 사용자

- `brand_owner`
- `brand_operator`
- `branch_manager`
- `accounting`

## 5. 핵심 운영 시나리오

### 시나리오 A. 가격 상승 탐지

1. 운영자가 특정 공급사 품목 가격 이력을 본다.
2. 최근 인상 추이를 확인한다.
3. 필요 시 다른 공급사 품목과 비교한다.

### 시나리오 B. par level 기반 권장 발주

1. 매장별 목표 재고를 설정한다.
2. 최근 입고 / 사용 / 예정 수량을 본다.
3. 시스템이 권장 발주량을 계산한다.
4. 사용자는 이를 request로 전환한다.

### 시나리오 C. 공급사 성과 리포트

1. 공급사별 발주 건수와 금액을 본다.
2. 부분 입고율과 예외 발생률을 확인한다.
3. 납기 준수율을 기반으로 공급사 운영 정책을 조정한다.

## 6. 화면 구조

### 라우트

- `/customer/procurement/reports`
- `/customer/procurement/reports/prices`
- `/customer/procurement/reports/suppliers`
- `/customer/procurement/par-levels`
- `/customer/procurement/suggested-orders`

### 메뉴

- 리포트
- 가격 추이
- par level
- 권장 발주

## 7. 화면 명세

### 7-1. 가격 추이 화면

목적:

- 공급사 품목 단가 변동을 시계열로 본다.

필터:

- 공급사
- 품목
- 기간

요소:

- 추이 그래프
- 최근 변경 이력 테이블
- 변동 사유

### 7-2. par level 설정 화면

목적:

- 매장별 목표 재고 기준을 입력한다.

컬럼:

- 품목명
- 현재 기준값
- 안전재고
- 최근 소비 패턴

### 7-3. 권장 발주 화면

목적:

- par gap, 현재 재고, 입고 예정 기반 권장 수량을 본다.

핵심 컬럼:

- 품목명
- 현재 재고
- 예정 입고
- par level
- 권장 수량
- 추천 사유

주요 액션:

- 선택 항목 request로 전환

### 7-4. 리포트 화면

탭:

- 요약
- 공급사
- 품목
- 예외

## 8. API 명세

- `GET /customer/procurement/price-history`
- `POST /customer/procurement/supplier-items/:supplierItemId/price-history`
- `GET /customer/procurement/par-levels`
- `PUT /customer/procurement/par-levels/:procurementItemId`
- `GET /customer/procurement/suggested-orders`
- `GET /customer/procurement/reports/summary`
- `GET /customer/procurement/reports/suppliers`
- `GET /customer/procurement/reports/items`
- `GET /customer/procurement/reports/exceptions`

## 9. 핵심 엔티티

- `procurement_price_history`
- `procurement_par_levels`
- `procurement_demand_snapshots`
- `procurement_suggested_orders`
- `procurement_supplier_performance_metrics`

## 10. 핵심 비즈니스 규칙

### 가격 이력

- 단가 변경 시 유효 시작일을 저장한다.
- 같은 날짜 중복 이력 정책을 정의한다.
- 수동 변경 사유 입력을 권장한다.

### par level

- 매장별 기준값을 가진다.
- branch override가 없으면 brand 기본값을 사용할 수 있다.

### 권장 발주

- 단순 공식부터 시작한다.
- 현재 재고, 예정 입고, par gap을 최소 기준으로 삼는다.
- 추천값은 제안일 뿐 자동 확정하지 않는다.

## 11. 분석 지표

### Spend

- 총 발주 금액
- 공급사별 비중
- 카테고리별 지출

### Supplier Performance

- OTIF
- 부분 입고율
- 예외 발생률
- 가격 변동 빈도

### Inventory Efficiency

- 부족 발생률
- 과발주 비율
- par gap 빈도

## 12. 운영상 중요한 누락 방지 항목

### 데이터 품질

- price history는 supplier item 기준으로 연결
- par level은 procurement item 기준으로 연결

### 설명 가능성

- 권장 발주량은 계산 근거를 함께 보여야 한다.

### 보고서 해석

- 요약 수치는 기간 필터와 기준 시점을 명확히 표시해야 한다.

## 13. 테스트 전략

우선 테스트:

- 가격 이력 등록 / 조회
- par level 저장
- 권장 발주 계산
- 공급사 성과 지표 집계
- 기간 필터별 리포트 계산

## 14. 완료 기준

- 가격 추이를 볼 수 있다.
- 매장별 par level을 저장할 수 있다.
- 권장 발주량을 계산해 request로 전환할 수 있다.
- 공급사 성과 리포트를 볼 수 있다.

## 15. 다음 추천 작업

1. 권장 발주 계산식 상세화
2. OTIF 정의와 계산 기준 문서화
3. price history 데이터 입력 정책 정리
4. 리포트 CSV export 기준 정리
