# Codex 프론트엔드 개선 작업 지시서

## 개요

이 문서는 `apps/web/` (Next.js 16) 프론트엔드에 대한 13개의 UI 개선 작업을 정의합니다. 각 작업은 독립적이며, 정확한 파일 경로, 변경 전/후 코드, 커밋 메시지를 포함합니다.

---

## 전제 조건 (Prerequisites)

### 공통 의존성
- 프로젝트 루트: `apps/web/`
- 스타일: Tailwind CSS (커스텀 디자인 토큰 사용)
- API 클라이언트: `@/lib/api-client`의 `apiClient`
- 토스트: `react-hot-toast`
- UI 언어: 한국어

### Phase 0 완료 파일 (이미 존재함)
다음 파일들은 이미 생성 완료되어 있으며, Batch 1/2 작업에서 import하여 사용합니다:

- **SVG 아이콘**: `apps/web/src/components/ui/icons/` (index.ts에서 re-export)
  - `HomeIcon`, `OrderIcon`, `ProductIcon`, `StoreIcon`, `BrandIcon`, `ChartIcon`, `TrendIcon`, `TagIcon`, `InventoryIcon`, `BellIcon`, `PencilIcon`, `SearchIcon`
- **NotificationBell**: `apps/web/src/components/ui/NotificationBell.tsx`
- **NotificationProvider**: `apps/web/src/providers/NotificationProvider.tsx`
- **SortableList**: `apps/web/src/components/ui/SortableList.tsx`
- **DragHandle**: `apps/web/src/components/ui/DragHandle.tsx`

### 아이콘 import 패턴
```tsx
import { HomeIcon, TrendIcon, BrandIcon } from "@/components/ui/icons";
```

모든 아이콘 컴포넌트의 props: `{ className?: string; size?: number }`

---

## Batch 1 (의존성 없음 - 즉시 병렬 수행 가능)

---

### Task 1: 이모지 → SVG 아이콘 교체 (1-A)

**파일**: `apps/web/src/app/customer/layout.tsx`
**Batch**: 1

#### 단계

1. 파일 상단에 아이콘 import 추가:

```tsx
// BEFORE (현재 import 없음)

// AFTER
import {
  HomeIcon,
  TrendIcon,
  BrandIcon,
  StoreIcon,
  ProductIcon,
  TagIcon,
  InventoryIcon,
  OrderIcon,
} from "@/components/ui/icons";
```

2. `MenuItem` 타입의 `icon` 필드 변경:

```tsx
// BEFORE
type MenuItem = {
  href: string;
  label: string;
  icon: string;
  allowedRoles?: UserRole[];
};

// AFTER
type MenuItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  allowedRoles?: UserRole[];
};
```

3. `menuItems` 배열의 아이콘 값 교체:

```tsx
// BEFORE
const menuItems: MenuItem[] = [
  { href: "/customer", label: "대시보드", icon: "📊" },
  {
    href: "/customer/analytics/brand",
    label: "브랜드 분석",
    icon: "📈",
    allowedRoles: ["system_admin", "brand_owner"],
  },
  {
    href: "/customer/brands",
    label: "브랜드 관리",
    icon: "🏢",
    allowedRoles: ["system_admin", "brand_owner"],
  },
  {
    href: "/customer/branches",
    label: "매장 관리",
    icon: "🏪",
    allowedRoles: ["system_admin", "brand_owner"],
  },
  {
    href: "/customer/products",
    label: "상품 관리",
    icon: "📦",
    allowedRoles: ["system_admin", "brand_owner", "branch_manager"],
  },
  {
    href: "/customer/categories",
    label: "카테고리 관리",
    icon: "🏷",
    allowedRoles: ["system_admin", "brand_owner"],
  },
  {
    href: "/customer/inventory",
    label: "재고 관리",
    icon: "📊",
    allowedRoles: ["system_admin", "brand_owner", "branch_manager"],
  },
  {
    href: "/customer/orders",
    label: "주문 관리",
    icon: "📋",
    allowedRoles: ["system_admin", "brand_owner", "branch_manager", "staff"],
  },
];

// AFTER
const menuItems: MenuItem[] = [
  { href: "/customer", label: "대시보드", icon: HomeIcon },
  {
    href: "/customer/analytics/brand",
    label: "브랜드 분석",
    icon: TrendIcon,
    allowedRoles: ["system_admin", "brand_owner"],
  },
  {
    href: "/customer/brands",
    label: "브랜드 관리",
    icon: BrandIcon,
    allowedRoles: ["system_admin", "brand_owner"],
  },
  {
    href: "/customer/branches",
    label: "매장 관리",
    icon: StoreIcon,
    allowedRoles: ["system_admin", "brand_owner"],
  },
  {
    href: "/customer/products",
    label: "상품 관리",
    icon: ProductIcon,
    allowedRoles: ["system_admin", "brand_owner", "branch_manager"],
  },
  {
    href: "/customer/categories",
    label: "카테고리 관리",
    icon: TagIcon,
    allowedRoles: ["system_admin", "brand_owner"],
  },
  {
    href: "/customer/inventory",
    label: "재고 관리",
    icon: InventoryIcon,
    allowedRoles: ["system_admin", "brand_owner", "branch_manager"],
  },
  {
    href: "/customer/orders",
    label: "주문 관리",
    icon: OrderIcon,
    allowedRoles: ["system_admin", "brand_owner", "branch_manager", "staff"],
  },
];
```

