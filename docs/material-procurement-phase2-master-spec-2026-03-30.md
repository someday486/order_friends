# 자재 발주 시스템 Phase 2 통합 명세서

작성일: 2026-03-30
상태: Draft v3
문서 성격: Phase 2 입고 / 송장 / 예외 처리 실행 기준서
현재 유지 문서:

- `docs/material-procurement-phase2-master-spec-2026-03-30.md`
- `docs/material-procurement-phase1-master-spec-2026-03-30.md`
- `docs/material-procurement-all-phases-master-spec-2026-03-30.md`

## 1. 문서 목적

이 문서는 Phase 2에서 추가되는 입고, 송장, 예외 처리 영역을 한 문서로 통합한 기준서다.

Phase 2는 발주 이후 실제 운영의 핵심을 다루므로, 정합성과 예외 처리 정책을 함께 정의한다.

이 문서 하나만 보면 아래를 판단할 수 있어야 한다.

- 어떤 입고 / 송장 / 예외 흐름을 구현해야 하는지
- Phase 1 자산과 어떤 식으로 연결되는지
- 어떤 API, DTO, 테이블이 필요한지
- 누가 어떤 상태를 변경할 수 있는지
- 구현 후 어떤 기준으로 검증하고 롤아웃할지

## 2. Phase 2 목표

Phase 2의 목표는 발주가 끝난 뒤 실제 납품과 송장 검증, 운영 마감 직전까지의 운영을 시스템 안에 넣는 것이다.

완료되면 아래가 가능해야 한다.

- 발주서 기준 입고 등록
- 부분 입고와 차이 기록
- 송장 업로드
- 발주 / 입고 / 송장 매칭
- 불일치 항목의 예외 큐 관리

## 3. 포함 범위

### 포함

- 입고 대기 목록
- 입고 등록
- 부분 입고
- 차이 코드 관리
- 송장 업로드
- 매칭 결과 확인
- 예외 큐
- 예외 해소 이력
- 첨부 파일 연계

### 제외

- 자동 OCR 파싱
- 자동 3-way match 고도화
- 정산 지급, supplier statement, adjustment 관리
- 공급사 포털 응답

## 4. 핵심 사용자

- `branch_manager`
- `branch_staff`
- `brand_operator`
- `accounting`

## 5. 핵심 운영 시나리오

### 시나리오 A. 정상 입고

1. 운영자가 발주서 목록에서 입고 대상을 연다.
2. 실제 입고 수량을 입력한다.
3. 전 라인이 정상 입고되면 `COMPLETED` 처리한다.
4. 송장을 업로드하고 PO와 연결한다.

### 시나리오 B. 부분 입고

1. 일부 품목만 들어온다.
2. 입고 수량과 차이 사유를 입력한다.
3. receiving 상태는 `PARTIAL`이 된다.
4. 예외 큐에 `SHORTAGE` 또는 관련 항목이 생성된다.

### 시나리오 C. 송장 금액 불일치

1. 회계 또는 운영자가 송장을 업로드한다.
2. PO / receiving과 비교한다.
3. 차이가 있으면 `VARIANCE_DETECTED`와 예외 큐를 생성한다.
4. 운영자가 수동 해소하거나 추후 조정으로 넘긴다.

## 6. 화면 구조

### 라우트

- `/customer/procurement/receivings`
- `/customer/procurement/purchase-orders/[purchaseOrderId]/receive`
- `/customer/procurement/receivings/[receivingId]`
- `/customer/procurement/invoices`
- `/customer/procurement/invoices/[invoiceId]`
- `/customer/procurement/exceptions`
- `/customer/procurement/exceptions/[exceptionId]`

### Phase 2 메뉴

- 입고
- 송장
- 예외 처리

## 7. 화면 명세

### 7-1. 입고 대기 목록

목적:

- 아직 입고가 필요하거나 부분 입고 상태인 발주서를 본다.

필터:

- 브랜드
- 매장
- 공급사
- 상태
- 예정일

컬럼:

- 발주서 번호
- 매장명
- 공급사명
- 예정 납기일
- 입고 상태
- 차이 여부

### 7-2. 입고 등록 화면

목적:

- 발주서 라인 기준으로 실제 입고 수량과 차이 사유를 입력한다.

필수 영역:

- PO header
- line별 ordered qty
- received qty 입력
- discrepancy type
- discrepancy reason
- 메모 / 사진 / 첨부 확장 포인트

주요 액션:

