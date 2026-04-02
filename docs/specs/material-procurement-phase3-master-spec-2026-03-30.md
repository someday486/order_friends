# 자재 발주 시스템 Phase 3 통합 명세서

작성일: 2026-03-30
상태: Draft v3
문서 성격: Phase 3 분석 / 가격 / 권장 발주 실행 기준서
현재 유지 문서:

- `docs/specs/material-procurement-phase3-master-spec-2026-03-30.md`
- `docs/specs/material-procurement-phase1-master-spec-2026-03-30.md`
- `docs/specs/material-procurement-phase2-master-spec-2026-03-30.md`
- `docs/specs/material-procurement-all-phases-master-spec-2026-03-30.md`

## 1. 문서 목적

이 문서는 Phase 3에서 추가되는 분석 기능과 운영 고도화 영역을 정리한 문서다.

Phase 3의 핵심은 "발주를 기록하는 시스템"에서 "더 잘 발주하게 만드는 시스템"으로 올라가는 것이다.

Phase 3의 계산은 추상적 예측값이 아니라 Phase 1, Phase 2와 기존 inventory 모듈에서 확보 가능한 확정 데이터만 사용한다.

이 문서 하나만 보면 아래를 판단할 수 있어야 한다.

- 어떤 분석 기능이 MVP 이후 우선순위인지
- Phase 1, Phase 2 데이터가 어떤 식으로 활용되는지
- 어떤 API, DTO, 테이블, 집계 기준이 필요한지
- 권장 발주와 리포트가 어디까지 자동화되는지
- 구현 후 어떤 기준으로 검증하고 배포할지

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

주요 액션:

- 일괄 수정
- 브랜드 기본값 적용
- 매장 override 저장

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
- 계산 근거 보기

### 7-4. 리포트 화면

탭:

- 요약
- 공급사
- 품목
- 예외

공통 요소:

- 기간 필터
- 브랜드 / 매장 필터
- CSV export 확장 포인트

## 8. API 명세

### 8-1. Prefix

- `/customer/procurement/*`

### 8-2. Price History

- `GET /customer/procurement/price-history`
- `POST /customer/procurement/supplier-items/:supplierItemId/price-history`

### 8-3. Par Levels

- `GET /customer/procurement/par-levels`
- `PUT /customer/procurement/par-levels/:procurementItemId`

### 8-4. Suggested Orders

- `GET /customer/procurement/suggested-orders`
- `POST /customer/procurement/suggested-orders/convert-to-request`

### 8-5. Reports

- `GET /customer/procurement/reports/summary`
- `GET /customer/procurement/reports/suppliers`
- `GET /customer/procurement/reports/items`
- `GET /customer/procurement/reports/exceptions`

## 9. DTO / Swagger 기준

### 네이밍

- Request DTO: `*Request`
- Response DTO: `*Response`
- Query DTO: `Get*QueryDto`
- Report row DTO: `*ReportRow`

### Swagger 태그

- `customer-procurement-price-history`
- `customer-procurement-par-levels`
- `customer-procurement-suggested-orders`
- `customer-procurement-reports`

### 기본 응답 코드

- `200` 조회 / 수정 성공
- `201` 생성 성공
- `400` 잘못된 요청
- `401` 인증 실패
- `403` 권한 없음
- `404` 리소스 없음
- `409` 기준 충돌 또는 중복 등록

### DTO 핵심 묶음

- price history query / create / response
- par level list / update request / response
- suggested order query / row / conversion request
- summary report response
- supplier performance row
- item spend row
- exception trend row

## 10. 핵심 도메인 모델

### PriceHistory

- supplier item 단가 이력과 유효 시작일 저장

### ParLevel

- brand 기본값과 branch override를 함께 담는 목표 재고 기준

### DemandSnapshot

- 최근 소비, 입고, 예외 흐름을 계산용으로 고정한 집계 스냅샷

### SuggestedOrder

- 계산 결과와 근거 값을 보존하는 권장 발주 레코드
- 재고 데이터 출처가 확인된 품목에 대해서만 생성한다.

### SupplierPerformanceMetric

- OTIF, 예외율, 가격 변동성 등 공급사 지표 스냅샷

## 11. DB 스키마 요약

### 핵심 테이블

- `procurement_price_history`
- `procurement_par_levels`
- `procurement_demand_snapshots`
- `procurement_suggested_orders`
- `procurement_supplier_performance_metrics`