4. nav 내부 Link 렌더링에서 아이콘 렌더링 방식 변경:

```tsx
// BEFORE (약 153줄)
              <span className="mr-2">{item.icon}</span>
              {item.label}

// AFTER
              <item.icon size={18} className="mr-2 flex-shrink-0" />
              {item.label}
```

#### 커밋 메시지
```
feat(web): replace emoji sidebar icons with SVG components
```

---

### Task 2: 상품 검색 기능 추가 (2-A)

**파일**: `apps/web/src/app/customer/products/page.tsx`
**Batch**: 1

#### 단계

1. import에 `SearchIcon` 추가:

```tsx
// BEFORE
import { CardSkeleton } from "@/components/ui/Skeleton";

// AFTER
import { CardSkeleton } from "@/components/ui/Skeleton";
import { SearchIcon } from "@/components/ui/icons";
```

2. 컴포넌트 내부에 검색 상태 추가 (`useState` 이미 import됨):

```tsx
// BEFORE (약 53줄)
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

// AFTER
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
```

3. Branch Filter 섹션 아래, `{!isReorderMode && (` 블록 안에 검색 입력 추가. 기존 `<select>` 바로 뒤에 검색 입력을 추가:

```tsx
// BEFORE (약 198~214줄)
      {!isReorderMode && (
        <div className="mb-6">
          <label className="block text-sm text-text-secondary mb-2 font-semibold">매장 선택</label>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="input-field max-w-[400px]"
          >
            <option value="">매장을 선택하세요</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>
      )}

// AFTER
      {!isReorderMode && (
        <div className="mb-6">
          <label className="block text-sm text-text-secondary mb-2 font-semibold">매장 선택</label>
          <div className="flex flex-wrap items-end gap-4">
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="input-field max-w-[400px]"
            >
              <option value="">매장을 선택하세요</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            <div className="relative max-w-xs">
              <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="상품명 검색..."
                className="input-field pl-9 w-full"
              />
            </div>
          </div>
        </div>
      )}
```

4. 상품 리스트 렌더링 부분에 검색 필터 추가:

```tsx
// BEFORE (약 328~333줄)
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {products.map((product) => (
            <CustomerProductCard key={product.id} product={product} />
          ))}
        </div>

// AFTER
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {products
            .filter(p => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((product) => (
              <CustomerProductCard key={product.id} product={product} />
            ))}
        </div>
```

#### 커밋 메시지
```
feat(web): add product search filter
```

---

### Task 3: 판매활성화 드롭다운 + 우측상단 이동 (2-E)

**파일**: `apps/web/src/app/customer/products/[productId]/page.tsx`
**Batch**: 1

#### 단계

1. 기존 판매 활성화 체크박스 제거 (약 472~481줄):

```tsx
// BEFORE
            <div className="mb-6">
              <label className="flex items-center gap-2 text-[13px] text-text-secondary font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
                판매 활성화
              </label>
            </div>

// AFTER
            {/* 판매 활성화는 상단 드롭다운으로 이동됨 */}
```

2. `<div className="card p-6">` 바로 뒤, `{isEditing ? (` 블록의 시작 직후에 활성화 드롭다운 추가. 구체적으로는 `{isEditing ? (` 다음 `<div>` 안, `{/* Branch selection (only for new products) */}` 주석 바로 위에 삽입:

