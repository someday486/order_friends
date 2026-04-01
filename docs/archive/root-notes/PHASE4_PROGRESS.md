# Phase 4: Customer Dashboard - Backend 완료! 🎉

## 목표
브랜드/매장 오너가 자신의 비즈니스를 관리할 수 있는 독립적인 고객 대시보드 구현

---

## ✅ 완료된 작업 (Backend 100%)

### 1. Customer Authentication & Authorization ✅
- [x] **CustomerGuard** (`src/common/guards/customer.guard.ts`)
  - 인증된 사용자 확인
  - 브랜드/브랜치 멤버십 검증 (ACTIVE만)
  - Admin 사용자 차단 (역할 분리)
  - Request에 멤버십 정보 첨부

- [x] **AuthRequest 타입 확장** (`src/common/types/auth-request.ts`)
  - `BrandMembership` 타입
  - `BranchMembership` 타입
  - 멤버십 배열 필드 추가

### 2. Customer Dashboard API ✅
**Location**: `src/modules/customer-dashboard/`

- [x] GET `/customer/dashboard` - 통계 조회
  - 내 브랜드/매장 수
  - 총/오늘/대기 주문
  - 총 상품 수
  - 브랜드 목록
  - 최근 주문 5개

### 3. Customer Brands Management API ✅
**Location**: `src/modules/customer-brands/`

- [x] GET `/customer/brands` - 내 브랜드 목록 + 역할 정보
- [x] GET `/customer/brands/:id` - 브랜드 상세
- [x] PATCH `/customer/brands/:id` - 브랜드 수정 (OWNER/ADMIN)

**Features**:
- 자동 역할(myRole) 정보 포함
- OWNER/ADMIN만 수정 가능
- 멤버십 기반 접근 제어

### 4. Customer Branches Management API ✅
**Location**: `src/modules/customer-branches/`

- [x] GET `/customer/branches?brandId=` - 브랜드의 매장 목록
- [x] GET `/customer/branches/:id` - 매장 상세
- [x] POST `/customer/branches` - 매장 생성 (OWNER/ADMIN)
- [x] PATCH `/customer/branches/:id` - 매장 수정 (OWNER/ADMIN)
- [x] DELETE `/customer/branches/:id` - 매장 삭제 (OWNER/ADMIN)

**Features**:
- 브랜드/브랜치 멤버십 이중 확인
- 브랜치 멤버십 우선 순위
- 역할 기반 CRUD 권한 제어

### 5. Customer Products Management API ✅
**Location**: `src/modules/customer-products/`

- [x] GET `/customer/products?branchId=` - 매장의 상품 목록
- [x] GET `/customer/products/:id` - 상품 상세 (옵션 포함)
- [x] POST `/customer/products` - 상품 추가 (OWNER/ADMIN)
- [x] PATCH `/customer/products/:id` - 상품 수정 (OWNER/ADMIN)
- [x] DELETE `/customer/products/:id` - 상품 삭제 (OWNER/ADMIN)

**Features**:
- Product options 자동 조회
- 브랜치 접근 권한 확인
- Active/Inactive 상태 관리

### 6. Customer Orders Management API ✅
**Location**: `src/modules/customer-orders/`

- [x] GET `/customer/orders?branchId=&status=&page=&limit=` - 주문 목록 (페이지네이션)
- [x] GET `/customer/orders/:id` - 주문 상세 (items + options)
- [x] PATCH `/customer/orders/:id/status` - 주문 상태 변경 (OWNER/ADMIN)

**Features**:
- 페이지네이션 지원 (`PaginationDto`, `PaginationUtil`)
- 상태 필터링 (status 쿼리)
- Order ID 또는 order_no 조회 가능
- Order items 및 options 포함

### 7. App Module 등록 ✅
모든 Customer 모듈이 `app.module.ts`에 등록됨:
- CustomerDashboardModule
- CustomerBrandsModule
- CustomerBranchesModule
- CustomerProductsModule
- CustomerOrdersModule
- CustomerGuard (provider)

---

## 📊 API 엔드포인트 전체 목록

### Customer Dashboard
| Method | Endpoint | Params | 설명 |
|--------|----------|--------|------|
| GET | `/customer/dashboard` | - | 통계 조회 |

### Customer Brands
| Method | Endpoint | Params | 설명 |
|--------|----------|--------|------|
| GET | `/customer/brands` | - | 내 브랜드 목록 |
| GET | `/customer/brands/:brandId` | brandId | 브랜드 상세 |
| PATCH | `/customer/brands/:brandId` | brandId, body | 브랜드 수정 |

### Customer Branches
| Method | Endpoint | Params | 설명 |
|--------|----------|--------|------|
| GET | `/customer/branches` | ?brandId= | 브랜드의 매장 목록 |
| GET | `/customer/branches/:branchId` | branchId | 매장 상세 |
| POST | `/customer/branches` | body | 매장 생성 |
| PATCH | `/customer/branches/:branchId` | branchId, body | 매장 수정 |
| DELETE | `/customer/branches/:branchId` | branchId | 매장 삭제 |

### Customer Products
| Method | Endpoint | Params | 설명 |
|--------|----------|--------|------|
| GET | `/customer/products` | ?branchId= | 매장의 상품 목록 |
| GET | `/customer/products/:productId` | productId | 상품 상세 |
| POST | `/customer/products` | body | 상품 추가 |
| PATCH | `/customer/products/:productId` | productId, body | 상품 수정 |
| DELETE | `/customer/products/:productId` | productId | 상품 삭제 |

