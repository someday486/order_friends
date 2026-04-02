# 자재 발주 시스템 Phase 4 통합 명세서

작성일: 2026-03-30
상태: Draft v3
문서 성격: Phase 4 자동화 / 연동 / 공급사 포털 실행 기준서
현재 유지 문서:

- `docs/specs/material-procurement-phase4-master-spec-2026-03-30.md`
- `docs/specs/material-procurement-phase1-master-spec-2026-03-30.md`
- `docs/specs/material-procurement-phase2-master-spec-2026-03-30.md`
- `docs/specs/material-procurement-all-phases-master-spec-2026-03-30.md`

## 1. 문서 목적

이 문서는 자재 발주 시스템의 자동화와 외부 연동 고도화 영역을 정리한 문서다.

Phase 4의 목적은 수동 운영을 줄이되, 예외가 발생했을 때 다시 사람이 통제권을 가질 수 있도록 설계하는 것이다.

Phase 4는 Phase 1의 승인 기본 규칙과 Phase 2의 예외 처리 규칙을 상속하며, 이를 우회하는 별도 상태 체계를 만들지 않는다.

이 문서 하나만 보면 아래를 판단할 수 있어야 한다.

- 어떤 자동화가 허용되고 어디서 사람이 개입하는지
- 공급사 채널, 파싱, 승인 정책, 포털이 어떻게 연결되는지
- 어떤 API, DTO, 테이블, 상태 모델이 필요한지
- 보안과 실패 복구 기준이 무엇인지
- 구현 후 어떤 기준으로 배포하고 운영할지

## 2. Phase 4 목표

아래 기능이 가능해야 한다.

- 특정 공급사에 자동 발주 전송
- 문서 OCR / 파싱 작업
- 공급사 포털 기반 응답
- 조건 기반 다단계 승인 정책
- 외부 채널 연동 작업 관리

## 3. 포함 범위

### 포함

- auto send job
- inbound document parse job
- supplier portal
- approval policy
- integration status 화면

### 제외

- 완전 무인 운영
- 모든 공급사 채널 동시 지원
- 회계 시스템까지의 완전 자동 정산

## 4. 대상 사용자

- `brand_owner`
- `brand_operator`
- `accounting`
- `supplier_user`

## 5. 핵심 운영 시나리오

### 시나리오 A. 자동 전송

1. 브랜드 운영자가 공급사 채널을 설정한다.
2. 승인 완료된 PO가 자동 전송 대상으로 올라간다.
3. send job이 실행된다.
4. 성공 / 실패 여부가 기록된다.
5. 실패 시 운영자가 수동으로 전환한다.

### 시나리오 B. 문서 파싱

1. 송장 또는 명세 파일을 업로드한다.
2. 파싱 job이 실행된다.
3. 추출 결과를 사람이 검토한다.
4. 확정 시 invoice 또는 receiving 데이터에 반영한다.

### 시나리오 C. 공급사 포털 응답

1. 공급사가 포털에서 발주서를 확인한다.
2. 수락, 수정 요청, 납기 변경을 응답한다.
3. 응답 결과가 내부 PO와 연결된다.

### 시나리오 D. 다단계 승인

1. 금액 또는 공급사 조건에 따라 정책이 선택된다.
2. 여러 승인 단계가 순서대로 진행된다.
3. 모든 필수 단계 완료 후 다음 상태로 이동한다.

## 6. 화면 구조

### 라우트

- `/customer/procurement/integrations`
- `/customer/procurement/integrations/send-jobs`
- `/customer/procurement/inbound-documents`
- `/customer/procurement/approval-policies`
- `/supplier-portal/purchase-orders`
- `/supplier-portal/purchase-orders/[purchaseOrderId]`

### 메뉴

- 연동
- 자동 전송
- 문서 파싱
- 승인 정책
- 공급사 포털

## 7. 화면 명세

### 7-1. 자동 전송 작업 화면

목적:

- 자동 전송 시도와 실패를 운영자가 추적한다.

컬럼:

- job id
- supplier
- purchase order no
- channel
- status
- retry count
- last error

주요 액션:

- 재시도
- 수동 전환
- 상세 로그 보기

### 7-2. 문서 파싱 화면

목적:

- OCR / parser 결과를 검토하고 반영한다.

핵심 섹션:

- 원본 파일
- 추출 텍스트
- 구조화 결과
- 검토 상태
- 반영 액션

### 7-3. 승인 정책 화면

목적:

