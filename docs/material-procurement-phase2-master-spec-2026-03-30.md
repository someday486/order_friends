# 자재 발주 시스템 Phase 2 통합 명세서

작성일: 2026-03-30
상태: Draft v1
문서 성격: Phase 2 입고 / 송장 / 예외 처리 기준서
현재 유지 문서:

- `docs/material-procurement-phase2-master-spec-2026-03-30.md`
- `docs/material-procurement-phase1-master-spec-2026-03-30.md`
- `docs/material-procurement-all-phases-master-spec-2026-03-30.md`

## 1. 문서 목적

이 문서는 Phase 2에서 추가되는 입고, 송장, 예외 처리 영역을 한 문서로 통합한 기준서다.

Phase 2는 발주 이후 실제 운영의 핵심을 다루므로, 정합성과 예외 처리 정책을 함께 정의한다.

## 2. Phase 2 목표

Phase 2의 목표는 발주가 끝난 뒤 실제 납품과 정산 직전까지의 운영을 시스템 안에 넣는 것이다.

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
- 정산 지급 자동화
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

### Receivings

- `GET /customer/procurement/receivings`
- `POST /customer/procurement/purchase-orders/:purchaseOrderId/receivings`
- `GET /customer/procurement/receivings/:receivingId`
- `PATCH /customer/procurement/receivings/:receivingId`

### Invoices

- `GET /customer/procurement/invoices`
- `POST /customer/procurement/invoices`
- `GET /customer/procurement/invoices/:invoiceId`
- `POST /customer/procurement/invoices/:invoiceId/match`
- `POST /customer/procurement/invoices/:invoiceId/approve`

### Exceptions

- `GET /customer/procurement/exceptions`
- `GET /customer/procurement/exceptions/:exceptionId`
- `POST /customer/procurement/exceptions/:exceptionId/resolve`
- `POST /customer/procurement/exceptions/:exceptionId/reopen`

## 9. 핵심 DTO / 응답 모델

필요 DTO 묶음:

- receiving query / request / response
- invoice query / request / response
- exception query / request / response
- discrepancy code enum
- match result response

핵심 응답 필드:

- receiving summary
- line-level discrepancies
- invoice match status
- exception severity
- available actions

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
- `SETTLED`
- `CLOSED`

### Exception

- `OPEN`
- `IN_PROGRESS`
- `RESOLVED`
- `REOPENED`
- `DISMISSED`

## 11. 핵심 엔티티

- `procurement_receivings`
- `procurement_receiving_lines`
- `procurement_invoices`
- `procurement_invoice_lines`
- `procurement_invoice_match_results`
- `procurement_exceptions`
- `procurement_exception_resolutions`
- `attachments`

## 12. 핵심 비즈니스 규칙

### 입고

- receiving은 purchase order 기준으로 생성한다.
- line별 received qty는 0 이상이어야 한다.
- ordered qty보다 초과 입고 시 discrepancy type이 필요하다.
- 부분 입고는 명시적 상태로 저장한다.

### 송장

- 송장 업로드 시 공급사와 매장을 명확히 지정한다.
- 수동 매칭 대상은 동일 supplier / branch 범위여야 한다.
- 총액 불일치와 단가 불일치를 구분한다.

### 예외

- 차이가 발생하면 예외 큐 생성이 우선이다.
- 예외 해소는 사유와 담당자를 남겨야 한다.
- 해소 후 다시 문제가 발견되면 reopen 가능해야 한다.

## 13. 권한 규칙

- `branch_staff`: 입고 초안 입력 보조
- `branch_manager`: 입고 확정
- `brand_operator`: 예외 처리, 송장 검토
- `accounting`: 송장 승인 및 회계 검토

## 14. 운영상 중요한 누락 방지 항목

### 차이 코드 표준화

- shortage
- over delivery
- damaged
- substituted
- missing item

### 첨부 기준

- 송장 파일
- 입고 사진
- 공급사 확인 자료

### 허용 오차 정책

- 금액
- 단가
- 수량

## 15. 테스트 전략

우선 테스트:

- 정상 입고
- 부분 입고
- 초과 입고
- 송장 매칭 성공
- 금액 불일치 예외 생성
- 예외 해소 / 재오픈

## 16. 완료 기준

- 운영자가 입고를 등록할 수 있다.
- 부분 입고와 차이를 기록할 수 있다.
- 송장을 업로드하고 수동 매칭할 수 있다.
- 불일치가 예외 큐로 떠야 한다.
- 예외 해소 이력이 남아야 한다.

## 17. 다음 추천 작업

1. Phase 2 DB 스키마 확장안 작성
2. discrepancy code 사전 작성
3. 예외 우선순위 규칙 작성
4. 송장 업로드 / 첨부 정책 작성