### Customer Orders
| Method | Endpoint | Params | 설명 |
|--------|----------|--------|------|
| GET | `/customer/orders` | ?branchId=&status=&page=&limit= | 주문 목록 (페이지네이션) |
| GET | `/customer/orders/:orderId` | orderId (ID or order_no) | 주문 상세 |
| PATCH | `/customer/orders/:orderId/status` | orderId, body | 주문 상태 변경 |

**총 엔드포인트 수**: 16개

---

## 🔐 보안 및 권한 제어

### Guards
모든 엔드포인트: `@UseGuards(AuthGuard, CustomerGuard)`
- **AuthGuard**: 인증 확인
- **CustomerGuard**: 고객 멤버십 확인 + Admin 차단

### 역할 기반 권한
| 역할 | 조회(GET) | 생성(POST) | 수정(PATCH) | 삭제(DELETE) |
|------|-----------|------------|-------------|--------------|
| OWNER | ✅ | ✅ | ✅ | ✅ |
| ADMIN | ✅ | ✅ | ✅ | ✅ |
| MANAGER | ✅ | ❌ | ❌ | ❌ |
| MEMBER | ✅ | ❌ | ❌ | ❌ |
| STAFF | ✅ | ❌ | ❌ | ❌ |
| VIEWER | ✅ | ❌ | ❌ | ❌ |

### 접근 제어 로직
1. **브랜드 접근**: 브랜드 멤버십 확인
2. **브랜치 접근**: 브랜치 멤버십 OR 브랜드 멤버십 확인
3. **상품 접근**: 브랜치 접근 확인 → 상품 소속 확인
4. **주문 접근**: 브랜치 접근 확인 → 주문 소속 확인

---

## 📁 파일 구조

```
src/
├── common/
│   ├── guards/
│   │   ├── customer.guard.ts ✅
│   │   ├── auth.guard.ts
│   │   └── admin.guard.ts
│   └── types/
│       └── auth-request.ts ✅ (updated)
│
├── modules/
│   ├── customer-dashboard/ ✅
│   │   ├── customer-dashboard.controller.ts
│   │   ├── customer-dashboard.service.ts
│   │   └── customer-dashboard.module.ts
│   │
│   ├── customer-brands/ ✅
│   │   ├── customer-brands.controller.ts
│   │   ├── customer-brands.service.ts
│   │   └── customer-brands.module.ts
│   │
│   ├── customer-branches/ ✅
│   │   ├── customer-branches.controller.ts
│   │   ├── customer-branches.service.ts
│   │   └── customer-branches.module.ts
│   │
│   ├── customer-products/ ✅
│   │   ├── customer-products.controller.ts
│   │   ├── customer-products.service.ts
│   │   └── customer-products.module.ts
│   │
│   └── customer-orders/ ✅
│       ├── customer-orders.controller.ts
│       ├── customer-orders.service.ts
│       └── customer-orders.module.ts
│
└── app.module.ts ✅ (updated)
```

---

## ⏳ 남은 작업 (Frontend)

### Frontend - Customer Dashboard Pages
- [ ] `/customer` - 고객 대시보드 메인
- [ ] `/customer/brands` - 브랜드 관리
- [ ] `/customer/branches` - 매장 관리
- [ ] `/customer/products` - 상품 관리
- [ ] `/customer/orders` - 주문 관리
- [ ] `/customer/settings` - 설정

---

## 🚀 다음 단계

### 즉시 가능한 작업
1. **API 테스트**: Swagger UI (`http://localhost:4000/api-docs`)에서 테스트
2. **Frontend 구현**: Customer 페이지 구현 시작
3. **Phase 5 시작**: Inventory Management

### 테스트 시나리오
1. 브랜드 멤버로 로그인
2. `/customer/dashboard` 호출 → 내 통계 확인
3. `/customer/brands` 호출 → 내 브랜드 목록 확인
4. `/customer/branches?brandId=xxx` 호출 → 매장 목록 확인
5. `/customer/products?branchId=xxx` 호출 → 상품 목록 확인
6. `/customer/orders?branchId=xxx` 호출 → 주문 목록 확인

---

## Admin vs Customer 비교

| 기능 | Admin (`/admin/*`) | Customer (`/customer/*`) |
|------|-------------------|-------------------------|
| 접근 권한 | 모든 브랜드/매장 | 자신의 브랜드/매장만 |
| Guard | `AdminGuard` | `CustomerGuard` |
| 데이터 필터링 | 전체 데이터 | 멤버십 기반 필터링 |
| 역할 정보 | ❌ | ✅ (myRole 포함) |
| 목적 | 서비스 전체 관리 | 자신의 비즈니스 관리 |
| 멤버십 확인 | 환경 변수 기반 | 데이터베이스 기반 |

---

## 📈 진행률

**Phase 4 Backend**: ✅ 100% 완료 (5/5 모듈)

- ✅ CustomerGuard & Types
- ✅ CustomerDashboardModule
- ✅ CustomerBrandsModule
- ✅ CustomerBranchesModule
- ✅ CustomerProductsModule
- ✅ CustomerOrdersModule

**Phase 4 Frontend**: ⏳ 0% (대기 중)

**전체 Phase 4**: 🔄 50% (Backend 완료, Frontend 대기)

---

**커밋**: Phase 4 Backend 완료
**다음**: Frontend 구현 또는 Phase 5 시작
