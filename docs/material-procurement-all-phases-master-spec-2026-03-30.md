# 자재 발주 시스템 전체 페이즈 통합 명세서

작성일: 2026-03-30
상태: Draft v1
문서 성격: Phase 0~4 통합 로드맵 및 실행 기준서
현재 유지 문서:

- `docs/material-procurement-all-phases-master-spec-2026-03-30.md`
- `docs/material-procurement-phase0-master-spec-2026-03-30.md`
- `docs/material-procurement-phase1-master-spec-2026-03-30.md`
- `docs/material-procurement-phase2-master-spec-2026-03-30.md`
- `docs/material-procurement-phase3-master-spec-2026-03-30.md`
- `docs/material-procurement-phase4-master-spec-2026-03-30.md`

## 1. 문서 목적

이 문서는 자재 발주 시스템의 전체 페이즈를 한 문서로 연결한 통합 기준서다.

이 문서는 아래 질문에 답하기 위해 존재한다.

- 이 서비스는 최종적으로 어떤 제품이 되는가
- 각 Phase는 무엇을 추가하고 무엇을 일부러 미루는가
- Phase 간 의존성은 무엇인가
- 어느 시점에 어떤 고객군을 받을 수 있는가
- 무엇이 MVP이고, 무엇이 운영 고도화인가

## 2. 제품 비전

`order_friends` 안에 브랜드와 매장이 함께 사용하는 조달 운영 워크스페이스를 만든다.

최종적으로 이 서비스는 아래를 지원해야 한다.

- 브랜드 / 매장 / 공급사 단위 운영
- 요청 -> 승인 -> 발주 -> 입고 -> 송장 -> 정산 -> 예외 처리
- 가격 추적과 권장 발주
- 공급사 연동과 자동화
- 감사 로그와 운영 통제

## 3. 제품 원칙

1. 주문 운영 도메인과 자재 발주 도메인은 분리한다.
2. 브랜드 전용 구조가 아니라 매장 단위로도 쓸 수 있어야 한다.
3. 화면보다 도메인과 상태 모델을 먼저 고정한다.
4. 예외 처리 화면을 허브만큼 중요하게 본다.
5. 모든 금액, 승인, 변경은 추적 가능해야 한다.
6. MVP는 작게 시작하되 이후 자동화 확장을 막지 않는 구조를 택한다.

## 4. 벤치마크에서 가져와야 할 축

공식 자료 기준으로 유사 서비스들이 공통적으로 강한 축은 아래다.

- 공급사 / 공급사 품목 / order guide
- approval workflow
- receiving
- invoice matching
- exception handling
- supplier enablement
- price tracking
- reporting / OTIF / spend visibility

반영 참고:

- Restaurant365: vendor integration, order guide, receiving, PO-invoice 연결
- MarketMan: purchasing, inventory, supplier management, reporting
- Procurify: approval, budget, procure-to-pay 통제
- Coupa: invoicing, matching, supplier enablement

## 5. 공통 도메인 모델

### Master 영역

- `Supplier`
- `SupplierChannel`
- `SupplierIntegrationConfig`
- `ProcurementItem`
- `SupplierItem`
- `OrderGuide`
- `ParLevel`
- `PriceHistory`

### Transaction 영역

- `PurchaseRequest`
- `PurchaseRequestLine`
- `PurchaseOrder`
- `PurchaseOrderLine`
- `Receiving`
- `ReceivingLine`
- `SupplierInvoice`
- `InvoiceMatchResult`
- `Adjustment`
- `SupplierStatement`

### 운영 지원 영역

- `Attachment`
- `CommentThread`
- `AuditLog`
- `ExceptionQueue`
- `NotificationEvent`
- `ApprovalPolicy`

## 6. 공통 상태 모델

### 발주 요청

- `DRAFT`
- `SUBMITTED`
- `APPROVED`
- `REJECTED`
- `CONVERTED_TO_PO`

### 발주서

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