### 핵심 컬럼 원칙

- price history는 `supplier_item_id`, `unit_price`, `effective_from`, `change_reason`를 가진다.
- par level은 `procurement_item_id`, `brand_id`, `branch_id`, `par_level`, `safety_stock`을 가진다.
- demand snapshot은 `procurement_item_id`, `branch_id`, `period_start`, `period_end`, `usage_qty`, `receiving_qty`를 가진다.
- suggested order는 `procurement_item_id`, `branch_id`, `recommended_qty`, `calculation_basis`, `generated_at`을 가진다.
- supplier performance metric은 `supplier_id`, `period_key`, `otif_rate`, `exception_rate`, `price_change_rate`를 가진다.

### 인덱스 우선 대상

- `procurement_price_history(supplier_item_id, effective_from desc)`
- `procurement_par_levels(procurement_item_id, branch_id)`
- `procurement_demand_snapshots(branch_id, period_end desc)`
- `procurement_suggested_orders(branch_id, generated_at desc)`
- `procurement_supplier_performance_metrics(supplier_id, period_key)`

### 연결 원칙

- price history는 supplier item 기준으로 연결한다.
- par level은 procurement item 기준으로 연결한다.
- report 집계는 원본 transactional table을 직접 수정하지 않고 snapshot 또는 query layer로 계산한다.
- 재고 기반 계산은 기존 inventory 모듈의 확정 수치와 연결할 수 있을 때만 활성화한다.

## 12. Controller / Service 책임

### Controller 책임

- 리포트 엔드포인트별 필터 파라미터를 명시한다.
- query DTO를 통해 기간, 범위, 그룹 기준을 검증한다.
- suggested order 전환 action을 명시적으로 분리한다.

### Service 책임

- price history 중복 기준과 유효 시작일을 검증한다.
- par level override 우선순위를 계산한다.
- suggested order 계산 근거를 응답에 포함한다.
- report 기간 필터와 집계 기준을 일관되게 적용한다.

### 공통 helper 필요 항목

- period normalizer
- suggested qty calculator
- supplier performance aggregator
- report export mapper

## 13. 권한 규칙

### 가격 이력

- `brand_operator`는 가격 이력을 등록하고 수정 사유를 남긴다.
- `branch_manager`는 조회 중심으로 사용한다.

### par level

- 브랜드 기본값은 `brand_owner` 또는 `brand_operator`가 관리한다.
- 매장 override는 해당 매장 `branch_manager`가 관리할 수 있다.

### 리포트 / 권장 발주

- `brand_owner`, `brand_operator`, `accounting`는 전체 범위 리포트를 볼 수 있다.
- `branch_manager`는 자신의 매장 범위 내 리포트와 권장 발주를 본다.
- request 전환은 기존 Phase 1 발주 요청 권한 규칙을 따른다.

## 14. 설정 정책

### 설정 단위

- brand
- branch
- report
- recommendation

### Phase 3 설정 키

- `procurement_reporting_enabled`
- `procurement_suggested_orders_enabled`
- `procurement_price_history_reason_required`
- `procurement_default_par_window_days`
- `procurement_supplier_report_period_default`

### 추가로 고려해야 할 설정

- suggested order 계산 기간 기본값
- 리포트 다운로드 권한 제한
- 브랜드별 metric 공개 범위

## 15. 핵심 비즈니스 규칙

### 가격 이력

- 단가 변경 시 유효 시작일을 저장한다.
- 같은 날짜 중복 이력 정책을 정의한다.
- 수동 변경 사유 입력을 권장한다.
- 과거 유효일을 수정할 경우 이후 구간 재계산 영향 범위를 검토한다.

### par level

- 매장별 기준값을 가진다.
- branch override가 없으면 brand 기본값을 사용할 수 있다.
- 0 이하 값 허용 여부를 명확히 검증한다.

### 권장 발주

- 단순 공식부터 시작한다.
- 현재 재고, 예정 입고, par gap을 최소 기준으로 삼는다.
- 추천값은 제안일 뿐 자동 확정하지 않는다.
- 사용자가 request로 전환할 때 최종 수량을 조정할 수 있어야 한다.

### 데이터 소스 계약