```tsx
// BEFORE (약 374~378줄)
        {isEditing ? (
          <div>
            {/* Branch selection (only for new products) */}

// AFTER
        {isEditing ? (
          <div>
            {/* 판매 상태 드롭다운 (우측 정렬) */}
            <div className="flex justify-end mb-4">
              <select
                value={formData.isActive ? "active" : "inactive"}
                onChange={(e) => setFormData(prev => ({...prev, isActive: e.target.value === "active"}))}
                className="input-field w-auto min-w-[140px] text-sm"
              >
                <option value="active">판매중</option>
                <option value="inactive">숨김</option>
              </select>
            </div>

            {/* Branch selection (only for new products) */}
```

#### 커밋 메시지
```
refactor(web): move product sales status to top-right dropdown
```

---

### Task 4: 카테고리별 상품 정렬 (2-G)

**파일**: `apps/web/src/app/customer/products/page.tsx`
**Batch**: 1

#### 단계

1. 컴포넌트 내부에 카테고리 상태 추가:

```tsx
// BEFORE (약 53~54줄)
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [loading, setLoading] = useState(true);

// AFTER
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [categories, setCategories] = useState<{id: string; name: string}[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [loading, setLoading] = useState(true);
```

2. `selectedBranchId`가 변경될 때 상품을 로드하는 `useEffect` 안에서, 상품 로딩 성공 후 카테고리도 함께 fetch:

```tsx
// BEFORE (약 91~96줄, loadProducts 함수 안)
        const data = await apiClient.get<Product[]>(`/customer/products?branchId=${encodeURIComponent(selectedBranchId)}`);
        setProducts(data);
        const branch = branches.find((item) => item.id === selectedBranchId);
        if (branch) {
          setUserRole(branch.myRole);
        }

// AFTER
        const data = await apiClient.get<Product[]>(`/customer/products?branchId=${encodeURIComponent(selectedBranchId)}`);
        setProducts(data);
        const branch = branches.find((item) => item.id === selectedBranchId);
        if (branch) {
          setUserRole(branch.myRole);
        }

        // 카테고리 목록 로드
        apiClient.get<{id: string; name: string}[]>(`/customer/products/categories?branchId=${encodeURIComponent(selectedBranchId)}`)
          .then(cats => setCategories(cats))
          .catch(() => {});
```

3. Branch Filter 영역에 카테고리 드롭다운 추가. Task 2에서 검색 입력을 추가한 경우 그 옆에, 아니면 `<select>` 뒤에 추가:

```tsx
// 기존 매장 select 바로 뒤에 카테고리 드롭다운 추가 (flex wrap 안에서)
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="input-field w-auto min-w-[140px] text-sm"
            >
              <option value="">전체 카테고리</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
```

> **참고**: Task 2와 함께 수행하는 경우 `<div className="flex flex-wrap items-end gap-4">` 안에 매장 select, 카테고리 select, 검색 input이 나란히 놓이도록 배치합니다. Task 2 없이 단독 수행하는 경우, Branch Filter `<div className="mb-6">` 안에 매장 select 아래에 별도 줄로 추가합니다.

4. 상품 리스트 렌더링에 카테고리 필터 추가:

```tsx
// BEFORE
          {products.map((product) => (

// AFTER
          {products
            .filter(p => !selectedCategoryId || p.category_id === selectedCategoryId)
            .map((product) => (
```

> **참고**: Task 2의 검색 필터와 함께 사용하는 경우, 체이닝합니다:
> ```tsx
> {products
>   .filter(p => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()))
>   .filter(p => !selectedCategoryId || p.category_id === selectedCategoryId)
>   .map((product) => (
> ```

#### 커밋 메시지
```
feat(web): add category filter to product list
```

---

### Task 5: 수정 → 상세 뒤로가기 (2-H)

**파일**: `apps/web/src/app/customer/products/[productId]/page.tsx`
**Batch**: 1

#### 단계

이 파일의 현재 코드를 분석하면, 수정 후 저장(handleSave)과 취소 버튼은 이미 올바르게 구현되어 있습니다:

- **handleSave** (268~296줄): 기존 상품 수정 시 `setIsEditing(false)` + `setProduct(updated)` 호출 -> 상세뷰로 복귀. 이미 올바름.
- **취소 버튼** (487~509줄): `setIsEditing(false)` + formData 복원. 이미 올바름.

유일하게 수정이 필요한 부분은 **상단의 "뒤로 가기" 버튼**(353줄)입니다. 편집 모드에서 이 버튼을 누르면 `router.back()`으로 이전 페이지(상품 목록)로 가버립니다. 편집 모드에서는 상세 뷰로 돌아가야 합니다:

