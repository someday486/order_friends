# Codex 프론트엔드 개선 지시서

> **프로젝트**: `apps/web/` (Next.js 16 + Tailwind CSS)
> **기준 브랜치**: `develop`
> **규칙**: 각 섹션을 별도 커밋으로. conventional commits 사용 (feat/fix/refactor).
> **빌드 검증**: 각 단계 완료 후 `cd apps/web && npx next build` 반드시 통과 확인.
> **테스트**: 변경한 파일에 대해 기존 테스트가 있으면 통과 확인.

---

## Phase 1: 공통 유틸/타입 추출 (refactor)

### 1-1. 공통 타입 파일 생성

**파일**: `apps/web/src/types/common.ts` (신규 생성)

아래 타입들이 여러 파일에 중복 정의되어 있다. 하나로 통합한다.

```typescript
// 주문 상태
export type OrderStatus =
  | "CREATED"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED";

// 주문 상태 한글 라벨 (관리자용 - 짧은 형태)
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  CREATED: "주문접수",
  CONFIRMED: "확인",
  PREPARING: "준비중",
  READY: "준비완료",
  COMPLETED: "완료",
  CANCELLED: "취소",
  REFUNDED: "환불",
};

// 주문 상태 한글 라벨 (고객용 - 긴 형태)
export const ORDER_STATUS_LABEL_LONG: Record<OrderStatus, string> = {
  CREATED: "주문 접수",
  CONFIRMED: "주문 확인",
  PREPARING: "준비 중",
  READY: "준비 완료",
  COMPLETED: "완료",
  CANCELLED: "취소됨",
  REFUNDED: "환불됨",
};

// 상태 뱃지 스타일
export const ORDER_STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  CREATED: "bg-warning-500/20 text-warning-500",
  CONFIRMED: "bg-primary-500/20 text-primary-500",
  PREPARING: "bg-primary-500/20 text-primary-500",
  READY: "bg-success/20 text-success",
  COMPLETED: "bg-neutral-500/20 text-text-secondary",
  CANCELLED: "bg-danger-500/20 text-danger-500",
  REFUNDED: "bg-pink-500/20 text-pink-400",
};

// 지점
export type Branch = {
  id: string;
  name: string;
  brandId?: string;
  slug?: string;
  myRole?: string | null;
  createdAt?: string;
};

// 브랜드
export type Brand = {
  id: string;
  name: string;
  description?: string | null;
  logo_url?: string | null;
  myRole?: string;
  created_at?: string;
};

// 결제 수단 라벨
export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CARD: "카드결제",
  CASH: "현금",
  TRANSFER: "계좌이체",
};
```

### 1-2. 공통 유틸 함수 파일 생성

**파일**: `apps/web/src/lib/format.ts` (신규 생성)

아래 함수들이 7곳 이상에서 중복 정의되어 있다. 하나로 통합한다.

```typescript
/** 원화 포맷 (예: 15,000원) */
export function formatWon(amount: number): string {
  return amount.toLocaleString("ko-KR") + "원";
}

/** 날짜+시간 포맷 (예: 01. 15. 오후 2:30) */
export function formatDateTime(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 날짜+시간 전체 포맷 (예: 2026. 01. 15. 오후 2:30) */
export function formatDateTimeFull(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 상대 시간 (예: 3분 전, 2시간 전) */
export function formatRelativeTime(iso: string): string {
  if (!iso) return "-";
  const now = new Date();
  const d = new Date(iso);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;

  return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

/** 전화번호 포맷 (예: 010-1234-5678) */
export function formatPhone(phone: string): string {
  if (!phone) return "-";
  return phone.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
}
```

### 1-3. 기존 파일에서 중복 제거

아래 파일들에서 `formatWon`, `formatDateTime`, `OrderStatus`, `statusLabel`, `Branch` 등의 로컬 정의를 삭제하고 공통 파일에서 import한다.