- 임시 저장
- 입고 완료
- 부분 입고 저장
- 차이 보고

### 7-3. 송장 목록 / 상세

목적:

- 업로드된 송장을 조회하고 매칭 결과를 확인한다.

컬럼:

- 송장 번호
- 공급사명
- 매장명
- 송장일
- 총액
- 매칭 상태

상세 섹션:

- 기본 정보
- 첨부
- 매칭 대상 PO
- 매칭 대상 receiving
- 차이 결과

### 7-4. 예외 큐

목적:

- 운영자가 우선 처리해야 할 문제를 한 곳에서 본다.

필터:

- type
- severity
- status
- brand
- branch
- supplier

예외 유형 예시:

- `FAILED_SEND`
- `SHORTAGE`
- `OVER_DELIVERY`
- `DAMAGED`
- `SUBSTITUTED`
- `PRICE_VARIANCE`
- `INVOICE_UNMATCHED`
- `INVOICE_TOTAL_MISMATCH`

## 8. API 명세

### 8-1. Prefix

- `/customer/procurement/*`

### 8-2. Receivings

- `GET /customer/procurement/receivings`
- `POST /customer/procurement/purchase-orders/:purchaseOrderId/receivings`
- `GET /customer/procurement/receivings/:receivingId`
- `PATCH /customer/procurement/receivings/:receivingId`

### 8-3. Invoices

- `GET /customer/procurement/invoices`
- `POST /customer/procurement/invoices`
- `GET /customer/procurement/invoices/:invoiceId`
- `POST /customer/procurement/invoices/:invoiceId/match`
- `POST /customer/procurement/invoices/:invoiceId/approve`

### 8-4. Exceptions

- `GET /customer/procurement/exceptions`
- `GET /customer/procurement/exceptions/:exceptionId`
- `POST /customer/procurement/exceptions/:exceptionId/resolve`
- `POST /customer/procurement/exceptions/:exceptionId/reopen`

## 9. DTO / Swagger 기준

### 네이밍

- Request DTO: `*Request`
- Response DTO: `*Response`
- Query DTO: `Get*QueryDto`
- 상태 전이용 DTO: `*ActionRequest`

### Swagger 태그

- `customer-procurement-receivings`
- `customer-procurement-invoices`
- `customer-procurement-exceptions`

### 기본 응답 코드

- `200` 조회 / 수정 성공
- `201` 생성 성공
- `400` 잘못된 요청
- `401` 인증 실패
- `403` 권한 없음
- `404` 리소스 없음
- `409` 상태 충돌 또는 중복 처리

### DTO 핵심 묶음

- receiving query / request / response
- receiving line update request / response
- invoice create / match / approve request
- invoice attachment response
- exception query / resolution / reopen request
- discrepancy code enum
- variance summary response

## 10. 상태 모델

### Receiving

- `PENDING`
- `PARTIAL`
- `COMPLETED`
- `DISCREPANCY_REPORTED`
- `RESOLVED`

### Invoice

- `UPLOADED`
- `MATCHED`
- `VARIANCE_DETECTED`
- `APPROVED`
- `CLOSED`

### Exception

- `OPEN`
- `IN_PROGRESS`
- `RESOLVED`
- `REOPENED`
- `DISMISSED`

### Purchase Order 연동 상태

- `SENT`
- `ACKNOWLEDGED`
- `PARTIALLY_RECEIVED`
- `RECEIVED`
- `INVOICED`
- `CLOSED`

## 11. 핵심 도메인 모델

### Receiving

- purchase order 기준으로 생성되는 입고 헤더

### ReceivingLine

- 발주 라인별 실제 입고 수량과 차이 사유 저장

### SupplierInvoice

- 공급사 송장 메타데이터와 첨부 연결

### InvoiceMatchResult

- PO / receiving / invoice 비교 결과와 차이 요약 저장

### ProcurementException

- 운영자가 처리해야 하는 불일치 이벤트 허브

### ExceptionResolution

- 예외 해소 이력과 담당자 / 사유 저장

## 12. DB 스키마 요약

### 핵심 테이블

- `procurement_receivings`
- `procurement_receiving_lines`
- `procurement_invoices`
- `procurement_invoice_lines`
- `procurement_invoice_match_results`
- `procurement_exceptions`
- `procurement_exception_resolutions`
- `attachments`

### 핵심 컬럼 원칙

