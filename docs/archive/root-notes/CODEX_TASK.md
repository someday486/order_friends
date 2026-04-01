# Codex 업무지시서: 테스트 커버리지 100% 달성

## 프로젝트 개요
- **스택**: NestJS 11 + Supabase (백엔드), Next.js 15 (프론트)
- **브랜치**: `feature/phase8-9-analytics-advanced`
- **테스트 프레임워크**: Jest (`npx jest` 로 실행)
- **설치**: `npm install --legacy-peer-deps` (peer dep conflict 있음)

## 현재 상태
- **24 Suite, 359 tests, ALL PASS**
- **Statements 53%, Lines 55%**
- 서비스 테스트는 대부분 작성 완료, **Controller 테스트가 전혀 없음**

## 핵심 패턴: Supabase Mock

이 프로젝트의 모든 DB 호출은 Supabase 클라이언트의 체이닝 API를 사용합니다.
테스트에서는 아래 패턴으로 mock합니다:

```typescript
const createChainableMock = () => {
  const chain: any = {};
  const methods = [
    'from', 'select', 'insert', 'update', 'delete',
    'eq', 'in', 'gte', 'lte', 'order', 'range',
    'single', 'maybeSingle', 'limit', 'upsert',
  ];
  methods.forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  return chain;
};
```

**절대 규칙:**
- 체인 중간 메서드 (뒤에 .xxx()가 더 붙는 경우) → `mockReturnValueOnce(mockSb)` (체인 반환)
- 체인 마지막 메서드 (데이터를 반환하는 경우) → `mockResolvedValueOnce({data, error})` (Promise 반환)
- 같은 메서드(.eq 등)가 여러번 호출되면 FIFO 순서로 mockOnce가 소비됨

**예시:**
```typescript
// .from('orders').select(...).eq('branch_id', id).eq('status', 'ACTIVE').single()
mockSb.eq
  .mockReturnValueOnce(mockSb)           // 1번째 .eq('branch_id') → 체인 계속
  .mockReturnValueOnce(mockSb);          // 2번째 .eq('status') → 체인 계속
mockSb.single
  .mockResolvedValueOnce({ data: {...}, error: null }); // 마지막 .single() → 데이터 반환
```

---

## 작업 목록 (우선순위순)

### 1. Controller 테스트 작성 (가장 큰 커버리지 갭)

모든 컨트롤러가 0% 커버리지. NestJS 컨트롤러 테스트 패턴:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { XxxController } from './xxx.controller';
import { XxxService } from './xxx.service';