```tsx
// BEFORE (약 353줄)
      <button onClick={() => router.back()} className="py-2 px-4 rounded-lg border border-border bg-transparent text-text-secondary text-sm cursor-pointer mb-6 hover:bg-bg-tertiary transition-colors">
        ← 뒤로 가기
      </button>

// AFTER
      <button
        onClick={() => {
          if (isEditing && !isNew) {
            setIsEditing(false);
            if (product) {
              setFormData({
                branchId: product.branch_id || "",
                name: product.name || "",
                categoryId: product.category_id || "",
                description: product.description || "",
                price: product.base_price ?? product.price ?? 0,
                imageUrl: product.image_url || "",
                isActive: product.is_active ?? !product.is_hidden,
              });
              setImagePreviewUrl(product.image_url || null);
            }
          } else {
            router.back();
          }
        }}
        className="py-2 px-4 rounded-lg border border-border bg-transparent text-text-secondary text-sm cursor-pointer mb-6 hover:bg-bg-tertiary transition-colors"
      >
        ← 뒤로 가기
      </button>
```

#### 커밋 메시지
```
fix(web): product edit back button returns to detail view
```

---

### Task 6: "매장을 선택하세요" 기본 옵션 제거 (3-B)

**파일**: `apps/web/src/app/customer/categories/page.tsx`
**Batch**: 1

#### 단계

Branch Filter의 select 드롭다운에서 빈 기본 옵션 제거:

```tsx
// BEFORE (약 219~231줄)
        <select
          value={selectedBranchId}
          onChange={(e) => setSelectedBranchId(e.target.value)}
          className="input-field max-w-[400px]"
        >
          <option value="">매장을 선택하세요</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>

// AFTER
        <select
          value={selectedBranchId}
          onChange={(e) => setSelectedBranchId(e.target.value)}
          className="input-field max-w-[400px]"
        >
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
```

> **안전성**: `useEffect`에서 branches 로드 후 `data.length > 0`이면 자동으로 `setSelectedBranchId(data[0].id)`를 호출하므로 빈 값 옵션이 없어도 안전합니다.

#### 커밋 메시지
```
fix(web): remove empty branch placeholder in category page
```

---

### Task 7: 카테고리 수정 아이콘 변경 (3-D)

**파일**: `apps/web/src/app/customer/categories/page.tsx`
**Batch**: 1

#### 단계

1. `PencilIcon` import 추가:

```tsx
// BEFORE
import { Skeleton } from "@/components/ui/Skeleton";

// AFTER
import { Skeleton } from "@/components/ui/Skeleton";
import { PencilIcon } from "@/components/ui/icons";
```

2. 편집 버튼의 이모지를 SVG 아이콘으로 교체:

```tsx
// BEFORE (약 373~379줄)
                  {/* Edit */}
                  <button
                    onClick={() => { setEditingId(category.id); setEditName(category.name); }}
                    className="w-8 h-8 flex items-center justify-center rounded border border-border bg-bg-secondary text-foreground hover:bg-bg-tertiary cursor-pointer text-sm transition-colors"
                    title="이름 수정"
                  >
                    ✏
                  </button>

// AFTER
                  {/* Edit */}
                  <button
                    onClick={() => { setEditingId(category.id); setEditName(category.name); }}
                    className="w-8 h-8 flex items-center justify-center rounded border border-border bg-bg-secondary text-foreground hover:bg-bg-tertiary cursor-pointer text-sm transition-colors"
                    title="이름 수정"
                  >
                    <PencilIcon size={14} />
                  </button>
```

#### 커밋 메시지
```
refactor(web): replace pencil emoji with SVG icon in categories
```

---

### Task 8: X → "삭제" 텍스트 변경 (3-F)

**파일**: `apps/web/src/app/customer/categories/page.tsx`
**Batch**: 1

#### 단계

삭제 버튼의 X 기호를 "삭제" 텍스트로 변경하고, 버튼 크기를 텍스트에 맞게 조정:

```tsx
// BEFORE (약 395~401줄)
                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(category.id)}
                    className="w-8 h-8 flex items-center justify-center rounded border border-danger-500/30 bg-danger-500/10 text-danger-500 hover:bg-danger-500/20 cursor-pointer text-sm transition-colors"
                    title="삭제"
                  >
                    ✕
                  </button>

// AFTER
                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(category.id)}
                    className="px-2.5 py-1.5 text-xs rounded border border-danger-500/30 bg-danger-500/10 text-danger-500 hover:bg-danger-500/20 cursor-pointer font-medium transition-colors"
                    title="삭제"
                  >
                    삭제
                  </button>
```

