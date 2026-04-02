# Order Friends - 프로젝트 완성 로드맵

## 현재 상태 (Phases 1-3 완료)

### ✅ Phase 1: Core Infrastructure
- NestJS 기본 구조
- Supabase 연동
- 멀티테넌트 아키텍처 (Brand → Branch)
- 역할 기반 접근 제어
- 전체 엔티티 CRUD

### ✅ Phase 2: Testing, CI/CD, Docker
- Jest 유닛 테스트
- E2E 테스트
- GitHub Actions CI/CD
- Docker 컨테이너화
- Swagger API 문서

### ✅ Phase 3: Pagination, Caching, Monitoring
- 주문 목록 페이지네이션
- 인메모리 캐싱
- 성능 로깅 인터셉터
- Sentry 에러 추적
- Redis 인프라

---

## 미구현 기능 분석

### 🔴 Critical (사업 운영 불가능)
1. **결제 연동** - 실제 결제 처리 없음
2. **재고 관리** - 재고 추적 및 차감 없음
3. **알림 시스템** - 주문/상태 변경 알림 없음
4. **고객 대시보드** - 브랜드 오너가 자체 관리할 UI 없음

### 🟡 High (사업 성장에 필요)
5. **분석 및 리포팅** - 매출 분석, 리포트 없음
6. **고급 주문 관리** - 환불, 취소, 반품 처리
7. **권한 시스템 개선** - 멤버는 자신의 리소스만 보도록

### 🟢 Medium (경쟁력 강화)
8. **고급 상품 기능** - 상품 리뷰, 추천, 이미지 갤러리
9. **고객 관리** - 고객 히스토리, 세그먼트
10. **마케팅 도구** - 쿠폰, 프로모션, 할인

---

## 구현 계획

## Phase 4: Customer Dashboard (고객 대시보드) 🎯

**목표**: 브랜드/매장 오너가 자신의 비즈니스를 관리할 수 있는 독립적인 인터페이스

### 4.1 고객 인증 및 권한
- [ ] 고객 전용 라우트 분리 (`/customer/*`)
- [ ] 고객 Guard 구현 (Customer/Owner만 접근)
- [ ] 자신의 브랜드/매장만 조회하도록 RLS 정책 강화
- [ ] 멤버십 기반 리소스 필터링

### 4.2 고객 대시보드 API (Backend)
**새 컨트롤러**: `CustomerDashboardController`
- [ ] `GET /customer/dashboard` - 고객용 대시보드 통계
  - 내 브랜드/매장 목록
  - 오늘의 주문
  - 매출 요약
  - 재고 알림

### 4.3 고객 브랜드/매장 관리 API
**새 컨트롤러**: `CustomerBrandsController`, `CustomerBranchesController`
- [ ] `GET /customer/brands` - 내 브랜드 목록
- [ ] `GET /customer/brands/:id` - 내 브랜드 상세
- [ ] `PATCH /customer/brands/:id` - 내 브랜드 수정
- [ ] `GET /customer/branches?brandId=` - 내 매장 목록
- [ ] `GET /customer/branches/:id` - 내 매장 상세
- [ ] `POST /customer/branches` - 내 매장 생성
- [ ] `PATCH /customer/branches/:id` - 내 매장 수정

### 4.4 고객 상품 관리 API
**새 컨트롤러**: `CustomerProductsController`
- [ ] `GET /customer/products?branchId=` - 내 상품 목록
- [ ] `POST /customer/products` - 상품 추가
- [ ] `PATCH /customer/products/:id` - 상품 수정
- [ ] `DELETE /customer/products/:id` - 상품 삭제
- [ ] `POST /customer/products/:id/image` - 상품 이미지 업로드

### 4.5 고객 주문 관리 API
**새 컨트롤러**: `CustomerOrdersController`
- [ ] `GET /customer/orders?branchId=&status=&page=` - 내 주문 목록
- [ ] `GET /customer/orders/:id` - 주문 상세
- [ ] `PATCH /customer/orders/:id/status` - 주문 상태 변경
- [ ] `POST /customer/orders/:id/cancel` - 주문 취소
- [ ] `POST /customer/orders/:id/refund` - 환불 처리