describe('XxxController', () => {
  let controller: XxxController;
  const mockService = {
    methodA: jest.fn(),
    methodB: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [XxxController],
      providers: [{ provide: XxxService, useValue: mockService }],
    }).compile();
    controller = module.get<XxxController>(XxxController);
    jest.clearAllMocks();
  });

  it('should call service method and return result', async () => {
    mockService.methodA.mockResolvedValue({ id: '1' });
    const result = await controller.methodA(/* args */);
    expect(result).toEqual({ id: '1' });
    expect(mockService.methodA).toHaveBeenCalledWith(/* expected args */);
  });
});
```

**작성해야 할 컨트롤러 목록:**

| 파일 | 주요 메서드 | 의존성 |
|------|------------|--------|
| `src/modules/analytics/analytics.controller.ts` | getSales, getProducts, getOrders, getCustomer analytics | AnalyticsService |
| `src/modules/orders/orders.controller.ts` | getOrders, getOrder, updateStatus | OrdersService |
| `src/modules/products/products.controller.ts` | getProducts, getProduct, create, update, delete, categories | ProductsService |
| `src/modules/payments/payments.controller.ts` | getPayments, getPayment, process, confirm, webhook | PaymentsService |
| `src/modules/inventory/inventory.controller.ts` | getList, getByProduct, update, adjust, lowStock, logs | InventoryService |
| `src/modules/branches/branches.controller.ts` | getBranches, getBranch, create, update, delete | BranchesService |
| `src/modules/brands/brands.controller.ts` | getMyBrands, getBrand, create, update, delete | BrandsService |
| `src/modules/members/members.controller.ts` | brand/branch members CRUD | MembersService |
| `src/modules/dashboard/dashboard.controller.ts` | getStats | DashboardService |
| `src/modules/customer-orders/customer-orders.controller.ts` | getMyOrders, getMyOrder, updateStatus | CustomerOrdersService |
| `src/modules/customer-products/customer-products.controller.ts` | products/categories CRUD | CustomerProductsService |
| `src/modules/customer-dashboard/customer-dashboard.controller.ts` | getDashboardStats | CustomerDashboardService |
| `src/modules/customer-branches/customer-branches.controller.ts` | getMyBranches, getMyBranch, create, update, delete | CustomerBranchesService |
| `src/modules/customer-brands/customer-brands.controller.ts` | getMyBrands, getMyBrand, update | CustomerBrandsService |
| `src/modules/public/public.controller.ts` | getBranch, getProducts | PublicService |
| `src/modules/public-order/public-order.controller.ts` | createOrder, getOrder, getCategories | PublicOrderService |
| `src/modules/upload/upload.controller.ts` | uploadImage, deleteImage | UploadService |
| `src/modules/auth/me.controller.ts` | getMe | (직접 req.user 사용) |
| `src/modules/health/health.controller.ts` | check | HealthCheckService |

**컨트롤러 테스트 시 주의사항:**
- 컨트롤러는 `@Req() req` 에서 `req.user`, `req.accessToken`, `req.isAdmin`, `req.brandMemberships`, `req.branchMemberships` 등을 사용함
- Guard들은 테스트에서 제외 (서비스만 mock)
- 각 엔드포인트별 최소 1개 성공/1개 실패 테스트

### 2. 누락된 Guard 테스트

아래 4개 guard의 spec 파일이 아직 없음:

| 파일 | 설명 |
|------|------|
| `src/common/guards/admin.guard.ts` (15줄) | `req.isAdmin`만 확인, 아니면 ForbiddenException |
| `src/common/guards/customer.guard.ts` (130줄) | 인증확인 → admin 거부 → brand_members/branch_members 조회 → memberships 세팅 |
| `src/common/guards/membership.guard.ts` (176줄) | brandId/branchId로 멤버십 확인, admin은 OWNER 역할 부여 |
| `src/common/guards/policy.guard.ts` (44줄) | Reflector로 필요 권한 읽기, ROLE_PERMISSIONS 매핑 확인 |

`auth.guard.spec.ts`는 이미 작성됨 (참고용으로 확인 가능).

### 3. 누락된 Interceptor/Service 테스트

| 파일 | 설명 |
|------|------|
| `src/common/interceptors/logging.interceptor.ts` (45줄) | rxjs tap으로 응답시간 로깅, 1초 이상 warn |
| `src/infra/supabase/supabase.service.ts` (95줄) | createClient mock 필요 (`jest.mock('@supabase/supabase-js')`) |

### 4. 기존 서비스 커버리지 100% 향상

현재 100% 미만인 서비스들의 uncovered lines를 추가 테스트로 커버:

| 서비스 | 현재 Lines% | 미커버 라인 |
|--------|-----------|------------|
| `public-order.service.ts` | 36% | 대부분 미커버 (가장 큰 갭) |
| `products.service.ts` | 70% | 94-157, 185-186, 260, 288, 299-300 |
| `customer-products.service.ts` | 68% | 여러 분기 (오류 처리, edge cases) |
| `payments.service.ts` | 73% | webhook, refund, complex flows |
| `customer-orders.service.ts` | 79% | 47-50, 85, 97-104, 131 등 |
| `inventory.service.ts` | 83% | 60, 63, 103-110 등 |
| `notifications.service.ts` | 88% | 38, 248-255, 302-309 |
| `public.service.ts` | 89% | 23-25, 108-109, 148 등 |
| `analytics.service.ts` | 94% | 120-121, 232-233, 335-336 등 |
| `orders.service.ts` | 82% | 40-43, 101-102, 164-165 등 |
| `brands.service.ts` | 새로 작성됨 (커버리지 확인 필요) |
| `branches.service.ts` | 새로 작성됨 |
| `members.service.ts` | 새로 작성됨 |
| `dashboard.service.ts` | 새로 작성됨 |
| `customer-branches.service.ts` | 새로 작성됨 |
| `customer-brands.service.ts` | 새로 작성됨 |
| `cache.service.ts` | 새로 작성됨 |

**방법**: 해당 서비스 소스를 읽고, uncovered line의 분기를 커버하는 테스트를 기존 spec 파일에 추가

### 5. 나머지 파일

| 파일 | 설명 | 난이도 |
|------|------|--------|
| `src/common/decorators/*.ts` | createParamDecorator, SetMetadata — 테스트 어려움, 스킵 가능 | 낮음 |
| `src/common/dto/search.dto.ts` | class-validator 데코레이터 — 스킵 가능 | 낮음 |
| `src/modules/*/dto/*.ts` | DTO 클래스들 — 대부분 선언만 있어 스킵 가능 | 낮음 |
| `src/modules/*/*.module.ts` | NestJS 모듈 선언 — 스킵 가능 | 낮음 |
| `src/main.ts` | bootstrap 함수 — 스킵 가능 | 높음 |
| `src/app.module.ts` | 모듈 등록 — 스킵 가능 | 높음 |
| `src/modules/health/supabase.health.ts` | HealthIndicator — 간단 | 낮음 |

> main.ts, app.module.ts, *.module.ts 는 통합테스트 영역이므로 단위테스트로 100% 달성이 어려움.
> **현실적 목표: main.ts/module 파일 제외 시 90%+, 전체 포함 80%+**

---

## 실행 방법

```bash
# 설치
npm install --legacy-peer-deps