### 입고

- `PENDING`
- `PARTIAL`
- `COMPLETED`
- `DISCREPANCY_REPORTED`
- `RESOLVED`

### 송장

- `UPLOADED`
- `MATCHED`
- `VARIANCE_DETECTED`
- `APPROVED`
- `SETTLED`
- `CLOSED`

## 7. 설정 계층

설정은 단순 `procurement_enabled` 하나로 끝나지 않는다.

필요 계층:

- brand
- branch
- supplier
- feature
- approval policy
- tolerance rule
- notification rule

## 8. 공통 운영 모드

### 브랜드 통제형

- 본사가 마스터와 승인을 통제
- 대형 브랜드 적합

### 매장 자율형

- 매장이 직접 발주와 운영을 처리
- 단독 매장 또는 소형 브랜드 적합

### 혼합형

- 일상 요청은 매장
- 고금액 / 중요 공급사는 본사 승인
- 가장 현실적인 기본 모드

## 9. Phase 0. 기반 설계

### 목표

후속 페이즈에서 흔들리지 않는 공통 뼈대를 고정한다.

### 핵심 산출물

- 도메인 모델
- 상태 모델
- 권한 모델
- 설정 모델
- 감사 로그 모델
- 번호 체계
- 용어 사전

### 완료 기준

- DB / DTO / API / 화면 용어가 일관된다.
- 상태 전이 규칙이 문서화된다.
- 브랜드 / 매장 / 공급사 scope 규칙이 확정된다.

## 10. Phase 1. 운영 진입 MVP

### 목표

실제 발주 요청부터 발주서 전환까지 가능한 최소 운영 제품을 만든다.

### 핵심 기능

- 자재 발주 워크스페이스 진입
- 공급사 마스터
- 품목 마스터
- 공급사 품목
- 발주 가이드
- 발주 요청
- 1단계 승인
- 발주서 생성
- 전송 기록
- 설정
- 감사 로그

### 대상 고객

- 초기 파일럿 브랜드
- 매장 단위 독립 운영 고객

### 판매 가능 메시지

- 전화 / 카톡 / 엑셀 중심 발주를 요청-승인-발주 흐름으로 정리
- 매장과 본사 사이 발주 커뮤니케이션을 구조화

### 리스크

- 아직 입고 / 송장 / 예외 처리 부재
- 가격 추적 / 권장 발주 부재

### 상세 기준

Phase 1 상세는 `docs/material-procurement-phase1-master-spec-2026-03-30.md`를 기준으로 한다.

## 11. Phase 2. 입고 / 송장 / 예외 처리

### 목표

발주 이후 운영의 핵심인 입고 검수와 송장 정합성을 붙인다.

### 핵심 기능

- 입고 등록
- 부분 입고
- 차이 사유 기록
- 손상 / 대체품 / 미입고 처리
- 송장 업로드
- PO / 입고 / 송장 매칭
- 예외 큐
- 해소 처리 로그

### 추가 엔티티

- `Receiving`
- `ReceivingLine`
- `SupplierInvoice`
- `InvoiceMatchResult`
- `ExceptionQueue`
- `Attachment`

### 주요 화면

- 입고 대기 목록
- 입고 상세
- 송장 목록 / 상세
- 예외 큐

### 주요 API

- `GET /receivings`
- `POST /purchase-orders/:id/receivings`
- `GET /invoices`
- `POST /invoices`
- `POST /invoices/:id/match`
- `GET /exceptions`
- `POST /exceptions/:id/resolve`

### Phase 2에서 꼭 보강해야 할 규칙

- 부분 입고 허용
- 차이 코드 표준화
- 송장 허용 오차 규칙
- 예외 해소 사유 필수화

### 완료 기준

- 발주서 기준 입고를 등록할 수 있다.
- 송장을 업로드하고 발주 / 입고와 연결할 수 있다.
- 차이와 불일치가 예외 큐로 떠야 한다.
- 운영자가 예외를 해소하고 이력이 남아야 한다.