- 금액, 공급사, 카테고리 등에 따른 승인 단계를 설정한다.

핵심 항목:

- 정책명
- 적용 조건
- 승인 단계 목록
- 필수 여부

### 7-4. 공급사 포털 화면

목적:

- 공급사가 발주서를 조회하고 응답한다.

핵심 기능:

- 발주서 조회
- 수락
- 수정 요청
- 납기 변경 응답

## 8. API 명세

### 8-1. Prefix

- `/customer/procurement/*`
- `/supplier-portal/*`

### 8-2. Auto Send / Integrations

- `POST /customer/procurement/purchase-orders/:purchaseOrderId/auto-send`
- `GET /customer/procurement/send-jobs`
- `GET /customer/procurement/send-jobs/:jobId`
- `POST /customer/procurement/send-jobs/:jobId/retry`

### 8-3. Inbound Documents

- `POST /customer/procurement/inbound-documents/parse`
- `GET /customer/procurement/inbound-documents/:jobId`
- `POST /customer/procurement/inbound-documents/:jobId/apply`

### 8-4. Approval Policies

- `GET /customer/procurement/approval-policies`
- `POST /customer/procurement/approval-policies`
- `PATCH /customer/procurement/approval-policies/:policyId`

### 8-5. Supplier Portal

- `GET /supplier-portal/purchase-orders`
- `GET /supplier-portal/purchase-orders/:purchaseOrderId`
- `POST /supplier-portal/purchase-orders/:purchaseOrderId/acknowledge`

## 9. DTO / Swagger 기준

### 네이밍

- Request DTO: `*Request`
- Response DTO: `*Response`
- Query DTO: `Get*QueryDto`
- Action DTO: `*ActionRequest`

### Swagger 태그

- `customer-procurement-send-jobs`
- `customer-procurement-inbound-documents`
- `customer-procurement-approval-policies`
- `supplier-portal-purchase-orders`

### 기본 응답 코드

- `200` 조회 / 수정 성공
- `201` 생성 성공
- `400` 잘못된 요청
- `401` 인증 실패
- `403` 권한 없음
- `404` 리소스 없음
- `409` 상태 충돌 또는 중복 실행

### DTO 핵심 묶음

- send job query / response / retry request
- parse job create / review / apply request
- approval policy create / patch / response
- approval rule response
- supplier portal acknowledge request / response
- integration error response

## 10. 상태 모델

### Send Job

- `QUEUED`
- `RUNNING`
- `SUCCEEDED`
- `FAILED`
- `CANCELLED`

### Parse Job

- `UPLOADED`
- `PROCESSING`
- `REVIEW_REQUIRED`
- `APPLIED`
- `FAILED`

### Approval Policy

- `ACTIVE`
- `INACTIVE`
- `DRAFT`

### Supplier Ack

- `ACKNOWLEDGED`
- `CHANGE_REQUESTED`
- `DELIVERY_DATE_UPDATED`

## 11. 핵심 도메인 모델

### AutoSendJob

- 전송 대상 PO와 채널, 시도 상태를 관리하는 작업 엔티티

### SendJobAttempt

- 개별 전송 시도와 에러 로그 저장

### InboundDocumentJob

- 업로드 파일 기준 파싱 작업 엔티티

### DocumentParseResult

- 구조화 결과와 검토 상태 저장

### ApprovalPolicy

- 조건 기반 다단계 승인 정책 헤더

### ApprovalPolicyRule

- 금액, 공급사, 카테고리, 브랜드 범위 조건과 단계 정의

### SupplierPortalUser

- 공급사 포털 전용 사용자 및 접근 범위

### SupplierAck

- 공급사 응답 원문과 상태 매핑 이력

## 12. DB 스키마 요약

### 핵심 테이블

- `procurement_auto_send_jobs`
- `procurement_send_job_attempts`
- `procurement_inbound_document_jobs`
- `procurement_document_parse_results`
- `procurement_approval_policies`
- `procurement_approval_policy_rules`
- `procurement_supplier_portal_users`
- `procurement_supplier_acks`

### 핵심 컬럼 원칙

