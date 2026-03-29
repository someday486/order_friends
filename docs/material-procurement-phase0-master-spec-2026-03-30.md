# 자재 발주 시스템 Phase 0 통합 명세서

작성일: 2026-03-30
상태: Draft v1
문서 성격: Phase 0 기반 설계 기준서
현재 유지 문서:

- `docs/material-procurement-phase0-master-spec-2026-03-30.md`
- `docs/material-procurement-phase1-master-spec-2026-03-30.md`
- `docs/material-procurement-all-phases-master-spec-2026-03-30.md`

## 1. 문서 목적

이 문서는 자재 발주 시스템의 구현 전 단계에서 반드시 고정해야 할 공통 기준을 정리한 문서다.

Phase 0의 목적은 화면을 만드는 것이 아니라 이후 모든 페이즈가 흔들리지 않도록 아래를 먼저 확정하는 것이다.

- 용어
- 권한
- 상태 모델
- 도메인 모델
- scope 규칙
- 번호 체계
- 감사 로그 원칙

## 2. Phase 0 목표

Phase 0이 끝나면 팀이 같은 단어와 같은 구조를 보고 이야기할 수 있어야 한다.

완료 상태는 아래와 같다.

- PM, 디자이너, 백엔드, 프런트가 같은 엔티티 이름을 쓴다.
- request, purchase order, receiving, invoice의 차이를 명확히 안다.
- brand / branch / supplier scope 규칙이 문서화된다.
- 상태 전이와 권한 규칙이 충돌 없이 정리된다.
- 이후 migration과 API 설계가 크게 되돌아가지 않는다.

## 3. 포함 범위

### 포함

- 용어 사전
- 핵심 엔티티 정의
- 상태 모델 정의
- 설정 계층 정의
- 권한 / 역할 정의
- 식별자 / 번호 체계 정의
- 감사 로그 원칙
- 비기능 요구사항 초안
- 릴리스 기준의 상위 원칙

### 제외

- 실제 API 구현
- 실제 화면 구현
- 실제 migration 작성
- 실제 연동 개발

## 4. 공통 용어 사전

### Procurement Item

- 브랜드 공통 기준 자재 품목

### Supplier Item

- 공급사 입장에서 발주되는 실제 품목

### Purchase Request

- 매장 또는 운영자가 작성하는 발주 요청서

### Purchase Order

- 공급사에 전달되는 공식 발주서

### Receiving

- 입고 확인 기록

### Supplier Invoice

- 공급사가 보낸 송장 또는 거래명세 문서

### Exception

- 정상 플로우에서 벗어난 차이, 실패, 보류 항목

## 5. 핵심 엔티티 정의

### Master

- `Supplier`
- `SupplierChannel`
- `ProcurementItem`
- `SupplierItem`
- `OrderGuide`
- `ParLevel`

### Transaction

- `PurchaseRequest`
- `PurchaseOrder`
- `Receiving`
- `SupplierInvoice`
- `Adjustment`
- `SupplierStatement`

### Support

- `Attachment`
- `AuditLog`
- `CommentThread`
- `ExceptionQueue`
- `ApprovalPolicy`
- `NotificationEvent`

## 6. Scope 모델

### Brand Scope

- 최상위 운영 단위
- 공급사, 공통 품목, 브랜드 기본 설정의 기준

### Branch Scope

- 실제 발주와 입고가 일어나는 단위
- 브랜드 하위에 속해야 한다

### Supplier Scope

- 브랜드 또는 매장에 연결된 발주 대상

### Scope 원칙

- 모든 branch는 정확히 하나의 brand에 속한다.
- supplier는 brand를 기본 소속으로 가진다.
- branch override 설정은 brand 기본값을 덮을 수 있다.
- branch가 supplier를 사용하려면 명시적 연결이 필요하다.

## 7. 역할과 권한 모델

### 역할

- `brand_owner`
- `brand_operator`
- `branch_manager`
- `branch_staff`
- `accounting`
- `supplier_user` Phase 4 대비 예약

### 기본 권한 원칙

- 소유자와 운영자는 브랜드 기준 관리 권한을 가진다.
- 매장 매니저는 매장 운영 권한을 가진다.
- 매장 스태프는 요청 생성과 보조 입력 중심이다.
- 회계는 송장과 정산 중심 권한을 가진다.

### 권한 설계 원칙