## 12. Phase 3. 가격 / 리포트 / 권장 발주

### 목표

운영 기록을 분석 가능한 데이터로 바꾸고, 비용 통제와 발주 효율을 높인다.

### 핵심 기능

- 가격 이력
- par level
- 권장 발주
- 공급사 성과 리포트
- 지출 / 예외 / 가격 변동 리포트

### 추가 엔티티

- `PriceHistory`
- `ParLevel`
- `DemandSnapshot`
- `SuggestedOrder`
- `SupplierPerformanceMetric`

### 주요 화면

- 가격 추이
- par level 설정
- 권장 발주
- 리포트 대시보드

### 주요 API

- `GET /price-history`
- `POST /supplier-items/:id/price-history`
- `GET /par-levels`
- `PUT /par-levels/:procurementItemId`
- `GET /suggested-orders`
- `GET /reports/summary`
- `GET /reports/suppliers`

### 분석 축

- 발주 총액
- 공급사별 비중
- 평균 납기 준수
- 가격 상승률
- 미입고 / 부분 입고율
- 예외 발생률

### 완료 기준

- 단가 변화가 시계열로 보인다.
- 매장별 par level을 관리할 수 있다.
- 권장 발주량이 계산된다.
- 공급사별 성과와 비용 리포트를 볼 수 있다.

## 13. Phase 4. 자동화 / 연동 / 공급사 포털

### 목표

수동 업무를 줄이고 공급사와의 인터페이스를 확장한다.

### 핵심 기능

- 자동 발주 전송
- 문서 OCR / 파싱
- 공급사 포털
- 다단계 승인 정책
- 외부 시스템 연동

### 추가 엔티티

- `SupplierPortalUser`
- `SupplierAck`
- `InboundDocumentParseJob`
- `AutoSendJob`
- `ApprovalPolicyRule`

### 주요 화면

- 자동 전송 작업 화면
- 문서 파싱 작업 화면
- 승인 정책 화면
- 공급사 포털 화면

### 주요 API

- `POST /purchase-orders/:id/auto-send`
- `GET /send-jobs`
- `POST /inbound-documents/parse`
- `GET /inbound-documents/:jobId`
- `GET /approval-policies`
- `POST /approval-policies`
- `GET /supplier-portal/purchase-orders`
- `POST /supplier-portal/purchase-orders/:id/acknowledge`

### Phase 4에서 중요한 점

- 공급사마다 다른 채널과 포맷을 수용해야 함
- OCR은 운영 보조일 뿐, 수동 검토 플로우를 반드시 유지해야 함
- 자동화는 예외 처리 설계가 먼저 있어야 안전함

### 완료 기준

- 특정 공급사에 자동 전송이 가능하다.
- 문서 파싱 결과를 검토 후 반영할 수 있다.
- 승인 정책을 조건 기반으로 설정할 수 있다.
- 공급사가 발주서를 확인하고 응답할 수 있다.

## 14. Phase별 상세 문서

- Phase 0: `docs/material-procurement-phase0-master-spec-2026-03-30.md`
- Phase 1: `docs/material-procurement-phase1-master-spec-2026-03-30.md`
- Phase 2: `docs/material-procurement-phase2-master-spec-2026-03-30.md`
- Phase 3: `docs/material-procurement-phase3-master-spec-2026-03-30.md`
- Phase 4: `docs/material-procurement-phase4-master-spec-2026-03-30.md`

## 15. 페이즈 간 의존성

### Phase 1 -> Phase 2

- request / PO / supplier item 구조가 먼저 안정적이어야 한다.
- send log와 PO line snapshot이 있어야 입고와 송장 연결이 수월하다.

### Phase 2 -> Phase 3

- 입고 / 송장 데이터가 쌓여야 가격 추이와 공급사 성과가 의미를 가진다.

### Phase 3 -> Phase 4