**변경 대상 파일 목록**:
- `apps/web/src/app/customer/orders/page.tsx` — `formatWon`, `formatDateTime`, `formatRelativeTime`을 `@/lib/format`에서 import. `OrderStatus`를 `@/types/common`에서 import.
- `apps/web/src/app/customer/orders/[orderId]/page.tsx` — 동일
- `apps/web/src/app/customer/page.tsx` — `formatWon` import 추가, `ORDER_STATUS_LABEL` import하여 대시보드 상태 표시에 사용
- `apps/web/src/app/customer/products/page.tsx` — `formatWon` import
- `apps/web/src/app/customer/products/[productId]/page.tsx` — `formatWon` import
- `apps/web/src/app/customer/inventory/[productId]/page.tsx` — `formatWon`, `formatDateTimeFull` import
- `apps/web/src/app/order/branch/[branchId]/page.tsx` — `formatWon` import
- `apps/web/src/app/order/branch/[branchId]/checkout/page.tsx` — `formatWon` import
- `apps/web/src/app/order/branch/[branchId]/complete/page.tsx` — `formatWon`, `formatDateTimeFull`, `ORDER_STATUS_LABEL_LONG` import
- `apps/web/src/app/order/[brandSlug]/[branchSlug]/complete/page.tsx` — 동일
- `apps/web/src/app/order/track/[orderId]/page.tsx` — `formatWon`, `formatDateTimeFull`, `ORDER_STATUS_LABEL_LONG` import

**주의사항**:
- 각 파일에서 로컬로 정의된 `formatWon()`, `formatDateTime()`, `statusLabel`, `OrderStatus` 타입을 삭제
- import 경로는 `@/lib/format` 과 `@/types/common` 사용
- `customer/orders/page.tsx`, `customer/orders/[orderId]/page.tsx`는 자체 확장 상수(statusConfig 등)를 유지해도 됨. 기본 타입만 공통에서 가져올 것

**커밋**: `refactor: extract common types and format utils`

---

## Phase 2: 한글 깨짐(mojibake) 수정 (fix)

여러 파일에서 한글 문자열이 `??`로 깨져 있다. **파일 인코딩이 UTF-8이 아닌 것이 원인**이다. 모든 해당 파일을 UTF-8로 저장하고, 깨진 문자열을 올바른 한글로 교체한다.

### 대상 파일 및 교체 내용

**규칙**: 아래 패턴에 따라 `??`가 포함된 모든 문자열을 맥락에 맞는 한글로 교체한다.

#### `apps/web/src/app/customer/page.tsx`
- 86행: `"?? ?? ? ?? ??"` → `"데이터를 불러올 수 없습니다"`

#### `apps/web/src/app/customer/products/page.tsx`
- 75행: `"?? ?? ?? ? ?? ??"` → `"지점 목록을 불러올 수 없습니다"`
- 99행: `"?? ?? ?? ? ?? ??"` → `"상품 목록을 불러올 수 없습니다"`
- 156행: `"?? ?? ? ?? ??"` → `"순서 저장에 실패했습니다"`

#### `apps/web/src/app/customer/inventory/page.tsx`
- 70행: `"?? ?? ?? ? ?? ??"` → `"지점 목록을 불러올 수 없습니다"`
- 90행: `"?? ?? ?? ? ?? ??"` → `"재고 목록을 불러올 수 없습니다"`

#### `apps/web/src/app/customer/inventory/[productId]/page.tsx`
- 148행: `"?? ?? ?? ? ?? ??"` → `"지점 목록을 불러올 수 없습니다"`
- 161행: `"??? ?? ID???. ?? ???? ?? ??????."` → `"잘못된 상품 ID입니다. 재고 목록에서 다시 선택해주세요."`
- 188행: `"?? ?? ?? ? ?? ??"` → `"재고 정보를 불러올 수 없습니다"`
- 220행: `"?? ?? ? ?? ??"` → `"재고 수정에 실패했습니다"`
- 231행: `"??? ??? ??????"` → `"유효한 수량을 입력해주세요"`
- 259행: `"?? ?? ? ?? ??"` → `"재고 조정에 실패했습니다"`
- 335행: `"?? ???"` → `"상품 이미지"` (Image alt 텍스트)