- receiving은 `purchase_order_id`, `brand_id`, `branch_id`, `supplier_id`, `status`를 가진다.
- receiving line은 `purchase_order_line_id`, `ordered_qty`, `received_qty`, `discrepancy_code`, `discrepancy_reason`를 가진다.
- invoice는 `invoice_no`, `invoice_date`, `supplier_id`, `branch_id`, `status`, `total_amount`를 가진다.
- match result는 `invoice_id`, `purchase_order_id`, `receiving_id`, `match_status`, `variance_amount`, `variance_summary`를 가진다.
- exception은 `type`, `severity`, `status`, `reference_type`, `reference_id`, `assigned_to`, `resolved_at`를 가진다.

### 인덱스 우선 대상

- `procurement_receivings(status, expected_delivery_date)`
- `procurement_receivings(branch_id, supplier_id, created_at)`
- `procurement_invoices(status, invoice_date)`
- `procurement_exceptions(status, severity, created_at)`
- `procurement_invoice_match_results(invoice_id)`

### 연결 원칙

- 송장과 입고는 동일 `supplier_id`, `branch_id` 범위 안에서만 매칭한다.
- 예외는 원본 엔티티를 삭제하더라도 이력 조회가 가능하도록 참조 정보를 별도 보존한다.
- 첨부는 `attachments` 공용 정책을 재사용하되 procurement scope를 명시한다.

## 13. Controller / Service 책임

### Controller 책임

- scope 검증 이후 request를 service에 전달한다.
- receiving / invoice / exception별 swagger 태그를 분리한다.
- resolve, reopen 같은 action endpoint를 명시적으로 분리한다.

### Service 책임

- purchase order와 receiving의 정합성을 검증한다.
- line별 차이 계산과 상태 전이를 처리한다.
- invoice match 결과를 만들고 필요 시 예외를 생성한다.
- receiving / invoice 이벤트에 따라 purchase order 상태를 갱신한다.
- resolve / reopen 이력과 감사 로그를 함께 남긴다.

### 공통 helper 필요 항목

- discrepancy code normalizer
- variance calculator
- exception factory
- attachment permission checker

## 14. 권한 규칙

### 입고

- `branch_staff`는 초안 입력과 임시 저장을 수행할 수 있다.
- `branch_manager`는 입고 완료 또는 부분 입고 확정을 수행한다.
- 다른 매장 범위의 입고는 수정할 수 없다.

### 송장

- `brand_operator`와 `accounting`만 송장 업로드 및 매칭을 수행한다.
- 송장 승인 권한은 기본적으로 `accounting` 우선이다.
- 매칭 대상 변경은 동일 supplier / branch 범위에서만 허용한다.

### 예외

- `brand_operator`는 예외 할당, 상태 변경, 해소를 수행할 수 있다.
- `accounting`는 송장 관련 예외 해소에 참여할 수 있다.
- 예외 해소 시 사유와 담당자는 필수다.

## 15. 핵심 비즈니스 규칙

### 입고

- receiving은 purchase order 기준으로 생성한다.
- line별 `received_qty`는 0 이상이어야 한다.
- `ordered_qty`보다 초과 입고 시 discrepancy type이 필요하다.
- 부분 입고는 명시적 상태로 저장한다.
- 완료 처리 전 적어도 한 개 이상의 line 입력이 필요하다.

### 송장

- 송장 업로드 시 공급사와 매장을 명확히 지정한다.
- 수동 매칭 대상은 동일 supplier / branch 범위여야 한다.
- 총액 불일치와 단가 불일치를 구분한다.
- 승인 전 match result가 존재해야 한다.
- `APPROVED`는 procurement 기준 송장 검증 완료를 의미한다.
- `CLOSED`는 운영 마감 상태를 의미하며 지급 완료와 동일 의미가 아니다.

### 예외

- 차이가 발생하면 예외 큐 생성이 우선이다.
- 예외 해소는 사유와 담당자를 남겨야 한다.
- 해소 후 다시 문제가 발견되면 reopen 가능해야 한다.
- 동일 원인으로 중복 예외가 생성되지 않도록 dedupe 기준이 필요하다.

### Purchase Order 상태 연계

- 첫 receiving 생성 이후 미입고 라인이 남아 있으면 PO는 `PARTIALLY_RECEIVED`로 이동할 수 있다.
- 모든 유효 라인이 입고 완료되면 PO는 `RECEIVED`로 이동한다.
- 승인된 invoice가 연결되고 blocking exception이 없으면 PO는 `INVOICED`로 이동한다.
- procurement 관점에서 추가 액션이 없고 open exception이 없으면 PO를 `CLOSED`로 수동 마감할 수 있다.
- Phase 2는 지급 실행이나 supplier statement 생성을 다루지 않는다.

