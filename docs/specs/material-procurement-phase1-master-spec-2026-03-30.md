# 자재 발주 시스템 Phase 1 통합 명세서

작성일: 2026-03-30
상태: Draft v2
문서 성격: Phase 1 실행 기준서
현재 유지 문서:

- `docs/specs/material-procurement-phase1-master-spec-2026-03-30.md`
- `docs/specs/material-procurement-all-phases-master-spec-2026-03-30.md`

## 1. 문서 목적

이 문서는 자재 발주 시스템 Phase 1에 필요한 기획, 화면, API, DB, DTO, 서비스 책임, 검증 기준을 한 문서로 통합한 기준서다.

이 문서 하나만 보면 아래를 판단할 수 있어야 한다.

- Phase 1에서 어디까지 구현하는지
- 어떤 사용자와 역할이 사용하는지
- 화면과 API가 어떻게 이어지는지
- 어떤 테이블과 상태 모델이 필요한지
- 구현 후 무엇을 테스트하고 어떤 기준으로 배포할지

## 2. Phase 1 목표

Phase 1의 목표는 브랜드 또는 매장이 실제로 사용할 수 있는 최소 자재 발주 운영 흐름을 만드는 것이다.

Phase 1이 완료되면 최소한 아래가 가능해야 한다.

- 공급사를 등록하고 매장과 연결할 수 있다.
- 발주용 품목과 공급사 품목을 매핑할 수 있다.
- 매장에서 발주 요청을 생성하고 제출할 수 있다.
- 승인자가 요청을 승인 또는 반려할 수 있다.
- 승인된 요청을 발주서로 전환할 수 있다.
- 발주서를 공급사에 보냈다는 기록을 남길 수 있다.
- 모든 주요 변경 이력을 감사 로그로 남길 수 있다.

## 3. Phase 1 범위

### 포함 범위

- `customer` 영역 내 자재 발주 워크스페이스 진입
- 공급사 마스터
- 자재 품목 마스터
- 공급사 품목 매핑
- 발주 가이드
- 발주 요청 draft / submit / approve / reject
- 발주서 생성
- 발주서 전송 기록
- 브랜드 / 매장 단위 설정
- 감사 로그
- 요약 대시보드

### 제외 범위

- 입고 검수
- 부분 입고
- 송장 업로드 및 매칭
- 예외 큐
- 가격 이력
- 권장 발주
- 자동 전송
- 공급사 포털
- 다단계 승인 정책

## 4. 대상 사용자와 운영 방식

### 대상 사용자

- `brand_owner`
- `brand_operator`
- `branch_manager`
- `branch_staff`
- `accounting`

### 기본 운영 방식

Phase 1은 아래 세 가지 운영 방식 중 모두 수용할 수 있도록 설계한다.

- 브랜드 통제형
- 매장 자율형
- 혼합형

초기 추천 기본값은 혼합형이다.

- 매장은 요청 생성과 제출을 담당한다.
- 브랜드 운영자는 승인과 발주 전환을 담당한다.
- 작은 고객사는 설정에서 승인 단계를 약화해 매장 자율형으로 운영할 수 있다.

Phase 1 기본 승인 기준은 아래와 같이 고정한다.

- `approvalMode = NONE`이면 submit 이후 별도 approve 없이 convert가 가능하다.
- self-approval은 기본적으로 금지한다.
- self-approval이 필요한 고객만 `allowBranchSelfApproval = true`를 명시적으로 켠다.

## 5. 핵심 사용자 시나리오

### 시나리오 A. 브랜드 통제형

1. 브랜드 운영자가 공급사와 품목을 먼저 등록한다.
2. 매장 매니저가 발주 요청을 작성한다.
3. 브랜드 운영자가 요청을 승인한다.
4. 시스템이 발주서를 생성한다.
5. 운영자가 이메일 또는 수동 방식으로 발주서를 전송하고 기록을 남긴다.

### 시나리오 B. 매장 자율형

1. 매장 매니저가 자신이 사용하는 공급사와 품목을 선택한다.
2. 매장 매니저가 요청을 작성한다.
3. 승인 모드가 `NONE`이면 곧바로 발주서 전환이 가능하다.
4. 매장이 직접 발주 전송 기록을 남긴다.

### 시나리오 C. 혼합형

1. 매장 staff가 draft를 만든다.
2. 매장 manager가 submit한다.
3. 브랜드 운영자가 approve한다.
4. 운영자가 발주 전환 후 전송 기록을 남긴다.