#### `apps/web/src/app/customer/branches/page.tsx`
- 56행: `"??? ?? ?? ? ?? ??"` → `"브랜드 목록을 불러올 수 없습니다"`
- 78행: `"?? ?? ?? ? ?? ??"` → `"지점 목록을 불러올 수 없습니다"`
- 207행 (alert in AddBranchModal): `"?? ??? ??????"` → `"모든 필드를 입력해주세요"`
- 219행: `"??? ???????."` → `"지점이 추가되었습니다."`
- 223행: `"?? ?? ? ?? ??"` → `"지점 추가에 실패했습니다"`

#### `apps/web/src/app/customer/categories/page.tsx`
- 68행: `"?? ?? ?? ? ?? ??"` → `"지점 목록을 불러올 수 없습니다"`
- 93행: `"???? ?? ? ?? ??"` → `"카테고리를 불러올 수 없습니다"`
- 122행: `"???? ?? ??"` → `"카테고리 추가에 실패했습니다"`
- 139행: `"???? ?? ??"` → `"카테고리 수정에 실패했습니다"`
- 153행: `"?? ?? ??"` → `"상태 변경에 실패했습니다"`
- 158행 (confirm): `"? ????? ?????????\n?? ????? ??? '???? ??' ??? ???."` → `"이 카테고리를 삭제하시겠습니까?\n해당 카테고리의 상품은 '카테고리 없음' 상태가 됩니다."`
- 164행: `"???? ?? ??"` → `"카테고리 삭제에 실패했습니다"`
- 183행: `"?? ?? ??:"` → `"순서 저장 실패:"` (console.error)

#### `apps/web/src/app/customer/products/[productId]/page.tsx`
- 107행: `"?? ?? ?? ? ?? ??"` → `"지점 목록을 불러올 수 없습니다"`
- 147행: `"?? ?? ? ?? ??"` → `"상품 정보를 불러올 수 없습니다"`
- 220행 (alert): `"???? ??????"` → `"상품명을 입력해주세요"`
- 225행: `"??? ??????"` → `"매장을 선택해주세요"`
- 230행: `"????? ??????"` → `"카테고리를 선택해주세요"`
- 235행: `"??? 0 ???? ??????"` → `"가격은 0 이상이어야 합니다"`
- 263행: `"??? ???????."` → `"상품이 등록되었습니다."`
- 292행: `"?? ??? ???????."` → `"상품 정보가 수정되었습니다."`
- 296행: `"?? ? ?? ??"` → `"저장에 실패했습니다"`
- 303행 (confirm): `"${product?.name}" ??? ?????????` → `"${product?.name}" 상품을 삭제하시겠습니까?`
- 309행: `"??? ???????."` → `"상품이 삭제되었습니다."`
- 313행: `"?? ? ?? ??"` → `"삭제에 실패했습니다"`
- 460행: `"?? ????"` → `"상품 미리보기"` (Image alt 텍스트)

#### `apps/web/src/app/customer/inventory/page.tsx`
- 188행: `"?? ???"` → `"상품 이미지"` (Image alt 텍스트)

**커밋**: `fix: restore broken Korean strings (mojibake) across all pages`

---

## Phase 3: 빌드 타입 에러 수정 (fix)

### 3-1. LineChart 타입 호환성

**파일**: `apps/web/src/components/analytics/LineChart.tsx`

**현재 문제**: `data` prop이 `Array<Record<string, number | string>>`인데, 구체적 인터페이스(`RevenueByDay` 등)는 index signature가 없어 할당 불가.

**수정 방법**: `data` prop 타입을 제네릭 또는 더 관대한 타입으로 변경한다.

```typescript
// 변경 전 (21행)
type LineChartProps = {
  data: Array<Record<string, number | string>>;
  // ...
};

// 변경 후
type LineChartProps = {
  data: Array<Record<string, unknown>>;
  // ...
};
```

동일 패턴이 있다면 `BarChart.tsx`, `PieChart.tsx`에도 적용.

**커밋**: `fix: loosen chart component data types for interface compatibility`

---

## Phase 4: 토스트 알림 시스템 도입 (feat)

### 4-1. react-hot-toast 설치