## 16. 설정 정책

### 설정 단위

- brand
- branch
- supplier
- feature

### Phase 2 설정 키

- `procurement_receiving_enabled`
- `procurement_invoice_enabled`
- `invoice_amount_tolerance`
- `invoice_unit_price_tolerance`
- `receiving_over_delivery_allowed`
- `exception_auto_assignment_enabled`

### 추가로 고려해야 할 설정

- discrepancy code별 기본 severity
- 송장 첨부 필수 여부
- branch별 회계 검토 단계 사용 여부

## 17. 알림 / 감사 / 첨부 기준

### 알림

- 부분 입고 발생 시 branch manager와 brand operator에게 알림
- 금액 불일치 발생 시 accounting 알림
- 높은 severity 예외는 대시보드와 알림 양쪽에 노출

### 감사 로그

- receiving 생성 / 수정 / 완료
- invoice 업로드 / 매칭 / 승인
- exception 생성 / 해소 / 재오픈
- 첨부 추가 / 삭제

### 첨부

- 송장 파일
- 입고 사진
- 공급사 확인 자료
- 첨부는 reference entity와 업로더 정보를 함께 남긴다.

## 18. 운영상 중요한 누락 방지 항목

### 차이 코드 표준화

- shortage
- over delivery
- damaged
- substituted
- missing item

### 허용 오차 정책

- 금액
- 단가
- 수량

### 수동 해소 가이드

- 해소 사유를 자유 텍스트만 두지 않고 코드화 가능성을 열어둔다.
- 해소 후 후속 조치가 필요한 경우 memo 또는 linked task를 남긴다.

## 19. 비기능 요구사항

### 보안

- 첨부 접근은 brand / branch scope를 따른다.
- 회계 관련 송장은 최소 권한 원칙을 적용한다.

### 성능

- 입고 대기 목록과 예외 큐는 기본 필터에서 빠르게 조회되어야 한다.
- invoice match 계산은 동기 처리 범위를 제한하고 무거운 비교는 비동기 후보로 남긴다.

### 관측성

- receiving 완료 수
- variance 발생 수
- exception backlog
- invoice match success rate

### 복구 가능성

- 송장 첨부 실패 시 재업로드가 가능해야 한다.
- 예외 생성 실패는 재처리 가능한 형태로 로깅한다.

## 20. 테스트 전략

### Unit test 우선 대상

- receiving 상태 전이
- variance calculator
- exception dedupe
- invoice match service

### e2e 우선 시나리오

- 정상 입고
- 부분 입고
- 초과 입고
- 송장 매칭 성공
- 금액 불일치 예외 생성
- 예외 해소 / 재오픈

### UI 검증 포인트

- line별 입력 오류 표시
- variance summary 가독성
- 예외 severity 강조

## 21. 완료 기준

- 운영자가 입고를 등록할 수 있다.
- 부분 입고와 차이를 기록할 수 있다.
- 송장을 업로드하고 수동 매칭할 수 있다.
- 불일치가 예외 큐로 떠야 한다.
- 예외 해소 이력이 남아야 한다.

## 22. 배포와 롤아웃

### 초기 도입 권장 방식

- Phase 1 사용 고객 중 수동 입고 운영이 많은 파일럿 고객부터 적용한다.
- 송장 업로드는 일부 브랜드에서 먼저 활성화한다.

### 롤아웃 체크리스트

- discrepancy code 사전 배포
- 회계 사용자 권한 확인
- 첨부 저장 정책 점검
- 예외 우선순위 기준 공유

### 운영 백업 플랜

- 송장 매칭 실패 시 수동 승인 플로우 유지
- 예외 큐 사용 전에도 입고 기록은 보존되도록 한다.
- 외부 회계 처리 여부와 관계없이 procurement 마감은 수동으로 종료 가능해야 한다.

## 23. 미결정 사항

- invoice line 단위 저장 범위를 어디까지 강제할지
- variance 허용 오차 기본값을 브랜드 공통으로 둘지
- 예외 severity 자동 산정 규칙을 얼마나 세분화할지
- `CLOSED` 전환 시 필요한 내부 확인 체크리스트 범위

## 24. 다음 추천 작업

1. Phase 2 migration pseudo-SQL 작성
2. discrepancy code 사전 작성
3. 예외 우선순위 규칙 작성
4. 송장 업로드 / 첨부 정책 작성