**주요 변경 사항**:
- `w-8 h-8 flex items-center justify-center text-sm` 제거 (고정 크기 아이콘 버튼 스타일)
- `px-2.5 py-1.5 text-xs font-medium` 추가 (텍스트 버튼 스타일)
- `✕` 를 `삭제` 텍스트로 교체

#### 커밋 메시지
```
refactor(web): change category delete icon to text button
```

---

### Task 9: 주문 카드에 지점명 추가 (5-B)

**파일**: `apps/web/src/app/customer/orders/page.tsx`
**Batch**: 1

#### 단계

1. `Order` 타입에 `branchName` 필드 추가:

```tsx
// BEFORE (약 17~25줄)
type Order = {
  id: string;
  orderNo: string | null;
  customerName: string;
  totalAmount: number;
  status: OrderStatus;
  orderedAt: string;
  items?: { name: string; qty: number }[];
};

// AFTER
type Order = {
  id: string;
  orderNo: string | null;
  customerName: string;
  totalAmount: number;
  status: OrderStatus;
  orderedAt: string;
  items?: { name: string; qty: number }[];
  branchName?: string;
};
```

2. `OrderCard` 컴포넌트에서 주문번호 옆에 지점명 태그 추가:

```tsx
// BEFORE (약 143~151줄)
        {/* Order number + customer */}
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-sm font-bold text-foreground group-hover:text-primary-500 transition-colors">
            {order.orderNo ?? order.id.slice(0, 8)}
          </span>
          <span className="text-lg font-extrabold text-foreground">
            {formatWon(order.totalAmount)}
          </span>
        </div>

// AFTER
        {/* Order number + customer */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-foreground group-hover:text-primary-500 transition-colors">
              {order.orderNo ?? order.id.slice(0, 8)}
            </span>
            {order.branchName && (
              <span className="text-2xs text-text-tertiary bg-bg-tertiary px-1.5 py-0.5 rounded">
                {order.branchName}
              </span>
            )}
          </div>
          <span className="text-lg font-extrabold text-foreground">
            {formatWon(order.totalAmount)}
          </span>
        </div>
```

#### 커밋 메시지
```
feat(web): show branch name on order cards
```

---

### Task 10: 브랜드 필드 추가 (6-A)

**파일**: `apps/web/src/app/customer/brands/[brandId]/page.tsx`
**Batch**: 1

#### 단계

1. `Brand` 타입에 새 필드 추가:

```tsx
// BEFORE (약 13~23줄)
type Brand = {
  id: string;
  name: string;
  biz_name: string | null;
  biz_reg_no: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  thumbnail_url: string | null;
  myRole: string;
  created_at: string;
};

// AFTER
type Brand = {
  id: string;
  name: string;
  biz_name: string | null;
  biz_reg_no: string | null;
  rep_name: string | null;
  address: string | null;
  biz_cert_url: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  thumbnail_url: string | null;
  myRole: string;
  created_at: string;
};
```

2. `formData` 초기 상태에 새 필드 추가:

```tsx
// BEFORE (약 46~53줄)
  const [formData, setFormData] = useState({
    name: "",
    biz_name: "",
    biz_reg_no: "",
    logo_url: null as string | null,
    cover_image_url: null as string | null,
    thumbnail_url: null as string | null,
  });

// AFTER
  const [formData, setFormData] = useState({
    name: "",
    biz_name: "",
    biz_reg_no: "",
    rep_name: "",
    address: "",
    biz_cert_url: null as string | null,
    logo_url: null as string | null,
    cover_image_url: null as string | null,
    thumbnail_url: null as string | null,
  });
```

3. `loadBrand`의 `setFormData` 호출에 새 필드 추가:

```tsx
// BEFORE (약 64~71줄)
        setFormData({
          name: data.name || "",
          biz_name: data.biz_name || "",
          biz_reg_no: data.biz_reg_no || "",
          logo_url: data.logo_url || null,
          cover_image_url: data.cover_image_url || null,
          thumbnail_url: data.thumbnail_url || null,
        });

// AFTER
        setFormData({
          name: data.name || "",
          biz_name: data.biz_name || "",
          biz_reg_no: data.biz_reg_no || "",
          rep_name: data.rep_name || "",
          address: data.address || "",
          biz_cert_url: data.biz_cert_url || null,
          logo_url: data.logo_url || null,
          cover_image_url: data.cover_image_url || null,
          thumbnail_url: data.thumbnail_url || null,
        });
```