## 6. 정보 구조와 라우트

### 상단 전환

- `주문 운영`
- `자재 발주`

### 자재 발주 기본 라우트

- `/customer/procurement`
- `/customer/procurement/suppliers`
- `/customer/procurement/items`
- `/customer/procurement/order-guides`
- `/customer/procurement/requests`
- `/customer/procurement/requests/new`
- `/customer/procurement/requests/[requestId]`
- `/customer/procurement/purchase-orders`
- `/customer/procurement/purchase-orders/[purchaseOrderId]`
- `/customer/procurement/settings`

### Phase 1 네비게이션 권장 구조

- 요약
- 발주 요청
- 발주서
- 공급사
- 품목 / 발주 가이드
- 설정

## 7. 화면 명세

### 7-1. 요약 화면

route:

- `/customer/procurement`

목적:

- 오늘 처리할 주요 발주 작업을 빠르게 파악한다.

필수 카드:

- 승인 대기 요청 수
- 오늘 승인된 요청 수
- 전송 대기 발주서 수
- 오늘 전송 완료 수

필수 리스트:

- 최근 발주 요청
- 최근 발주서

빠른 액션:

- 새 발주 요청
- 공급사 관리
- 품목 관리

### 7-2. 공급사 목록 / 상세

route:

- `/customer/procurement/suppliers`

목록 컬럼:

- 공급사명
- 주문 방식
- 연결 매장 수
- 활성 상태
- 최근 발주일

상세 섹션:

- 기본 정보
- 연락처
- 주문 방식
- 리드타임 / 마감 시간
- 연결 매장
- 연결 품목 수
- 메모

주요 액션:

- 공급사 생성
- 정보 수정
- 매장 연결
- 활성 / 비활성 전환

### 7-3. 품목 / 공급사 품목 / 발주 가이드

route:

- `/customer/procurement/items`
- `/customer/procurement/order-guides`

필수 탭:

- 기본 품목
- 공급사 품목
- 발주 가이드

품목 화면 필수 컬럼:

- 코드
- 품목명
- 카테고리
- 기본 단위
- 보관 타입
- 활성 상태

공급사 품목 화면 필수 컬럼:

- 공급사
- 공급사 품목명
- 공급사 품목 코드
- 발주 단위
- 최소 발주 수량
- 단가
- 활성 상태

발주 가이드 화면 필수 항목:

- 매장
- 공급사
- 가이드명
- 기본 수량 라인

### 7-4. 발주 요청 목록

route:

- `/customer/procurement/requests`

필터:

- 브랜드
- 매장
- 공급사
- 상태
- 기간
- 검색어

컬럼:

- 요청 번호
- 매장명
- 공급사명
- 상태
- 총액
- 요청자
- 요청일
- 승인일

주요 액션:

- 새 요청
- 상세 보기
- 제출
- 승인
- 반려
- 발주서 전환

### 7-5. 발주 요청 상세 / 생성

route:

- `/customer/procurement/requests/new`
- `/customer/procurement/requests/[requestId]`

구성:

- 헤더 정보
- 공급사 선택
- 희망 납기일
- 품목 라인
- 메모
- 상태 / 승인 정보
- 감사 로그 요약

필수 UX 규칙:

- draft 상태에서는 자유 수정 가능
- submit 후에는 수정 제한
- 반려 사유가 반드시 보여야 함
- 사용 가능한 액션만 버튼 노출

### 7-6. 발주서 목록 / 상세

route:

- `/customer/procurement/purchase-orders`
- `/customer/procurement/purchase-orders/[purchaseOrderId]`

목록 컬럼:

- 발주서 번호
- 매장명
- 공급사명
- 상태
- 총액
- 생성일
- 전송일

상세 섹션:

- 헤더 정보
- source request
- 품목 라인
- 전송 기록
- 감사 로그 요약

주요 액션:

- 전송 완료 기록
- 취소

### 7-7. 설정 화면

route:

- `/customer/procurement/settings`

설정 항목:

- 자재 발주 기능 활성 여부
- 승인 모드
- 자동 발주서 생성 여부
- 기본 통화
- 브랜드 기본값 / 매장 오버라이드

## 8. API 명세

### 8-1. Prefix

- `/customer/procurement/*`

### 8-2. Summary

- `GET /customer/procurement/summary`

### 8-3. Suppliers

- `GET /customer/procurement/suppliers`
- `POST /customer/procurement/suppliers`
- `GET /customer/procurement/suppliers/:supplierId`
- `PATCH /customer/procurement/suppliers/:supplierId`
- `POST /customer/procurement/suppliers/:supplierId/activate-branches`