- 읽기 권한과 쓰기 권한을 분리한다.
- 같은 역할이라도 brand / branch scope에 따라 접근 범위를 제한한다.
- 승인 권한은 일반 수정 권한보다 더 좁게 본다.

## 8. 상태 모델

### Purchase Request

- `DRAFT`
- `SUBMITTED`
- `APPROVED`
- `REJECTED`
- `CONVERTED_TO_PO`

### Purchase Order

- `DRAFT`
- `READY_TO_SEND`
- `SENT`
- `ACKNOWLEDGED`
- `PARTIALLY_RECEIVED`
- `RECEIVED`
- `INVOICED`
- `CLOSED`
- `FAILED_TO_SEND`
- `CANCELLED`
- `EXCEPTION`

### Receiving

- `PENDING`
- `PARTIAL`
- `COMPLETED`
- `DISCREPANCY_REPORTED`
- `RESOLVED`

### Supplier Invoice

- `UPLOADED`
- `MATCHED`
- `VARIANCE_DETECTED`
- `APPROVED`
- `SETTLED`
- `CLOSED`

## 9. 상태 전이 원칙

### Request

- `DRAFT`에서만 자유 수정 가능
- `SUBMITTED` 이후에는 승인 또는 반려로만 이동
- `APPROVED` 이후에는 PO 전환 또는 취소 정책을 별도 정의

### Purchase Order

- `READY_TO_SEND`에서 전송 가능
- `SENT` 이후에는 receiving / invoice와 연결될 수 있음
- 종료 상태 이후 수정은 금지

### 상태 전이 설계 원칙

- 상태 변경은 단일 서비스 계층에서 통제한다.
- 상태 변경 시 감사 로그를 남긴다.
- 상태 변경 실패는 명확한 사유와 함께 반환한다.

## 10. 설정 계층

필요 설정 범위:

- brand
- branch
- supplier
- feature
- approval policy
- tolerance rule
- notification rule

Phase 0에서 확정할 기준:

- brand 기본값 + branch override 구조
- 설정 키 네이밍
- null 처리 전략
- 설정 조회 우선순위

## 11. 번호 체계

### 권장 형식

- `request_no`: `PR-YYYYMMDD-SEQ`
- `purchase_order_no`: `PO-YYYYMMDD-SEQ`
- `receiving_no`: `RCV-YYYYMMDD-SEQ`
- `invoice_no`: 공급사 원본 + 내부 보조 식별자 분리

### 번호 체계 원칙

- 사용자에게 읽히는 번호와 DB primary key를 분리한다.
- 브랜드별 또는 시스템 전체 시퀀스 전략을 미리 정한다.
- 중복 방지 규칙을 문서화한다.

## 12. 감사 로그 원칙

반드시 기록할 대상:

- 생성
- 수정
- 제출
- 승인
- 반려
- 전환
- 전송
- 취소
- 해소

감사 로그 최소 필드:

- entityType
- entityId
- action
- actorUserId
- actorRole
- scope
- summary
- details
- createdAt

## 13. 데이터 원칙

### 공통

- DB 컬럼은 snake_case
- TypeScript는 camelCase
- 금액은 정수 기준 저장을 우선 검토
- 통화는 명시적 필드로 저장

### 보존

- 운영 이력은 삭제보다 보존 우선
- soft delete 여부를 엔티티별로 문서화

### 동시성

- 수정 충돌 방지를 위한 optimistic check 고려

## 14. 비기능 요구사항

### 보안

- scope isolation 필수
- 승인 액션에 대한 추가 검증 필요

### 성능

- 목록 API는 pagination 기본
- summary 집계는 과도한 join 회피

### 관측성

- 주요 상태 전이 이벤트 로깅
- 실패 사유 로깅

## 15. Phase 0 산출물 체크리스트

- 엔티티 목록 확정
- 상태 목록 확정
- 권한 표 확정
- 설정 계층 확정
- 번호 체계 확정
- 감사 로그 필드 확정
- 공통 API 규칙 초안 확정
- 용어 사전 확정

## 16. 완료 기준

- 팀이 동일한 용어를 사용한다.
- 후속 Phase 문서들이 이 기준을 참조해도 충돌이 없다.
- DB / API / 화면 명세 작성이 바로 가능한 수준이다.

## 17. 다음 추천 작업

1. Phase 1 구현 기준서 보강
2. migration pseudo-SQL 설계
3. 공통 enum / 상수 정의 초안 작성
4. 권한 매트릭스 표 작성