```bash
cd apps/web && npm install react-hot-toast
```

### 4-2. Toaster 컴포넌트 추가

**파일**: `apps/web/src/app/layout.tsx`

루트 레이아웃에 `<Toaster />` 추가:

```tsx
import { Toaster } from 'react-hot-toast';

// return 안에 추가:
<Toaster
  position="top-center"
  toastOptions={{
    duration: 3000,
    style: {
      background: 'var(--color-bg-secondary)',
      color: 'var(--color-text-primary)',
      border: '1px solid var(--color-border)',
      borderRadius: '12px',
      fontSize: '14px',
    },
    success: {
      iconTheme: { primary: '#34C759', secondary: '#fff' },
    },
    error: {
      iconTheme: { primary: '#FF3B30', secondary: '#fff' },
    },
  }}
/>
```

### 4-3. 모든 alert()를 toast로 교체

아래 파일에서 `alert()` 호출을 `toast.success()` 또는 `toast.error()`로 교체한다.
상단에 `import toast from 'react-hot-toast';` 추가.

**교체 규칙**:
- `alert("...성공...")`, `alert("...완료...")`, `alert("...등록...")`, `alert("...삭제...")` → `toast.success("...")`
- `alert("...실패...")`, `alert("...오류...")`, catch 블록 안의 alert → `toast.error("...")`
- `alert("...입력해주세요")`, `alert("...선택해주세요")` → `toast.error("...")`

**대상 파일**:
| 파일 | alert 횟수 |
|------|-----------|
| `customer/products/[productId]/page.tsx` | 8곳 (220, 225, 230, 235, 263, 292, 296, 309, 313행) |
| `customer/categories/page.tsx` | 3곳 (122, 139, 153, 164행) |
| `customer/branches/page.tsx` | 3곳 (207, 219, 223행) |
| `customer/products/page.tsx` | 1곳 (156행) |
| `customer/inventory/[productId]/page.tsx` | 0곳 (error state 사용 중이므로 그대로 둬도 됨) |
| `order/branch/[branchId]/page.tsx` | 1곳 (163행) |

### 4-4. confirm()을 커스텀 모달로 교체 (선택)

`confirm()`은 일단 유지해도 됨. 추후 UI 개선 시 커스텀 confirm 모달로 교체.
단, `categories/page.tsx:158`행의 깨진 confirm 메시지는 Phase 2에서 이미 수정됨.

**커밋**: `feat: add toast notifications, replace all alert() calls`

---

## Phase 5: 대시보드 상태 영문→한글 (fix)

**파일**: `apps/web/src/app/customer/page.tsx`

### 5-1. 상태 라벨 매핑 추가

190행 부근, Badge 컴포넌트에 영문 status가 그대로 들어가고 있음:

```tsx
// 변경 전
<Badge variant={getStatusVariant(order.status)}>
  {order.status}
</Badge>

// 변경 후 - ORDER_STATUS_LABEL을 import해서 사용
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/types/common";

<Badge variant={getStatusVariant(order.status)}>
  {ORDER_STATUS_LABEL[order.status as OrderStatus] ?? order.status}
</Badge>
```

**커밋**: `fix: show Korean labels for order status in dashboard`

---

## Phase 6: 네비게이션 버그 수정 (fix)

### 6-1. window.location.href → Next.js Router

**파일**: `apps/web/src/app/customer/inventory/page.tsx`

181행에서 `window.location.href`를 사용하여 full page reload가 발생함.

```tsx
// 변경 전 (181행)
onClick={() => window.location.href = `/customer/inventory/${item.product_id}`}

// 변경 후: 전체 <tr>을 <Link>로 감싸거나, useRouter 사용
```

**방법 A (권장)**: `<tr>` 대신 `<Link>` 컴포넌트로 래핑된 구조를 사용하거나,
**방법 B**: 컴포넌트 상단에서 `const router = useRouter();`를 선언하고:
```tsx
onClick={() => router.push(`/customer/inventory/${item.product_id}`)}
```

`useRouter`를 import: `import { useRouter } from "next/navigation";`

### 6-2. useEffect dependency 누락 수정