### 8-4. Items

- `GET /customer/procurement/items`
- `POST /customer/procurement/items`
- `PATCH /customer/procurement/items/:itemId`

### 8-5. Supplier Items

- `GET /customer/procurement/supplier-items`
- `POST /customer/procurement/supplier-items`
- `PATCH /customer/procurement/supplier-items/:supplierItemId`

### 8-6. Order Guides

- `GET /customer/procurement/order-guides`
- `POST /customer/procurement/order-guides`
- `PATCH /customer/procurement/order-guides/:orderGuideId`

### 8-7. Requests

- `GET /customer/procurement/requests`
- `POST /customer/procurement/requests`
- `GET /customer/procurement/requests/:requestId`
- `PATCH /customer/procurement/requests/:requestId`
- `POST /customer/procurement/requests/:requestId/submit`
- `POST /customer/procurement/requests/:requestId/approve`
- `POST /customer/procurement/requests/:requestId/reject`
- `POST /customer/procurement/requests/:requestId/convert-to-po`

### 8-8. Purchase Orders

- `GET /customer/procurement/purchase-orders`
- `GET /customer/procurement/purchase-orders/:purchaseOrderId`
- `POST /customer/procurement/purchase-orders/:purchaseOrderId/send`
- `POST /customer/procurement/purchase-orders/:purchaseOrderId/cancel`

### 8-9. Settings / Audit

- `GET /customer/procurement/settings`
- `PATCH /customer/procurement/settings`
- `GET /customer/procurement/audit-logs`

## 9. DTO / Swagger 기준

### 네이밍

- Request DTO: `*Request`
- Response DTO: `*Response`
- Query DTO: `Get*QueryDto`

### Swagger 태그

- `customer-procurement-summary`
- `customer-procurement-suppliers`
- `customer-procurement-items`
- `customer-procurement-order-guides`
- `customer-procurement-requests`
- `customer-procurement-purchase-orders`
- `customer-procurement-settings`
- `customer-procurement-audit-logs`

### 기본 응답 코드

- `200` 조회 / 수정 성공
- `201` 생성 성공
- `400` 잘못된 요청
- `401` 인증 실패
- `403` 권한 없음
- `404` 리소스 없음
- `409` 상태 충돌 또는 중복

### DTO 핵심 묶음

- 공통 DTO
- 공급사 DTO
- 품목 DTO
- 발주 가이드 DTO
- 요청 DTO
- 발주서 DTO
- 설정 DTO
- 감사 로그 DTO

## 10. 상태 모델

### 발주 요청 상태

- `DRAFT`
- `SUBMITTED`
- `APPROVED`
- `REJECTED`
- `CONVERTED_TO_PO`

### 발주서 상태

- `DRAFT`
- `READY_TO_SEND`
- `SENT`
- `FAILED_TO_SEND`
- `CANCELLED`

### 승인 모드

- `NONE`
- `SINGLE_STEP`

### 주문 방식

- `EMAIL`
- `MANUAL`
- `FILE_EXPORT`
- `PHONE`

## 11. 핵심 도메인 모델

### Supplier

- 브랜드 소속 공급사 마스터
- 주문 방식, 리드타임, 마감 시간, 연락처 관리

### SupplierBranch

- 특정 공급사가 어떤 매장에서 사용 가능한지 관리

### ProcurementItem

- 브랜드 공통 자재 품목

### SupplierItem

- 공급사별 품목명, 단위, 최소 수량, 단가 관리

### OrderGuide

- 매장 또는 공급사 기준의 기본 발주 리스트

### PurchaseRequest

- 매장이 작성하는 발주 요청

### PurchaseOrder

- 승인된 요청으로부터 생성되는 공식 발주서

### AuditLog

- 모든 주요 변경 이력 저장

### Settings

- 브랜드 / 매장 단위 기능과 승인 방식 저장

## 12. DB 스키마 요약

### 핵심 테이블

- `procurement_suppliers`
- `procurement_supplier_branches`
- `procurement_items`
- `procurement_supplier_items`
- `procurement_order_guides`
- `procurement_order_guide_lines`
- `procurement_requests`
- `procurement_request_lines`
- `procurement_purchase_orders`
- `procurement_purchase_order_lines`
- `procurement_purchase_order_send_logs`
- `procurement_settings`
- `procurement_audit_logs`

### 공통 컬럼 원칙