4. 편집 모드에서 사업자등록번호 입력 뒤에 새 필드 3개 추가 (약 175줄, `</div>` 바로 뒤, 이미지 업로드 grid 앞):

```tsx
// BEFORE (사업자등록번호 input div 뒤, 이미지 grid 앞)
            </div>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 mb-6">

// AFTER
            </div>

            <div className="mb-5">
              <label className="block text-[13px] text-text-secondary mb-2 font-semibold">대표자명</label>
              <input
                type="text"
                value={formData.rep_name}
                onChange={(e) => setFormData({ ...formData, rep_name: e.target.value })}
                className="input-field w-full"
                placeholder="대표자명"
              />
            </div>

            <div className="mb-5">
              <label className="block text-[13px] text-text-secondary mb-2 font-semibold">주소</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="input-field w-full"
                placeholder="사업장 주소"
              />
            </div>

            <div className="mb-5">
              <label className="block text-[13px] text-text-secondary mb-2 font-semibold">사업자등록증</label>
              <ImageUpload
                value={formData.biz_cert_url}
                onChange={(url) => setFormData({ ...formData, biz_cert_url: url })}
                folder="brands/certs"
                label="사업자등록증"
                aspectRatio="3/4"
              />
            </div>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 mb-6">
```

5. 조회 모드(view mode)에서 사업자등록번호 표시 뒤에 새 필드 표시 추가. 기존 grid (약 246~259줄) 뒤에:

```tsx
// BEFORE (기존 biz_name/biz_reg_no grid 뒤, 약 259줄)
            </div>

            {brand.thumbnail_url && (

// AFTER
            </div>

            <div className="grid grid-cols-2 gap-4 mb-5">
              {brand.rep_name && (
                <div>
                  <div className="text-[13px] text-text-secondary mb-1">대표자명</div>
                  <div className="text-[15px] text-foreground">{brand.rep_name}</div>
                </div>
              )}
              {brand.address && (
                <div>
                  <div className="text-[13px] text-text-secondary mb-1">주소</div>
                  <div className="text-[15px] text-foreground">{brand.address}</div>
                </div>
              )}
            </div>

            {brand.biz_cert_url && (
              <div className="mb-5">
                <div className="text-[13px] text-text-secondary mb-2">사업자등록증</div>
                <Image
                  src={brand.biz_cert_url}
                  alt="사업자등록증"
                  width={200}
                  height={267}
                  className="w-[200px] object-cover rounded-lg border border-border"
                  style={{ aspectRatio: "3/4" }}
                />
              </div>
            )}

            {brand.thumbnail_url && (
```

#### 커밋 메시지
```
feat(web): add representative, address, and cert fields to brand
```

---

### Task 11: 브랜드 버튼 우측 정렬 (6-B)

**파일**: `apps/web/src/app/customer/brands/[brandId]/page.tsx`
**Batch**: 1

#### 단계

저장/취소 버튼 컨테이너에 `justify-end` 추가:

```tsx
// BEFORE (약 201줄)
            <div className="flex gap-3">

// AFTER
            <div className="flex gap-3 justify-end">
```

> **주의**: 이 파일에는 `<div className="flex gap-3">`이 하나만 있으므로 정확히 하나의 위치만 변경됩니다 (편집 모드의 저장/취소 버튼 컨테이너).

#### 커밋 메시지
```
style(web): right-align brand form buttons
```

---

## Batch 2 (Phase 0 파일 의존 - Phase 0 완료 확인 후 수행)

> **주의**: 다음 작업들은 `NotificationBell.tsx`, `NotificationProvider.tsx` 파일이 존재해야 합니다. 작업 전 해당 파일 존재 여부를 확인하세요.

---

### Task 12: 알림 벨 마운트 (1-B)

**파일**: `apps/web/src/app/customer/layout.tsx`
**Batch**: 2 (Phase 0 의존)

#### 전제 조건 확인

다음 파일이 존재하는지 확인:
- `apps/web/src/components/ui/NotificationBell.tsx`
- `apps/web/src/providers/NotificationProvider.tsx`

#### 단계

1. import 추가 (Task 1의 아이콘 import 아래에):