# 전체 테스트
npx jest

# 특정 파일 테스트
npx jest src/modules/brands/brands.service.spec.ts

# 커버리지 확인
npx jest --coverage --coverageReporters=text-summary

# 특정 파일 커버리지
npx jest --coverage --collectCoverageFrom='src/modules/brands/**/*.ts' src/modules/brands/brands.service.spec.ts
```

## 검증 기준

1. `npx jest` → 모든 테스트 PASS (0 failures)
2. `npx jest --coverage` → Statements/Lines 80%+
3. 기존 359개 테스트가 깨지면 안 됨

## 기존 테스트 파일 (참고용)

잘 작성된 테스트 예시:
- `src/modules/analytics/analytics.service.spec.ts` — Supabase mock 패턴의 정석
- `src/modules/customer-products/customer-products.service.spec.ts` — 복잡한 체인 mock
- `src/common/guards/auth.guard.spec.ts` — Guard 테스트 패턴
- `src/common/services/cache.service.spec.ts` — 유틸리티 서비스 테스트 패턴
- `src/common/filters/global-exception.filter.spec.ts` — Filter 테스트 패턴

---

## 작업 결과 (2026-02-09)

### 완료된 작업
- **Controller 테스트 추가**: 작업 목록의 모든 컨트롤러에 대해 성공/실패 케이스 테스트 작성
  - `analytics`, `orders`, `products`, `payments`, `inventory`, `branches`, `brands`, `members`,
    `dashboard`, `customer-orders`, `customer-products`, `customer-dashboard`,
    `customer-branches`, `customer-brands`, `public`, `public-order`, `upload`,
    `auth/me`, `health`
- **Guard 테스트 추가**: `admin`, `customer`, `membership`, `policy` spec 신규 작성
- **Interceptor/Service 테스트 추가**
  - `logging.interceptor.spec.ts`
  - `supabase.service.spec.ts` (createClient mock 포함)
- **테스트 고립 처리**: 컨트롤러 테스트는 `overrideGuard()`로 Guard 의존성을 우회하여
  서비스 호출/파라미터 전달만 검증하도록 구성

### 테스트/커버리지 결과
- 실행: `npx jest --coverage --coverageReporters=text-summary`
- 결과: **49 suites, 570 tests, ALL PASS**
- 커버리지:
  - **Statements 81.56%**
  - **Lines 83.05%**
  - (Branches 67.78%, Functions 87.72%)

### 참고
- 일부 서비스/가드 테스트에서 의도적으로 에러 경로를 검증하면서 로그가 출력될 수 있음.
  (테스트 실패는 아님)