- send job은 `purchase_order_id`, `supplier_id`, `channel`, `status`, `retry_count`, `last_error`를 가진다.
- send job attempt는 `job_id`, `attempt_no`, `started_at`, `finished_at`, `result_status`, `error_payload`를 가진다.
- parse job은 `file_attachment_id`, `status`, `requested_by`, `source_type`을 가진다.
- parse result는 `job_id`, `parsed_payload`, `review_status`, `applied_reference_type`, `applied_reference_id`를 가진다.
- approval policy는 `brand_id`, `name`, `status`, `priority`, `effective_from`을 가진다.
- approval policy rule은 `policy_id`, `sequence_no`, `condition_payload`, `approver_role`, `required`를 가진다.
- supplier ack는 `purchase_order_id`, `supplier_user_id`, `ack_status`, `response_payload`, `mapped_po_status`, `requires_internal_review`, `proposed_delivery_date`, `received_at`을 가진다.

### 인덱스 우선 대상

- `procurement_auto_send_jobs(status, created_at)`
- `procurement_auto_send_jobs(supplier_id, purchase_order_id)`
- `procurement_inbound_document_jobs(status, created_at)`
- `procurement_approval_policies(brand_id, status, priority)`
- `procurement_supplier_acks(purchase_order_id, received_at desc)`

### 연결 원칙

- auto send는 Phase 1 purchase order와 직접 연결한다.
- parse 결과는 Phase 2 receiving / invoice 엔티티에 반영될 수 있어야 한다.
- supplier portal 응답은 원본 payload와 내부 매핑 결과를 함께 보존한다.

## 13. Controller / Service 책임

### Controller 책임

- retry, apply 같은 action endpoint를 명시적으로 분리한다.
- supplier portal과 customer 영역 인증 / swagger 태그를 분리한다.
- approval policy 조건 payload를 request DTO로 검증한다.

### Service 책임

- 채널 준비 여부와 전송 가능 상태를 검증한다.
- 재시도 횟수와 실패 전환 규칙을 적용한다.
- parse 결과를 사람이 검토한 뒤에만 반영한다.
- approval policy 우선순위와 조건 평가를 수행한다.
- supplier 응답을 내부 PO 상태와 일관되게 매핑한다.
- supplier 변경 요청이나 납기 변경은 예외 생성과 내부 검토 플로우로 연결한다.

### 공통 helper 필요 항목

- channel capability resolver
- retry policy evaluator
- parse result mapper
- approval rule matcher
- supplier response normalizer

## 14. 권한 규칙

### 자동 전송 / 연동

- `brand_owner`와 `brand_operator`가 연동 설정과 job 재시도를 관리한다.
- `accounting`는 문서 파싱 검토에 참여할 수 있다.

### 승인 정책

- 승인 정책 생성 / 수정은 기본적으로 `brand_owner`가 담당한다.
- 운영 편의를 위해 `brand_operator`에게 제한적 수정 권한을 열 수 있다.
- 정책은 Phase 1 기본 승인 규칙을 대체하지 않고 확장한다.

### 공급사 포털

- `supplier_user`는 자신에게 노출된 PO만 조회하고 응답할 수 있다.
- supplier portal 사용자는 customer 영역 데이터를 직접 조회하지 않는다.

## 15. 설정 정책

### 설정 단위

- brand
- supplier
- integration
- approval policy

### Phase 4 설정 키

- `procurement_auto_send_enabled`
- `procurement_auto_send_retry_limit`
- `procurement_parse_job_enabled`
- `procurement_supplier_portal_enabled`
- `procurement_multi_step_approval_enabled`

### 추가로 고려해야 할 설정

- 채널별 timeout
- parse 결과 자동 적용 금지 여부
- 공급사 포털 세션 정책

## 16. 핵심 비즈니스 규칙

### 자동 전송

- 공급사 채널이 준비된 경우에만 자동 전송 가능
- 실패 시 재시도 정책 필요
- 일정 횟수 실패하면 예외 큐로 전환
- 사람이 수동 전환하면 자동 재시도와 충돌하지 않아야 한다.

### 문서 파싱

- 파싱 결과는 초안일 뿐 자동 확정하지 않는다.
- 사람이 검토 후 반영하는 흐름을 유지한다.
- 원본 파일과 구조화 결과는 함께 보존한다.

### 승인 정책

- 조건 평가 순서를 고정한다.
- 충돌 시 우선순위 정책이 필요하다.
- 모든 필수 단계가 완료되기 전에는 다음 상태로 넘어가지 않는다.
- `approvalMode = NONE`이면 다단계 승인 정책을 평가하지 않는다.
- self-approval은 기본적으로 금지하며 `allowBranchSelfApproval = true`일 때만 예외 허용한다.

### 공급사 응답

