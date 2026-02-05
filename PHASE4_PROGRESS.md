# Phase 4: Customer Dashboard - 진행 상황

## 목표
브랜드/매장 오너가 자신의 비즈니스를 관리할 수 있는 독립적인 고객 대시보드 구현

---

## ✅ 완료된 작업

### 1. Customer Authentication & Authorization
- [x] **CustomerGuard** 생성 (`src/common/guards/customer.guard.ts`)
  - 인증된 사용자인지 확인
  - 최소 하나 이상의 브랜드 또는 브랜치 멤버십 확인
  - Admin 사용자는 고객 영역 접근 불가 (역할 분리)
  - Request에 멤버십 정보 첨부

- [x] **AuthRequest 타입** 업데이트 (`src/common/types/auth-request.ts`)
  - `BrandMembership` 타입 추가
  - `BranchMembership` 타입 추가
  - `brandMemberships?: BrandMembership[]` 필드 추가
  - `branchMemberships?: BranchMembership[]` 필드 추가

### 2. Customer Dashboard API
- [x] **CustomerDashboardModule** 생성
  - Controller: `CustomerDashboardController`
  - Service: `CustomerDashboardService`
  - Module: `CustomerDashboardModule`

- [x] **GET /customer/dashboard** 엔드포인트
  - 고객의 전체 통계 조회
  - 내 브랜드 수
  - 내 매장 수
  - 총 주문 수
  - 오늘 주문 수
  - 대기 중인 주문
  - 총 상품 수
  - 브랜드 목록
  - 최근 주문 5개

- [x] **Guards 적용**
  - `AuthGuard` - 인증 확인
  - `CustomerGuard` - 고객 멤버십 확인

- [x] **App Module 등록**
  - `CustomerDashboardModule` imports에 추가
  - `CustomerGuard` providers에 추가

---

## 🚧 진행 중인 작업

### 3. Customer Brands/Branches Management API
- [ ] **CustomerBrandsModule** 생성 필요
  - `GET /customer/brands` - 내 브랜드 목록
  - `GET /customer/brands/:id` - 내 브랜드 상세
  - `PATCH /customer/brands/:id` - 내 브랜드 수정

- [ ] **CustomerBranchesModule** 생성 필요
  - `GET /customer/branches?brandId=` - 내 매장 목록
  - `GET /customer/branches/:id` - 내 매장 상세
  - `POST /customer/branches` - 매장 생성
  - `PATCH /customer/branches/:id` - 매장 수정
  - `DELETE /customer/branches/:id` - 매장 삭제

---

## ⏳ 대기 중인 작업

### 4. Customer Products Management API
- [ ] **CustomerProductsModule** 생성
  - `GET /customer/products?branchId=` - 내 상품 목록
  - `GET /customer/products/:id` - 상품 상세
  - `POST /customer/products` - 상품 추가
  - `PATCH /customer/products/:id` - 상품 수정
  - `DELETE /customer/products/:id` - 상품 삭제
  - `POST /customer/products/:id/image` - 상품 이미지 업로드

### 5. Customer Orders Management API
- [ ] **CustomerOrdersModule** 생성
  - `GET /customer/orders?branchId=&status=&page=` - 내 주문 목록 (페이지네이션)
  - `GET /customer/orders/:id` - 주문 상세
  - `PATCH /customer/orders/:id/status` - 주문 상태 변경
  - `POST /customer/orders/:id/cancel` - 주문 취소
  - `POST /customer/orders/:id/refund` - 환불 처리

### 6. Frontend - Customer Dashboard Pages
- [ ] `/customer` - 고객 대시보드 메인
- [ ] `/customer/brands` - 브랜드 관리
- [ ] `/customer/branches` - 매장 관리
- [ ] `/customer/products` - 상품 관리
- [ ] `/customer/orders` - 주문 관리
- [ ] `/customer/settings` - 설정

---

## 구현 세부사항

### CustomerGuard 로직
```typescript
1. 인증 확인 (accessToken, user)
2. Admin 사용자 차단 (역할 분리)
3. 브랜드 멤버십 조회 (status='ACTIVE')
4. 브랜치 멤버십 조회 (status='ACTIVE')
5. 최소 하나 이상의 멤버십 필요
6. Request에 멤버십 정보 첨부
```

### CustomerDashboard Service 로직
```typescript
1. 사용자의 브랜드/브랜치 ID 추출
2. 브랜드 소유 브랜치 ID도 포함
3. 통계 계산:
   - 브랜드 수, 매장 수
   - 총 주문/오늘 주문/대기 주문
   - 총 상품 수
4. 브랜드 목록 조회
5. 최근 주문 5개 조회
```

### Admin vs Customer 차이점
| 기능 | Admin | Customer |
|------|-------|----------|
| 접근 권한 | 모든 브랜드/매장 | 자신의 브랜드/매장만 |
| 라우트 | `/admin/*` | `/customer/*` |
| Guard | `AdminGuard` | `CustomerGuard` |
| 목적 | 서비스 전체 관리 | 자신의 비즈니스 관리 |

---

## 다음 단계

1. **Customer Brands/Branches Module 완성** (현재 작업 중)
2. **Customer Products Module 구현**
3. **Customer Orders Module 구현**
4. **Frontend 페이지 구현**
5. **테스트 및 검증**
6. **커밋 및 푸시**

---

## 파일 구조

```
src/
├── common/
│   ├── guards/
│   │   └── customer.guard.ts ✅
│   └── types/
│       └── auth-request.ts ✅ (updated)
│
├── modules/
│   └── customer-dashboard/ ✅
│       ├── customer-dashboard.controller.ts
│       ├── customer-dashboard.service.ts
│       └── customer-dashboard.module.ts
│
└── app.module.ts ✅ (updated)
```

---

## API 엔드포인트 (완료)

| Method | Endpoint | Guard | 설명 |
|--------|----------|-------|------|
| GET | `/customer/dashboard` | Auth + Customer | 고객 대시보드 통계 |

---

**진행률**: 약 20% (5개 작업 중 2개 완료)

**다음 커밋**: Customer Dashboard 기본 구조 완성