- 현재 재고는 기존 `inventory` 모듈의 `product_inventory.qty_available` 또는 이에 준하는 확정 on-hand snapshot을 기준으로 한다.
- 예정 입고는 `SENT`, `ACKNOWLEDGED`, `PARTIALLY_RECEIVED` 상태의 open purchase order line에서 미입고 수량을 계산한다.
- `usage_qty`는 `inventory_logs` 또는 이에 준하는 확정 재고 변동 로그에서 집계하며, 추정 판매량을 직접 사용하지 않는다.
- inventory source binding이 없는 procurement item은 리포트에는 포함될 수 있지만 stock-based suggested order 대상에서는 제외한다.

## 16. 분석 지표

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

## 17. 알림 / 감사 / 내보내기 기준

### 알림

- 가격 급등 품목은 운영자에게 요약 알림 후보로 남긴다.
- 공급사 성과 급락 시 리포트 홈에서 강조한다.

### 감사 로그

- price history 등록 / 수정
- par level 변경
- suggested order의 request 전환
- 리포트 export 수행 이력

### 내보내기

- CSV export는 현재 필터와 기준 기간을 함께 기록한다.
- timezone과 집계 기준 시점을 파일 메타에 남긴다.

## 18. 운영상 중요한 누락 방지 항목

### 데이터 품질

- price history는 supplier item 기준으로 연결
- par level은 procurement item 기준으로 연결
- missing snapshot 구간은 보고서에서 명시적으로 표시

### 설명 가능성

- 권장 발주량은 계산 근거를 함께 보여야 한다.
- 공급사 성과 지표는 분자 / 분모가 해석 가능해야 한다.

### 보고서 해석

- 요약 수치는 기간 필터와 기준 시점을 명확히 표시해야 한다.
- provisional 데이터와 확정 데이터를 혼동하지 않도록 라벨링한다.

## 19. 비기능 요구사항

### 보안

- 리포트는 브랜드 / 매장 scope를 강제한다.
- 다운로드 데이터는 최소 권한 원칙을 따른다.

### 성능

- 가격 추이와 주요 리포트는 일반 필터 기준 빠르게 조회되어야 한다.
- 무거운 집계는 snapshot 또는 materialized view 후보를 열어둔다.

### 관측성

- report query latency
- suggested order generation count
- export usage
- price history update count

### 유지보수성

- 계산식은 helper 또는 domain service에 모은다.
- metric 정의는 문서와 코드에서 같은 용어를 사용한다.

## 20. 테스트 전략

### Unit test 우선 대상

- suggested qty calculator
- period normalizer
- par level resolver
- supplier performance aggregator

### e2e 우선 시나리오

- 가격 이력 등록 / 조회
- par level 저장
- 권장 발주 계산
- 공급사 성과 지표 집계
- 기간 필터별 리포트 계산

### UI 검증 포인트

- 계산 근거 노출
- 기간 필터 일관성
- CSV export 메타 정보

## 21. 완료 기준

- 가격 추이를 볼 수 있다.
- 매장별 par level을 저장할 수 있다.
- 권장 발주량을 계산해 request로 전환할 수 있다.
- 공급사 성과 리포트를 볼 수 있다.

## 22. 배포와 롤아웃

### 초기 도입 권장 방식

- Phase 2 운영 데이터가 충분한 고객부터 순차 적용한다.
- 리포트는 조회 전용으로 먼저 열고, 권장 발주는 일부 사용자에게만 확장한다.

### 롤아웃 체크리스트

- OTIF 정의 공유
- timezone 기준 확정
- par level 기본값 검토
- export 권한 확인
- inventory source binding 대상 품목 확인

### 운영 백업 플랜

- 권장 발주 화면 장애 시 기존 Phase 1 발주 요청 생성 플로우를 유지한다.
- 집계 지연 시 최근 확정 스냅샷 기준으로 표시한다.

## 23. 미결정 사항

- suggested order 계산 기간 기본값
- OTIF 분모 / 분자 세부 기준
- 공급사 성과 지표를 실시간 계산할지 배치로 만들지
- procurement item과 inventory source binding 운영 주체

## 24. 다음 추천 작업

1. 권장 발주 계산식 상세화
2. OTIF 정의와 계산 기준 문서화
3. price history 데이터 입력 정책 정리
4. 리포트 CSV export 기준 정리
5. procurement item과 inventory source binding 기준 정리