- 공급사 응답은 내부 PO 상태와 일관되게 매핑되어야 한다.
- 응답 이력은 append-only로 저장하는 것을 권장한다.
- 납기 변경은 제안과 확정 상태를 구분한다.
- `ACKNOWLEDGED` 응답은 canonical PO 상태 `ACKNOWLEDGED`로 매핑한다.
- `CHANGE_REQUESTED` 응답은 line을 자동 수정하지 않고 예외 `SUPPLIER_CHANGE_REQUEST`를 생성하며 PO를 `EXCEPTION`으로 둔다.
- `DELIVERY_DATE_UPDATED` 응답은 제안 납기일을 저장하고 예외 `SUPPLIER_DELIVERY_DATE_CHANGE`를 생성한다.
- 납기 변경 제안을 내부 운영자가 수락하기 전까지 PO의 기준 납기일을 자동 변경하지 않는다.

## 17. 알림 / 감사 / 보안 기준

### 알림

- send job 실패는 운영자에게 즉시 알림 후보다.
- parse review 대기 건은 관련 담당자 큐에 노출한다.
- 공급사 납기 변경 요청은 내부 승인자에게 전달한다.

### 감사 로그

- send job 생성 / 실행 / 재시도 / 실패
- parse 결과 검토 / 반영
- approval policy 생성 / 수정 / 비활성화
- supplier ack 수신과 내부 상태 반영

### 보안

- supplier portal은 별도 인증 정책이 필요하다.
- parse 결과와 원본 문서는 접근 권한 제한이 필요하다.
- 외부 채널 credential은 문서와 코드에서 직접 노출하지 않는다.

## 18. 운영상 중요한 누락 방지 항목

### 채널 다양성

- email
- file export
- portal
- 추후 EDI / API

### 실패 복구

- retry
- 수동 전환
- 예외 큐 연동
- 운영자 메모 보존

### 사람이 개입하는 지점

- parse 결과 최종 반영
- 공급사 수정 요청 승인 여부
- 다단계 승인 정책 충돌 조정
- supplier ack가 예외로 승격될지 여부 확인

## 19. 비기능 요구사항

### 보안

- customer 영역과 supplier portal 영역의 인증 경계를 분리한다.
- 외부 연동 오류 payload는 민감 정보를 마스킹한다.

### 성능

- send job 목록과 approval policy 조회는 기본 필터 기준 빠르게 응답해야 한다.
- 무거운 parse 작업은 비동기로 처리한다.

### 관측성

- send success rate
- retry count
- parse apply latency
- approval policy hit rate

### 복구 가능성

- 채널 장애 시 수동 전환 경로를 유지한다.
- parse 실패와 ack 처리 실패는 재처리 가능하게 기록한다.

## 20. 테스트 전략

### Unit test 우선 대상

- retry policy evaluator
- approval rule matcher
- supplier response normalizer
- parse result apply service

### e2e 우선 시나리오

- auto send success / fail / retry
- parse job 생성 / 검토 / 반영
- approval policy 조건 매칭
- supplier acknowledge 흐름

### UI 검증 포인트

- 실패 상태 가시성
- parse diff 검토 가독성
- approval policy 충돌 안내

## 21. 완료 기준

- 자동 전송 job이 생성되고 상태가 추적된다.
- 문서 파싱 결과를 검토하고 반영할 수 있다.
- 다단계 승인 정책을 저장하고 평가할 수 있다.
- 공급사가 발주서를 확인하고 응답할 수 있다.

## 22. 배포와 롤아웃

### 초기 도입 권장 방식

- email 또는 file export 채널부터 적용한다.
- supplier portal은 협조 가능한 공급사 일부를 대상으로 파일럿한다.
- 다단계 승인 정책은 조회 / 저장부터 열고 실제 적용은 단계적으로 진행한다.

### 롤아웃 체크리스트

- 채널별 credential 준비
- parse review 담당자 지정
- portal 사용자 온보딩
- approval priority 규칙 점검
- Phase 1 승인 기본값과 self-approval 정책 확인

### 운영 백업 플랜

- 자동 전송 실패 시 수동 전송 기록 플로우 유지
- parse 미적용 상태에서도 기존 Phase 2 수동 입력 플로우 유지

## 23. 미결정 사항

- 공급사 채널별 우선순위 정책
- parse 결과 구조화 스키마 범위
- approval rule payload 형식
- supplier portal 비밀번호 / SSO 정책

## 24. 다음 추천 작업

1. 공급사 채널별 연동 우선순위 결정
2. parse job 상태 모델 상세화
3. approval rule payload 구조 정리
4. supplier portal 보안 정책 문서화