**파일**: `apps/web/src/app/order/track/[orderId]/page.tsx`

85~106행의 `fetchOrder` 함수가 컴포넌트 본문에 정의되어 있고, 108~112행과 115~123행의 useEffect에서 호출하지만 dependency array에 포함되지 않음.

```tsx
// 수정: fetchOrder를 useCallback으로 감싸기
import { useCallback } from "react";

const fetchOrder = useCallback(async () => {
  // ... 기존 로직 그대로
}, [orderId]); // orderId에 의존

useEffect(() => {
  if (orderId) {
    fetchOrder();
  }
}, [orderId, fetchOrder]);

useEffect(() => {
  if (!orderId) return;
  const interval = setInterval(fetchOrder, 30000);
  return () => clearInterval(interval);
}, [orderId, fetchOrder]);
```

**커밋**: `fix: use Next.js router for navigation, fix useEffect deps`

---

## Phase 7: 로딩 스켈레톤 UI 통일 (feat)

### 7-1. 공통 스켈레톤 컴포넌트 생성

**파일**: `apps/web/src/components/ui/Skeleton.tsx` (신규 생성)

```tsx
type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div className={`bg-bg-tertiary rounded animate-pulse ${className}`} />
  );
}

/** 카드 형태 스켈레톤 */
export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-card rounded-md border border-border p-4 animate-pulse">
      <Skeleton className="h-5 w-24 mb-3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-4 mb-2 ${i === lines - 1 ? "w-1/2" : "w-full"}`}
        />
      ))}
    </div>
  );
}

/** 테이블 행 스켈레톤 */
export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-t border-border animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-3 px-3.5">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}
```

### 7-2. 각 페이지의 로딩 상태를 스켈레톤으로 교체

아래 페이지들의 `"로딩 중..."` 텍스트를 적절한 스켈레톤 컴포넌트로 교체한다.

| 파일 | 현재 로딩 | 교체 방식 |
|------|----------|----------|
| `customer/page.tsx:96-101` | 텍스트 | `CardSkeleton` 6개 (3x2 그리드) |
| `customer/products/page.tsx:163-170` | 텍스트 | `CardSkeleton` 4개 (그리드) |
| `customer/inventory/page.tsx:99-106` | 텍스트 | `TableRowSkeleton` 5개 |
| `customer/branches/page.tsx:130` | 텍스트 | `CardSkeleton` 3개 |
| `customer/brands/page.tsx:57-64` | 텍스트 | `CardSkeleton` 2개 |
| `customer/categories/page.tsx:187-194` | 텍스트 | `Skeleton` 막대 3개 |

**커밋**: `feat: add skeleton loading UI to all customer pages`

---

## Phase 8: 모바일 반응형 개선 (fix)

### 8-1. 재고 테이블 가로 스크롤

**파일**: `apps/web/src/app/customer/inventory/page.tsx`

162행의 테이블을 `overflow-x-auto` 컨테이너로 감싼다:

```tsx
// 변경 전
<div className="border border-border rounded-xl overflow-hidden">
  <table ...>

// 변경 후
<div className="border border-border rounded-xl overflow-hidden overflow-x-auto">
  <table className="w-full border-collapse min-w-[640px]">
```

### 8-2. 재고 상세 그리드 반응형

**파일**: `apps/web/src/app/customer/inventory/[productId]/page.tsx`

358행: `grid-cols-4` → `grid-cols-2 sm:grid-cols-4`
391행: `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`

### 8-3. 분석 페이지 테이블 가로 스크롤

**파일**: `apps/web/src/app/customer/analytics/page.tsx`

553행 (조합 분석 테이블): `overflow-x-auto`가 이미 있으므로 OK.
히트맵/RFM 차트가 있는 영역: `HeatmapTable` 컴포넌트의 부모에 `overflow-x-auto`를 추가.

### 8-4. 상품 상세 레이아웃 반응형

**파일**: `apps/web/src/app/customer/products/[productId]/page.tsx`

554행: `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`

**커밋**: `fix: improve mobile responsiveness for tables and grids`

---

## Phase 9: 공개 주문 페이지 개선 (feat)

### 9-1. 상품 이미지 표시

**파일**: `apps/web/src/app/order/branch/[branchId]/page.tsx`

Product 타입에 `image_url` 필드를 추가하고, 상품 리스트 아이템에 이미지를 표시한다.

```tsx
// 타입 수정 (17-23행)
type Product = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  image_url?: string | null;  // 추가
  options: ProductOption[];
};