- 예외와 리포트가 안정화되어야 자동화 리스크를 통제할 수 있다.

## 16. 공통 비기능 요구사항

### 보안

- brand / branch scope isolation
- 민감 금액 및 문서 접근 통제
- 감사 로그 보존

### 성능

- 모든 리스트 API pagination
- 대시보드 API 집계 최적화
- 향후 월별 파티셔닝 검토

### 관측성

- 주요 상태 전이 이벤트 기록
- 공급사 전송 실패율 모니터링
- 예외 큐 발생량 추적

### 장애 대응

- 수동 fallback 프로세스 준비
- 자동 전송 실패 시 재시도 / 수동 전환

## 17. 출시 전략

### 1차 파일럿

- 혼합형 운영 고객 1곳
- 브랜드 1개
- 매장 1~2개
- 공급사 2~3개

### 2차 확장

- 브랜드 통제형 고객
- 송장 / 예외 처리 수요가 있는 고객

### 3차 확장

- 권장 발주와 분석 수요가 높은 고객
- 공급사 연동 요구가 있는 고객

## 18. KPI

### 운영 효율

- 요청 작성 시간
- 승인 리드타임
- 발주서 전환 시간
- 입고 처리 시간

### 정합성

- PO / 송장 불일치율
- 수동 조정 빈도
- 예외 발생률

### 비즈니스 가치

- 브랜드 / 매장 활성 수
- 공급사 연결 수
- 월 발주 총액
- 가격 상승 감지 건수
- 품절 / 부족 방지 건수

## 19. 앞으로 빠지기 쉬운 누락 항목

통합본 작성 기준으로 추가해야 할 항목은 아래다.

### 운영 정책

- cutoff time 자동 계산
- 휴무일 / 비배송일 정책
- 긴급 발주 플로우
- 대체품 승인 정책

### 데이터 정책

- soft delete / archive 기준
- 첨부 파일 보존 기간
- 숫자 반올림 규칙
- 타임존 처리 기준

### 고객 온보딩

- 공급사 / 품목 초기 import
- 역할 템플릿
- 샘플 order guide

### 지원 조직

- 운영 매뉴얼
- CS 대응 FAQ
- 장애 시 수동 업무 절차

## 20. 추천 문서 구조

현재는 아래 문서 세트를 기준으로 운영한다.

- 전체 페이즈 통합본: 이 문서
- Phase 0 기준서: `material-procurement-phase0-master-spec-2026-03-30.md`
- Phase 1 실행 기준서: `material-procurement-phase1-master-spec-2026-03-30.md`
- Phase 2 기준서: `material-procurement-phase2-master-spec-2026-03-30.md`
- Phase 3 기준서: `material-procurement-phase3-master-spec-2026-03-30.md`
- Phase 4 기준서: `material-procurement-phase4-master-spec-2026-03-30.md`

## 21. 다음 추천 작업

1. Phase 1 migration pseudo-SQL 통합본 작성
2. 화면 와이어프레임 또는 IA 다이어그램 작성
3. 실제 `customer-procurement` 모듈 구현 착수
4. Phase 2~4 세부 DB / DTO / 정책 문서 확장

## 22. 참고 벤치마크

- Restaurant365 Vendor Integrations Setup  
  https://docs.restaurant365.com/docs/vendor-integrations-setup
- Restaurant365 Purchase Orders / Shopping Lists  
  https://docs.restaurant365.com/docs/purchase-orders-use-shopping-lists
- Restaurant365 AP Invoice linked to Purchase Order  
  https://docs.restaurant365.com/docs/ap-invoices-link-purchase-order
- MarketMan  
  https://www.marketman.com/
- MarketMan Invoice Management  
  https://www.marketman.com/page/restaurant-invoice-management-system
- Procurify Approvals / Procurement  
  https://www.procurify.com/product/approve
- Coupa Invoicing  
  https://www.coupa.com/products/ap-automation/invoicing/