### 4.6 Frontend - 고객 대시보드
- [ ] `/customer` - 고객 대시보드 메인
- [ ] `/customer/brands` - 브랜드 관리
- [ ] `/customer/branches` - 매장 관리
- [ ] `/customer/products` - 상품 관리
- [ ] `/customer/orders` - 주문 관리
- [ ] `/customer/settings` - 설정

**예상 소요**: 3-4일

---

## Phase 5: Inventory Management (재고 관리) 📦

**목표**: 실시간 재고 추적 및 자동 차감

### 5.1 Database Schema
- [ ] `product_inventory` 테이블 생성
  - `id`, `product_id`, `branch_id`
  - `qty_available`, `qty_reserved`, `qty_sold`
  - `low_stock_threshold`
- [ ] 재고 변동 이력 테이블 (`inventory_logs`)
- [ ] 재고 차감 트리거 (주문 생성 시)

### 5.2 Inventory API
**새 컨트롤러**: `InventoryController`
- [ ] `GET /customer/inventory?branchId=` - 재고 현황
- [ ] `PATCH /customer/inventory/:productId` - 재고 수정
- [ ] `POST /customer/inventory/:productId/adjust` - 재고 조정
- [ ] `GET /customer/inventory/alerts` - 재고 부족 알림

### 5.3 Business Logic
- [ ] 주문 생성 시 재고 차감
- [ ] 주문 취소 시 재고 복구
- [ ] 재고 부족 시 주문 거부
- [ ] 예약 재고 관리 (결제 대기)

**예상 소요**: 2-3일

---

## Phase 6: Payment Integration (결제 연동) 💳

**목표**: 실제 결제 처리 (Toss Payments 또는 Stripe)

### 6.1 Payment Provider 선택
- [ ] **Toss Payments** (한국 시장 추천)
  - 카드, 계좌이체, 간편결제 지원
  - 정산 자동화
- [ ] **Stripe** (글로벌 확장 시)

### 6.2 Payment API
**새 컨트롤러**: `PaymentsController`
- [ ] `POST /payments/prepare` - 결제 준비 (금액 확인)
- [ ] `POST /payments/confirm` - 결제 승인
- [ ] `POST /payments/webhook` - 결제 결과 Webhook
- [ ] `POST /payments/refund` - 환불 처리
- [ ] `GET /payments/:id/status` - 결제 상태 조회

### 6.3 Database Schema
- [ ] `payments` 테이블 생성
  - `id`, `order_id`, `amount`
  - `provider` (TOSS, STRIPE, MANUAL)
  - `provider_payment_id`
  - `status` (PENDING, SUCCESS, FAILED, REFUNDED)
  - `paid_at`, `refunded_at`

### 6.4 Integration
- [ ] Toss/Stripe SDK 연동
- [ ] 결제 성공 시 주문 상태 업데이트
- [ ] 결제 실패 시 재고 복구
- [ ] 환불 처리 로직

**예상 소요**: 3-4일

---

## Phase 7: Notification System (알림 시스템) 📧

**목표**: 주문/상태 변경 시 자동 알림

### 7.1 Email Notifications
- [ ] SendGrid/AWS SES 연동
- [ ] 이메일 템플릿 생성
  - 주문 확인 이메일
  - 주문 상태 변경 이메일
  - 배송 완료 이메일
  - 환불 완료 이메일

### 7.2 SMS Notifications (Optional)
- [ ] SMS 서비스 연동 (Aligo, NCP)
- [ ] SMS 템플릿
  - 주문 확인 문자
  - 배송 준비 문자
  - 픽업 준비 완료 문자

### 7.3 Notification Service
**새 서비스**: `NotificationService`
- [ ] `sendOrderConfirmation(orderId)`
- [ ] `sendStatusUpdate(orderId, newStatus)`
- [ ] `sendRefundConfirmation(orderId)`
- [ ] `sendLowStockAlert(productId)`