// 상품 카드에 이미지 추가 (211-228행 부근)
// 기존 flex 아이템 구조에 이미지 추가:
<div className="flex items-center gap-3 p-4 rounded-xl border ...">
  {product.image_url ? (
    <Image
      src={product.image_url}
      alt={product.name}
      width={64}
      height={64}
      className="w-16 h-16 rounded-lg object-cover shrink-0"
    />
  ) : (
    <div className="w-16 h-16 rounded-lg bg-bg-tertiary flex items-center justify-center shrink-0">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-tertiary">
        <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    </div>
  )}
  <div className="flex-1">...</div>
  <div className="font-bold ...">{formatWon(product.price)}</div>
</div>
```

`import Image from "next/image";` 추가 필요.

### 9-2. 카테고리 탭 필터 추가

**파일**: `apps/web/src/app/order/branch/[branchId]/page.tsx`

상품 데이터에 카테고리가 포함되어 있다면, 카테고리별 필터 탭을 추가한다.

```tsx
// 카테고리 추출 (products 로드 후)
const categories = useMemo(() => {
  const cats = new Set(products.map(p => p.category_name).filter(Boolean));
  return ["전체", ...Array.from(cats)];
}, [products]);

const [selectedCategory, setSelectedCategory] = useState("전체");

const filteredProducts = selectedCategory === "전체"
  ? products
  : products.filter(p => p.category_name === selectedCategory);
```

카테고리 탭 UI (상품 목록 위에):
```tsx
<div className="flex gap-2 overflow-x-auto scrollbar-hide py-2 mb-3 -mx-4 px-4">
  {categories.map(cat => (
    <button
      key={cat}
      onClick={() => setSelectedCategory(cat)}
      className={`category-tab ${selectedCategory === cat ? "category-tab-active" : ""}`}
    >
      {cat}
    </button>
  ))}
</div>
```

> **참고**: 백엔드 `/public/branches/:id/products` API가 카테고리 정보를 내려주지 않는다면, Product 타입에 `category_name?: string`을 추가하되 API 응답에 없으면 카테고리 탭은 표시하지 않도록 조건부 렌더링한다.

### 9-3. raw fetch → apiClient 통일

**파일**: `apps/web/src/app/order/branch/[branchId]/page.tsx`

92~101행에서 raw `fetch`를 사용. `apiClient.get()`에 `{ auth: false }` 옵션을 사용하도록 변경.

```tsx
// 변경 전
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const branchRes = await fetch(`${API_BASE}/public/branches/${branchId}`);
const productsRes = await fetch(`${API_BASE}/public/branches/${branchId}/products`);

// 변경 후
import { apiClient } from "@/lib/api-client";

const branchData = await apiClient.get<Branch>(`/public/branches/${branchId}`, { auth: false });
const productsData = await apiClient.get<Product[]>(`/public/branches/${branchId}/products`, { auth: false });
```

**동일 변경을 적용할 파일들**:
- `apps/web/src/app/order/branch/[branchId]/checkout/page.tsx` (113~119행 - POST)
- `apps/web/src/app/order/track/[orderId]/page.tsx` (90행 - GET)
- `apps/web/src/app/order/[brandSlug]/[branchSlug]/OrderPageClient.tsx` (있다면)

`apiClient`에 `put` 메서드가 없으면 POST는 `apiClient.post(path, body, { auth: false })`로.

각 파일에서 `const API_BASE = ...` 상수 제거.

**커밋**: `feat: add product images and category filter to public order page, unify api calls`

---

## Phase 10: Supabase 클라이언트 정리 (refactor)

### 10-1. 중복 파일 통합

현재 상태:
- `apps/web/src/lib/supabaseClient.ts` — 여러 파일에서 import
- `apps/web/src/lib/supabase/client.ts` — 일부 파일에서 import
- `apps/web/src/lib/supabase/server.ts` — server component용

**작업**:
1. `supabaseClient.ts`와 `supabase/client.ts` 내용을 비교
2. 하나로 통합 (권장: `supabase/client.ts`를 유지, `supabaseClient.ts`는 re-export만)
3. 또는 `supabaseClient.ts`를 유지하고 `supabase/client.ts`에서 re-export

```typescript
// apps/web/src/lib/supabaseClient.ts (유지)
export { createClient } from './supabase/client';
```

또는 모든 import를 하나로 통일한 뒤 나머지 삭제.

**커밋**: `refactor: consolidate supabase client imports`

---

## Phase 11: any 타입 제거 (refactor)

### 11-1. useUserRole.ts

**파일**: `apps/web/src/hooks/useUserRole.ts`

```typescript
// 변경 전 (20행)
memberships: any[];
ownedBrands: any[];