- `id uuid primary key`
- `brand_id` 필수
- `branch_id`는 row 특성에 따라 nullable
- `created_at`, `updated_at`
- `created_by`, `updated_by`가 필요한 테이블은 명시적으로 저장

### 인덱스 우선 대상

- `brand_id`
- `branch_id`
- `supplier_id`
- `status`
- `request_no`
- `purchase_order_no`
- `created_at`

### 번호 체계 권장

- `request_no`: `PR-YYYYMMDD-SEQ`
- `purchase_order_no`: `PO-YYYYMMDD-SEQ`

## 13. Controller / Service 책임

### Controller 책임

- guard 적용
- DTO 바인딩
- Swagger decorator
- 서비스 호출
- 응답 반환

### Service 책임

- scope 검증
- 상태 전이 검증
- DB 저장 / 조회 orchestration
- 감사 로그 기록
- 번호 생성
- available actions 계산

### 공통 helper 필요 항목

- scope resolver
- 상태 검증 helper
- 번호 생성 helper
- audit log helper

## 14. 권한 규칙

### 공급사 / 품목 관리

- `brand_owner`
- `brand_operator`

### 발주 요청 작성

- `branch_staff`
- `branch_manager`
- `brand_operator`

### 발주 요청 제출

- `branch_manager`
- `brand_operator`

### 승인 / 반려

- `branch_manager`
- `brand_operator`
- `brand_owner`

승인 가능 범위는 설정에 따라 더 좁힐 수 있다.

### 발주서 전환 / 전송 기록

- `brand_operator`
- `brand_owner`
- 매장 자율형에서는 `branch_manager`까지 허용 가능

### 설정 관리

- `brand_owner`
- `brand_operator`

## 15. 핵심 비즈니스 규칙

### 공통

- 모든 요청 / 발주 / 설정은 유효한 brand scope 내에서만 동작한다.
- branch scope는 항상 brand scope의 하위여야 한다.
- inactive 공급사는 신규 요청에 사용할 수 없다.
- inactive 품목은 신규 라인에 추가할 수 없다.

### 발주 요청

- `DRAFT`, `REJECTED` 상태에서만 수정 가능
- submit 시 최소 1개 이상의 line 필요
- line의 수량은 0보다 커야 함
- 동일 request 내 line 중복 정책은 명시적으로 막는 것을 권장

### 승인 / 반려

- `SUBMITTED` 상태에서만 approve / reject 가능
- reject에는 reason 필수
- `approvalMode = NONE`이면 approve 단계 없이 convert 가능
- request 작성자는 기본적으로 자신의 request를 approve할 수 없다.
- `allowBranchSelfApproval = true`일 때만 예외적으로 self-approval을 허용한다.

### 발주서 전환

- 이미 PO로 전환된 request는 중복 전환 금지
- `approvalMode = SINGLE_STEP`이면 `APPROVED` 상태에서만 convert 가능
- `approvalMode = NONE`이면 `SUBMITTED` 상태에서 convert 가능
- convert 시 line snapshot을 PO line에 복사
- convert 후 request 상태를 `CONVERTED_TO_PO`로 변경

### 전송 기록

- `READY_TO_SEND` 또는 정책상 허용된 상태에서만 send 기록 허용
- send log는 append-only 권장
- 발주서 취소 후 send 기록 추가 금지

## 16. 설정 정책

### 설정 단위

- 브랜드 기본 설정
- 매장 오버라이드 설정

### Phase 1 설정 키

- `procurementEnabled`
- `approvalMode`
- `allowBranchSelfApproval`
- `autoCreatePurchaseOrder`
- `defaultCurrency`

### 추가로 고려해야 할 설정

- request amount threshold
- inactive supplier fallback 알림 여부
- 기본 납기일 계산 규칙

## 17. 알림 / 감사 / 첨부 기준

### 알림

Phase 1은 최소 알림만 고려한다.

- 요청 제출 시 승인자 알림
- 요청 반려 시 요청자 알림
- 발주서 전환 완료 알림

### 감사 로그

반드시 남겨야 하는 액션:

- 공급사 생성 / 수정 / 매장 연결
- 품목 생성 / 수정
- 발주 가이드 생성 / 수정
- 요청 생성 / 수정 / 제출 / 승인 / 반려
- 발주서 생성 / 전송 기록 / 취소
- 설정 변경

감사 로그 필드:

- entityType
- entityId
- action
- actorUserId
- actorRole
- summary
- details
- createdAt

