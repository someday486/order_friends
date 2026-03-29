# 자재 발주 시스템 Phase 4 통합 명세서

작성일: 2026-03-30
상태: Draft v1
문서 성격: Phase 4 자동화 / 연동 / 공급사 포털 기준서
현재 유지 문서:

- `docs/material-procurement-phase4-master-spec-2026-03-30.md`
- `docs/material-procurement-phase1-master-spec-2026-03-30.md`
- `docs/material-procurement-all-phases-master-spec-2026-03-30.md`

## 1. 문서 목적

이 문서는 자재 발주 시스템의 자동화와 외부 연동 고도화 영역을 정리한 문서다.

Phase 4의 목적은 수동 운영을 줄이되, 예외가 발생했을 때 다시 사람이 통제권을 가질 수 있도록 설계하는 것이다.

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

- `POST /customer/procurement/purchase-orders/:purchaseOrderId/auto-send`
- `GET /customer/procurement/send-jobs`
- `GET /customer/procurement/send-jobs/:jobId`
- `POST /customer/procurement/inbound-documents/parse`
- `GET /customer/procurement/inbound-documents/:jobId`
- `GET /customer/procurement/approval-policies`
- `POST /customer/procurement/approval-policies`
- `PATCH /customer/procurement/approval-policies/:policyId`
- `GET /supplier-portal/purchase-orders`
- `GET /supplier-portal/purchase-orders/:purchaseOrderId`
- `POST /supplier-portal/purchase-orders/:purchaseOrderId/acknowledge`

## 9. 핵심 엔티티

- `procurement_auto_send_jobs`
- `procurement_send_job_attempts`
- `procurement_inbound_document_jobs`
- `procurement_document_parse_results`
- `procurement_approval_policies`
- `procurement_approval_policy_rules`
- `procurement_supplier_portal_users`
- `procurement_supplier_acks`

## 10. 핵심 비즈니스 규칙

### 자동 전송

- 공급사 채널이 준비된 경우에만 자동 전송 가능
- 실패 시 재시도 정책 필요
- 일정 횟수 실패하면 예외 큐로 전환

### 문서 파싱

- 파싱 결과는 초안일 뿐 자동 확정하지 않는다.
- 사람이 검토 후 반영하는 흐름을 유지한다.

### 승인 정책

- 조건 평가 순서를 고정한다.
- 충돌 시 우선순위 정책이 필요하다.

### 공급사 응답

- 공급사 응답은 내부 PO 상태와 일관되게 매핑되어야 한다.
- 응답 이력은 append-only로 저장하는 것을 권장한다.

## 11. 운영상 중요한 누락 방지 항목

### 채널 다양성

- email
- file export
- portal
- 추후 EDI / API

### 실패 복구

- retry
- 수동 전환
- 예외 큐 연동

### 보안

- supplier portal은 별도 인증 정책 필요
- 문서 파싱 결과 접근 권한 제한 필요

## 12. 테스트 전략

우선 테스트:

- auto send success / fail / retry
- parse job 생성 / 검토 / 반영
- approval policy 조건 매칭
- supplier acknowledge 흐름

## 13. 완료 기준

- 자동 전송 job이 생성되고 상태가 추적된다.
- 문서 파싱 결과를 검토하고 반영할 수 있다.
- 다단계 승인 정책을 저장하고 평가할 수 있다.
- 공급사가 발주서를 확인하고 응답할 수 있다.

## 14. 다음 추천 작업

1. 공급사 채널별 연동 우선순위 결정
2. parse job 상태 모델 상세화
3. approval rule DSL 또는 JSON 구조 설계
4. supplier portal 보안 정책 문서화