// 변경 후
memberships: Array<{
  brandId: string;
  branchId?: string;
  role: string;
}>;
ownedBrands: Array<{
  id: string;
  name: string;
}>;
```

### 11-2. Product options

**파일**: `apps/web/src/app/customer/products/[productId]/page.tsx`

```typescript
// 변경 전 (25행)
options?: any[];

// 변경 후
options?: Array<{
  id: string;
  name: string;
  priceDelta: number;
}>;
```

### 11-3. API 응답에서 any 사용

파일 전체에서 `apiClient.get<any>(...)` 패턴을 검색하여, 가능한 곳에 구체적 타입을 지정한다.

**커밋**: `refactor: replace any types with specific interfaces`

---

## Phase 12: 에러 바운더리 추가 (feat)

### 12-1. customer 레이아웃 에러 바운더리

**파일**: `apps/web/src/app/customer/error.tsx` (신규 생성)

```tsx
"use client";

import { useEffect } from "react";

export default function CustomerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-16 h-16 rounded-full bg-danger-500/10 flex items-center justify-center mb-4">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-danger-500">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4m0 4h.01" />
        </svg>
      </div>
      <h2 className="text-lg font-bold text-foreground mb-2">오류가 발생했습니다</h2>
      <p className="text-sm text-text-secondary mb-6 max-w-md text-center">
        {error.message || "알 수 없는 오류가 발생했습니다."}
      </p>
      <button onClick={reset} className="btn-primary h-10 px-6 text-sm">
        다시 시도
      </button>
    </div>
  );
}
```

### 12-2. order 레이아웃 에러 바운더리

**파일**: `apps/web/src/app/order/error.tsx` (신규 생성)

```tsx
"use client";

import { useEffect } from "react";

export default function OrderError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="text-center">
        <h2 className="text-lg font-bold mb-2">오류가 발생했습니다</h2>
        <p className="text-sm text-text-secondary mb-6">
          {error.message || "알 수 없는 오류입니다."}
        </p>
        <button onClick={reset} className="btn-primary h-10 px-6 text-sm">
          다시 시도
        </button>
      </div>
    </div>
  );
}
```

**커밋**: `feat: add error boundaries for customer and order layouts`

---

## Phase 13: 분석 페이지 API 호출 최적화 (refactor)

### 13-1. 탭 기반 지연 로딩

**파일**: `apps/web/src/app/customer/analytics/page.tsx`

현재 9개 API를 `Promise.all`로 동시 호출. 하나라도 실패하면 전체 실패.

**수정 방향**:
1. 탭 4개로 분리: "매출", "상품", "주문", "고객"
2. 각 탭 선택 시에만 해당 데이터를 fetch
3. `Promise.allSettled` 사용으로 부분 실패 허용

```tsx
const [activeTab, setActiveTab] = useState<"sales" | "products" | "orders" | "customers">("sales");