### 첨부

Phase 1에서는 필수 아님이 원칙이지만, 아래 확장 포인트는 미리 고려한다.

- 발주서 출력 파일
- 공급사 전달용 PDF
- 추후 송장 첨부 연계

## 18. 운영상 빠지기 쉬운 필수 항목

문서 통합 과정에서 추가로 반드시 고려해야 할 항목은 아래다.

### 18-1. 브랜드 / 매장 컨텍스트 표시

사용자가 어느 브랜드, 어느 매장 기준으로 작업 중인지 상단에서 분명히 보여야 한다.

### 18-2. 숫자와 통화 포맷

- KRW 기본
- 총액 / 단가 / 수량 포맷 통일
- 음수 금지

### 18-3. 변경 충돌 방지

같은 요청을 여러 사용자가 동시에 수정할 수 있으므로 `updatedAt` 기반 optimistic check를 고려한다.

### 18-4. 검색 성능

공급사, 품목, 요청 리스트는 브랜드 단위로 빠르게 검색되어야 하므로 인덱스 우선순위가 높다.

### 18-5. 데이터 보존 정책

- 감사 로그는 삭제보다 보존 우선
- 취소된 요청과 발주서도 soft history 유지

### 18-6. CSV / 엑셀 수입 가능성

Phase 1에서 구현하지 않더라도 공급사 품목 대량 등록 수요가 높으므로 이후 import 확장 포인트를 남긴다.

## 19. 비기능 요구사항

### 보안

- customer guard와 membership 기반 접근 제어
- 브랜드 / 매장 scope 누수 금지
- audit log 위변조 방지

### 성능

- 목록 API는 pagination 기본
- summary API는 과도한 join 피하기

### 관측성

- request submit / approve / convert / send 이벤트 로그
- 실패 이유 로깅

### 유지보수성

- DTO, service, query helper 분리
- 상태 전이 helper 공통화

## 20. 테스트 전략

### Unit test 우선 대상

- scope 검증
- request 상태 전이
- request -> PO 변환
- settings upsert
- send / cancel 가능 상태 검증

### e2e 우선 시나리오

1. 공급사 생성 -> branch 연결
2. 품목 생성 -> supplier item 연결
3. request draft 생성 -> submit -> approve -> convert to PO
4. PO send 기록
5. 권한 없는 사용자 차단

### UI 검증 포인트

- 액션 버튼 노출 조건
- 반려 사유 노출
- 상태 badge 표시
- 잘못된 scope 접근 시 차단

## 21. 완료 기준

Phase 1은 아래가 모두 만족되면 완료로 본다.

- 공급사 / 품목 / 공급사 품목 / 발주 가이드 CRUD가 가능하다.
- 발주 요청 생성부터 발주서 전환까지 끊기지 않는다.
- 설정에 따라 no-approval bypass 또는 1단계 승인 흐름이 동작한다.
- 발주서 전송 기록이 남는다.
- 브랜드 / 매장 설정이 동작한다.
- 감사 로그가 남는다.
- 핵심 시나리오 테스트가 통과한다.

## 22. 배포와 롤아웃

### 초기 도입 권장 방식

- 1개 브랜드
- 1~2개 매장
- 1~2개 공급사

### 롤아웃 체크리스트

- 공급사 / 품목 마스터 입력 완료
- 역할과 권한 할당 완료
- 브랜드 / 매장 설정 완료
- 운영자 교육 완료
- 장애 시 수동 백업 프로세스 존재

### 운영 백업 플랜

초기에는 발주서 PDF 또는 export를 병행할 수 있게 준비한다.

## 23. 미결정 사항

아래는 구현 전에 꼭 확정해야 한다.

1. request / PO 번호 체계를 DB sequence로 할지 애플리케이션 생성으로 할지
2. supplier item line 중복을 허용할지
3. 발주 가이드를 brand 공통으로 허용할지 branch 전용으로 한정할지
4. PO 전송 시 실제 이메일 발송은 Phase 1에서 제외할지 최소 지원할지
5. soft delete 전략을 어디까지 적용할지

## 24. 다음 추천 작업

이 통합 문서 다음으로 자연스럽게 이어질 작업은 아래다.

1. Phase 1 migration pseudo-SQL 통합 문서 작성
2. Phase 1 API payload 예시집 작성
3. 실제 `customer-procurement` 모듈 스캐폴딩 구현
4. Phase 1 테스트 케이스 문서 작성
5. Phase 1 화면 와이어프레임 제작