```tsx
// BEFORE (Task 1 적용 후 기준)
import {
  HomeIcon,
  TrendIcon,
  BrandIcon,
  StoreIcon,
  ProductIcon,
  TagIcon,
  InventoryIcon,
  OrderIcon,
} from "@/components/ui/icons";

// AFTER
import {
  HomeIcon,
  TrendIcon,
  BrandIcon,
  StoreIcon,
  ProductIcon,
  TagIcon,
  InventoryIcon,
  OrderIcon,
} from "@/components/ui/icons";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { NotificationProvider } from "@/providers/NotificationProvider";
```

> **참고**: Task 1이 적용되지 않은 경우, 기존 import 블록 뒤에 추가하면 됩니다.

2. 레이아웃 전체를 `NotificationProvider`로 감싸기:

```tsx
// BEFORE (약 81줄, return문)
  return (
    <div className="md:grid md:grid-cols-[240px_1fr] min-h-screen">

// AFTER
  return (
    <NotificationProvider>
    <div className="md:grid md:grid-cols-[240px_1fr] min-h-screen">
```

그리고 return문의 맨 끝:

```tsx
// BEFORE (약 185~186줄)
    </div>
  );

// AFTER
    </div>
    </NotificationProvider>
  );
```

3. **모바일 헤더**에 NotificationBell 추가 (로고 Link와 햄버거 버튼 사이):

```tsx
// BEFORE (약 84~97줄)
      <div className="md:hidden sticky top-0 z-40 bg-bg-secondary border-b border-border px-4 py-3 flex items-center justify-between">
        <Link href="/customer" className="no-underline text-foreground font-extrabold text-base">
          🍽️ OrderFriends
        </Link>
        <button
          onClick={() => setSidebarOpen(true)}

// AFTER
      <div className="md:hidden sticky top-0 z-40 bg-bg-secondary border-b border-border px-4 py-3 flex items-center justify-between">
        <Link href="/customer" className="no-underline text-foreground font-extrabold text-base">
          🍽️ OrderFriends
        </Link>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button
            onClick={() => setSidebarOpen(true)}
```

그리고 햄버거 버튼의 닫는 태그 뒤에 div를 닫기:

```tsx
// BEFORE
          </svg>
        </button>
      </div>

// AFTER (햄버거 button 뒤에 div 닫기)
          </svg>
          </button>
        </div>
      </div>
```

4. **사이드바 로고 영역**에 NotificationBell 추가 (로고 Link와 닫기 버튼 사이):

```tsx
// BEFORE (약 117~129줄)
        <div className="p-4 border-b border-border flex items-center justify-between">
          <Link href="/customer" className="no-underline text-foreground">
            <div className="font-extrabold text-base">🍽️ OrderFriends</div>
            <div className="text-2xs text-text-tertiary mt-0.5">Customer</div>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}

// AFTER
        <div className="p-4 border-b border-border flex items-center justify-between">
          <Link href="/customer" className="no-underline text-foreground">
            <div className="font-extrabold text-base">🍽️ OrderFriends</div>
            <div className="text-2xs text-text-tertiary mt-0.5">Customer</div>
          </Link>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={() => setSidebarOpen(false)}
```

그리고 닫기 버튼 뒤에 div 닫기:

```tsx
// BEFORE
            ✕
          </button>
        </div>

// AFTER
              ✕
            </button>
          </div>
        </div>
```

#### 커밋 메시지
```
feat(web): mount notification bell in customer layout
```

---

### Task 13: 카테고리 활성화 일괄 체크박스 UI 준비

**파일**: `apps/web/src/app/customer/categories/page.tsx`
**Batch**: 2

#### 단계

1. 컴포넌트 상단에 선택 상태 추가:

```tsx
// BEFORE (약 55~56줄)
  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);

// AFTER
  // Bulk selection
  const [selectedCatIds, setSelectedCatIds] = useState<Set<string>>(new Set());

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
```

2. 카테고리 리스트 상단 (카테고리가 있을 때 표시되는 `<div className="flex flex-col gap-2">` 바로 앞)에 일괄 작업 바 추가:

```tsx
// BEFORE (약 287줄)
        <div className="flex flex-col gap-2">
          {categories.map((category, index) => (

// AFTER
        {selectedCatIds.size > 0 && (
          <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-primary-500/5 border border-primary-500/20">
            <span className="text-sm font-medium text-foreground">{selectedCatIds.size}개 선택</span>
            <button className="ml-auto text-xs px-3 py-1.5 rounded bg-success/20 text-success font-medium" onClick={() => { /* Claude Code will implement */ }}>활성화</button>
            <button className="text-xs px-3 py-1.5 rounded bg-danger-500/20 text-danger-500 font-medium" onClick={() => { /* Claude Code will implement */ }}>비활성화</button>
            <button className="text-xs px-3 py-1.5 rounded bg-bg-tertiary text-text-secondary font-medium" onClick={() => setSelectedCatIds(new Set())}>선택 해제</button>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {categories.map((category, index) => (
```

3. 각 카테고리 행의 시작 부분 (순서 번호 `<span>` 앞)에 체크박스 추가:

```tsx
// BEFORE (약 294~298줄)
            >
              {/* Order number */}
              <span className="w-8 h-8 flex items-center justify-center rounded-full bg-bg-tertiary text-sm font-bold text-text-secondary flex-shrink-0">
                {index + 1}
              </span>

// AFTER
            >
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={selectedCatIds.has(category.id)}
                onChange={() => {
                  setSelectedCatIds(prev => {
                    const next = new Set(prev);
                    if (next.has(category.id)) next.delete(category.id);
                    else next.add(category.id);
                    return next;
                  });
                }}
                className="w-4 h-4 rounded accent-primary mr-2 flex-shrink-0"
              />

              {/* Order number */}
              <span className="w-8 h-8 flex items-center justify-center rounded-full bg-bg-tertiary text-sm font-bold text-text-secondary flex-shrink-0">
                {index + 1}
              </span>
```

> **참고**: 활성화/비활성화 버튼의 `onClick` 핸들러는 placeholder로 남겨둡니다. 추후 Claude Code가 API 연동 로직을 구현할 예정입니다.

#### 커밋 메시지
```
feat(web): add category bulk selection checkboxes
```

---

## 빌드 검증

모든 작업 완료 후 빌드 성공을 확인합니다:

```bash
cd apps/web && npx next build
```

빌드 실패 시 에러 메시지를 확인하고 해당 파일을 수정합니다. 일반적인 실패 원인:
- import 경로 오류 (대소문자, 경로 확인)
- 타입 불일치 (TypeScript 컴파일 에러)
- JSX 닫는 태그 누락

---

## 작업 순서 요약

| Batch | Task | 파일 | 설명 |
|-------|------|------|------|
| 1 | Task 1 | `customer/layout.tsx` | 이모지 -> SVG 아이콘 |
| 1 | Task 2 | `customer/products/page.tsx` | 상품 검색 |
| 1 | Task 3 | `customer/products/[productId]/page.tsx` | 활성화 드롭다운 |
| 1 | Task 4 | `customer/products/page.tsx` | 카테고리 필터 |
| 1 | Task 5 | `customer/products/[productId]/page.tsx` | 뒤로가기 수정 |
| 1 | Task 6 | `customer/categories/page.tsx` | 빈 옵션 제거 |
| 1 | Task 7 | `customer/categories/page.tsx` | 수정 아이콘 변경 |
| 1 | Task 8 | `customer/categories/page.tsx` | 삭제 텍스트 버튼 |
| 1 | Task 9 | `customer/orders/page.tsx` | 지점명 표시 |
| 1 | Task 10 | `customer/brands/[brandId]/page.tsx` | 브랜드 필드 추가 |
| 1 | Task 11 | `customer/brands/[brandId]/page.tsx` | 버튼 우측 정렬 |
| 2 | Task 12 | `customer/layout.tsx` | 알림 벨 마운트 |
| 2 | Task 13 | `customer/categories/page.tsx` | 일괄 체크박스 |

**Batch 1**: 서로 독립적이므로 병렬 수행 가능. 단, 같은 파일을 수정하는 Task끼리는 충돌 방지를 위해 순서대로 수행 권장:
- `layout.tsx`: Task 1 -> Task 12 (Batch 2)
- `products/page.tsx`: Task 2 -> Task 4
- `products/[productId]/page.tsx`: Task 3 -> Task 5
- `categories/page.tsx`: Task 6 -> Task 7 -> Task 8 -> Task 13 (Batch 2)
- `orders/page.tsx`: Task 9 (단독)
- `brands/[brandId]/page.tsx`: Task 10 -> Task 11

**Batch 2**: Phase 0 파일(`NotificationBell.tsx`, `NotificationProvider.tsx`)이 존재해야 합니다.