// 탭 UI
<div className="flex gap-2 overflow-x-auto scrollbar-hide mb-6">
  {[
    { key: "sales", label: "매출" },
    { key: "products", label: "상품" },
    { key: "orders", label: "주문" },
    { key: "customers", label: "고객" },
  ].map(tab => (
    <button
      key={tab.key}
      onClick={() => setActiveTab(tab.key)}
      className={`category-tab ${activeTab === tab.key ? "category-tab-active" : ""}`}
    >
      {tab.label}
    </button>
  ))}
</div>
```

각 탭의 데이터를 별도 useEffect로 로드:
- "매출" 탭: sales API만 호출
- "상품" 탭: products + abc + hourly + combinations API
- "주문" 탭: orders API
- "고객" 탭: customers + cohort + rfm API

**커밋**: `refactor: split analytics into tabs with lazy loading`

---

## Phase 14: 주문 목록 N+1 API 제거 (fix)

**파일**: `apps/web/src/app/customer/orders/page.tsx`

현재 브랜드 목록을 먼저 가져온 뒤, 각 브랜드별로 branches API를 N번 호출.

```tsx
// 변경 전 (104-126행)
const brands = await apiClient.get<any[]>("/customer/brands");
for (const brand of brands) {
  const branchData = await apiClient.get<Branch[]>(`/customer/brands/${brand.id}/branches`);
  branchList.push(...branchData);
}

// 변경 후 - 단일 API 호출
const branchList = await apiClient.get<Branch[]>("/customer/branches");
setBranches(branchList);
```

`/customer/branches` 엔드포인트가 이미 존재하며, 다른 페이지(products, inventory 등)에서 사용 중.

**커밋**: `fix: remove N+1 API calls in order list branch loading`

---

## Phase 15: 다크모드 토글 (feat, 선택적)

> 이 단계는 선택적(optional)이다. 필요하면 구현.

### 15-1. 다크모드 토글 훅

**파일**: `apps/web/src/hooks/useDarkMode.ts` (신규 생성)

```tsx
"use client";

import { useState, useEffect } from "react";

export function useDarkMode() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark") {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    } else if (stored === "light") {
      document.documentElement.classList.remove("dark");
      setIsDark(false);
    }
    // stored가 없으면 시스템 설정 따름 (기본 동작)
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  return { isDark, toggle };
}
```

### 15-2. 사이드바에 토글 버튼 추가

**파일**: `apps/web/src/app/customer/layout.tsx`

로그아웃 버튼 위에 다크모드 토글 추가.

**커밋**: `feat: add dark mode toggle`

---

## 실행 순서 요약

| 순서 | Phase | 중요도 | 예상 난이도 |
|------|-------|--------|-----------|
| 1 | Phase 1: 공통 유틸/타입 추출 | 높음 | 중 |
| 2 | Phase 2: 한글 깨짐 수정 | 높음 | 낮음 |
| 3 | Phase 3: 빌드 타입 에러 | 높음 | 낮음 |
| 4 | Phase 5: 대시보드 상태 한글화 | 높음 | 낮음 |
| 5 | Phase 6: 네비게이션 버그 | 높음 | 낮음 |
| 6 | Phase 14: N+1 API 제거 | 높음 | 낮음 |
| 7 | Phase 4: 토스트 시스템 | 중 | 중 |
| 8 | Phase 7: 스켈레톤 UI | 중 | 중 |
| 9 | Phase 8: 모바일 반응형 | 중 | 낮음 |
| 10 | Phase 9: 공개 주문 페이지 | 중 | 중 |
| 11 | Phase 10: Supabase 정리 | 낮음 | 낮음 |
| 12 | Phase 11: any 타입 제거 | 낮음 | 낮음 |
| 13 | Phase 12: 에러 바운더리 | 중 | 낮음 |
| 14 | Phase 13: 분석 탭 분리 | 중 | 높음 |
| 15 | Phase 15: 다크모드 (선택) | 낮음 | 중 |

---

## 검증 체크리스트

각 Phase 완료 후:
1. `cd apps/web && npx next build` — 빌드 성공
2. 브라우저에서 해당 페이지 동작 확인
3. 다크모드 + 라이트모드 둘 다 확인
4. 모바일(375px) + 데스크탑(1440px) 둘 다 확인
5. 커밋 메시지는 conventional commits 형식