### 7.4 Notification Settings
- [ ] 알림 설정 테이블 (`notification_settings`)
- [ ] 브랜드/매장별 알림 On/Off
- [ ] 알림 방법 선택 (Email, SMS, Push)

**예상 소요**: 2-3일

---

## Phase 8: Analytics & Reporting (분석 및 리포팅) 📊

**목표**: 매출 분석 및 리포트 생성

### 8.1 Analytics API
**새 컨트롤러**: `AnalyticsController`
- [ ] `GET /customer/analytics/sales?from=&to=&branchId=`
  - 기간별 매출
  - 주문 수
  - 평균 주문 금액
- [ ] `GET /customer/analytics/products?branchId=`
  - 인기 상품 TOP 10
  - 상품별 판매량
  - 카테고리별 매출
- [ ] `GET /customer/analytics/customers?branchId=`
  - 신규 고객 수
  - 재구매율
  - 고객 세그먼트

### 8.2 Reports
- [ ] 일별/주별/월별 리포트 생성
- [ ] CSV 내보내기
- [ ] 정산 리포트

### 8.3 Dashboard Enhancements
- [ ] 매출 차트 (일별, 주별, 월별)
- [ ] 주문 상태별 파이 차트
- [ ] 인기 상품 순위
- [ ] 실시간 통계

**예상 소요**: 3-4일

---

## Phase 9: Advanced Features & Polish (고급 기능 및 완성도) ✨

### 9.1 고급 주문 관리
- [ ] 부분 환불
- [ ] 교환 처리
- [ ] 주문 메모/특이사항 처리
- [ ] 배송 시간 예약
- [ ] 픽업 위치 지정

### 9.2 고급 상품 기능
- [ ] 상품 옵션 그룹 (색상, 사이즈 등)
- [ ] 상품 리뷰 시스템
- [ ] 상품 추천 알고리즘
- [ ] 상품 이미지 갤러리

### 9.3 마케팅 도구
- [ ] 쿠폰 시스템
- [ ] 프로모션/할인
- [ ] 포인트/적립금
- [ ] 멤버십 등급

### 9.4 UI/UX 개선
- [ ] 라이트 모드 지원
- [ ] 실제 아이콘 적용
- [ ] 반응형 개선
- [ ] 로딩 스켈레톤

### 9.5 실시간 기능
- [ ] WebSocket 연동
- [ ] 실시간 주문 알림
- [ ] 실시간 재고 업데이트

**예상 소요**: 5-7일

---

## 우선순위 제안

### 🔥 1차 우선순위 (비즈니스 필수)
1. **Phase 4: Customer Dashboard** - 고객이 직접 관리할 수 있어야 함
2. **Phase 6: Payment Integration** - 실제 결제 없이는 운영 불가
3. **Phase 5: Inventory Management** - 재고 관리 없이는 운영 불가
4. **Phase 7: Notification System** - 고객 경험 필수

### 🚀 2차 우선순위 (성장 및 경쟁력)
5. **Phase 8: Analytics & Reporting** - 데이터 기반 의사결정
6. **Phase 9: Advanced Features** - 차별화 및 완성도

---

## 총 예상 소요 시간
- **1차 우선순위 (Phase 4-7)**: 약 10-14일
- **2차 우선순위 (Phase 8-9)**: 약 8-11일
- **총합**: 약 18-25일 (3-4주)

---

## 다음 단계

### 즉시 시작할 항목 선택
사용자가 우선순위를 지정해주시면, 다음 순서로 진행하겠습니다:

1. **Phase 4부터 시작 추천**: 고객 대시보드가 없으면 고객이 직접 관리할 수 없음
2. **동시 진행 가능**: Phase 4 (Frontend) + Phase 5 (Backend) 병렬 작업
3. **순차 진행**: Phase 6 (Payment) → Phase 7 (Notification)

어떤 Phase부터 시작할까요? 또는 전체를 순차적으로 진행할까요?
