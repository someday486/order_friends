# Order Friends - 실전 개선 로드맵

## 📋 목차
1. [이번 세션에서 완료된 작업](#완료된-작업)
2. [즉시 적용 가능한 개선사항](#즉시-적용-가능)
3. [단계별 개선 로드맵](#단계별-로드맵)
4. [구체적인 구현 가이드](#구현-가이드)

---

## ✅ 완료된 작업

### 1. 주문-재고 연동 시스템 (Critical ⭐⭐⭐)
**파일:** `src/modules/public-order/public-order.service.ts`, `src/modules/orders/orders.service.ts`

**구현 내용:**
- ✅ 주문 생성 전 재고 확인
- ✅ 주문 생성 시 재고 예약 (qty_reserved 증가)
- ✅ 주문 취소 시 재고 복구 (qty_available 복구)
- ✅ 모든 재고 변동 이력 로깅 (inventory_logs)
- ✅ 재고 부족 시 명확한 에러 메시지

**Before:**
```typescript
async createOrder(dto) {
  // 주문만 생성
  return order;
}
```

**After:**
```typescript
async createOrder(dto) {
  // 1. 재고 확인
  if (inventory.qty_available < item.qty) {
    throw new BadRequestException('재고 부족');
  }

  // 2. 주문 생성
  const order = await this.createOrder(...);

  // 3. 재고 예약
  await this.reserveInventory(items, order.id);

  // 4. 로그 기록
  await this.logInventoryTransaction(...);

  return order;
}
```

**비즈니스 플로우:**
1. 고객 주문 → 재고 예약 (qty_reserved++)
2. 결제 완료 → 재고 판매 (qty_sold++, qty_reserved--)
3. 주문 취소 → 재고 복구 (qty_available++, qty_reserved--)

---

## 🚀 즉시 적용 가능한 개선사항

### 1. 프론트엔드 UI 프레임워크 도입 (High Priority)

#### Tailwind CSS 설정 (15분 소요)

**Step 1: 설치**
```bash
cd apps/web
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

**Step 2: tailwind.config.js 설정**
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#000',
        surface: '#0a0a0a',
        border: '#222',
      },
    },
  },
  plugins: [],
}
```

**Step 3: globals.css에 추가**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 4: 기존 페이지 리팩토링 예시**
```tsx
// Before (인라인 스타일)
<div style={{
  padding: 20,
  borderRadius: 14,
  border: "1px solid #222",
  background: "#0f0f0f"
}}>

// After (Tailwind)
<div className="p-5 rounded-2xl border border-gray-800 bg-gray-950">
```

**즉시 적용 가능한 패턴:**
```tsx
// 버튼 컴포넌트
const Button = ({ children, variant = 'primary' }) => (
  <button className={`
    px-4 py-2 rounded-lg font-semibold transition-all
    ${variant === 'primary' ? 'bg-white text-black hover:bg-gray-200' : ''}
    ${variant === 'secondary' ? 'bg-gray-800 text-white border border-gray-700' : ''}
  `}>
    {children}
  </button>
);

// 카드 컴포넌트
const Card = ({ children, hover = true }) => (
  <div className={`
    p-6 rounded-xl border border-gray-800 bg-gray-950
    ${hover ? 'hover:border-gray-700 transition-all' : ''}
  `}>
    {children}
  </div>
);
```

---

### 2. 핵심 기능 테스트 작성 (30분 소요)

#### 주문-재고 통합 테스트 예시

**파일:** `src/modules/public-order/public-order.service.spec.ts`

```typescript
import { Test } from '@nestjs/testing';
import { PublicOrderService } from './public-order.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';

describe('PublicOrderService - Inventory Integration', () => {
  let service: PublicOrderService;
  let supabaseMock: any;

  beforeEach(async () => {
    supabaseMock = {
      anonClient: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
      }),
      adminClient: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        PublicOrderService,
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: 'INVENTORY_SERVICE', useValue: {} },
      ],
    }).compile();

    service = module.get<PublicOrderService>(PublicOrderService);
  });

  describe('createOrder', () => {
    it('should reserve inventory when order is created', async () => {
      // Arrange
      const orderDto = {
        branchId: 'branch-1',
        customerName: 'Test Customer',
        items: [{ productId: 'product-1', qty: 5 }],
      };

      const mockProduct = {
        id: 'product-1',
        name: 'Test Product',
        branch_id: 'branch-1',
        price: 10000,
      };

      const mockInventory = {
        product_id: 'product-1',
        qty_available: 100,
        qty_reserved: 0,
      };

      // Setup mocks
      supabaseMock.anonClient().from().select().in.mockResolvedValueOnce({
        data: [mockProduct],
        error: null,
      });

      supabaseMock.adminClient().from().select().in().eq.mockResolvedValueOnce({
        data: [mockInventory],
        error: null,
      });

      supabaseMock.anonClient().from().insert().select().single.mockResolvedValueOnce({
        data: { id: 'order-1', order_no: 'ORD-001', status: 'CREATED' },
        error: null,
      });

      // Act
      const result = await service.createOrder(orderDto);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe('order-1');

      // Verify inventory was updated
      expect(supabaseMock.adminClient().from).toHaveBeenCalledWith('product_inventory');
      expect(supabaseMock.adminClient().update).toHaveBeenCalledWith({
        qty_available: 95, // 100 - 5
        qty_reserved: 5,    // 0 + 5
      });

      // Verify log was created
      expect(supabaseMock.adminClient().from).toHaveBeenCalledWith('inventory_logs');
    });

    it('should throw error when insufficient inventory', async () => {
      // Arrange
      const orderDto = {
        branchId: 'branch-1',
        customerName: 'Test Customer',
        items: [{ productId: 'product-1', qty: 150 }],
      };

      const mockInventory = {
        product_id: 'product-1',
        qty_available: 100, // Not enough!
        qty_reserved: 0,
      };

      // Setup mocks
      supabaseMock.adminClient().from().select().in().eq.mockResolvedValueOnce({
        data: [mockInventory],
        error: null,
      });

      // Act & Assert
      await expect(service.createOrder(orderDto)).rejects.toThrow('재고가 부족합니다');
    });
  });

  describe('Order Cancellation', () => {
    it('should release inventory when order is cancelled', async () => {
      // 주문 취소 시 재고 복구 테스트
      // 구현 생략
    });
  });
});
```

**실행:**
```bash
npm test -- public-order.service.spec.ts
```

---

### 3. 보안 강화 (20분 소요)

#### A. 사용자별 Rate Limiting

**파일:** `src/common/guards/user-rate-limit.guard.ts`

```typescript
import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class UserRateLimitGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Use user ID if authenticated, otherwise use IP
    const userId = req.user?.id;
    if (userId) {
      return `user-${userId}`;
    }
    return req.ip;
  }
}
```

**적용:**
```typescript
// app.module.ts
{
  provide: APP_GUARD,
  useClass: UserRateLimitGuard, // ThrottlerGuard 대신 사용
}
```

#### B. Admin 역할 DB 관리

**마이그레이션:** `supabase/migrations/20260206_admin_roles.sql`

```sql
-- Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'ADMIN' CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'SUPPORT')),
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Super admins can manage admin users
CREATE POLICY "Super admins can manage admin users"
  ON admin_users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
      AND au.role = 'SUPER_ADMIN'
      AND au.is_active = true
    )
  );

-- Create function to check admin status
CREATE OR REPLACE FUNCTION is_admin(user_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = user_id_param
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**AdminGuard 업데이트:**
```typescript
// src/common/guards/admin.guard.ts
async canActivate(context: ExecutionContext): Promise<boolean> {
  const request = context.switchToHttp().getRequest<AuthRequest>();
  const { user } = request;

  if (!user) {
    throw new UnauthorizedException('Authentication required');
  }

  // Check DB instead of email
  const { data } = await this.supabase.adminClient()
    .rpc('is_admin', { user_id_param: user.id });

  if (!data) {
    throw new UnauthorizedException('Admin access required');
  }

  request.isAdmin = true;
  return true;
}
```

---

## 📈 단계별 개선 로드맵

### Phase 1: 기반 강화 (1주)
**목표:** 안정성 및 개발 경험 개선

- [ ] **Day 1-2: 테스트 인프라**
  - 핵심 비즈니스 로직 테스트 작성 (주문, 재고, 결제)
  - Guard 테스트
  - 목표: 60% 코드 커버리지

- [ ] **Day 3-4: 프론트엔드 개선**
  - Tailwind CSS 설정
  - 공통 컴포넌트 라이브러리 구축 (Button, Card, Input, Modal)
  - 최소 2개 페이지 리팩토링 (Dashboard, Orders)

- [ ] **Day 5-7: 개발 도구**
  - ESLint + Prettier 설정 및 적용
  - Pre-commit hooks (Husky)
  - API 응답 포맷 표준화

### Phase 2: 기능 완성 (2주)
**목표:** 프로덕션 필수 기능 구현

- [ ] **Week 1: 이미지 & 검색**
  - Supabase Storage 연동
  - 상품 이미지 업로드/관리
  - 전체 검색 기능 (상품, 주문, 고객)
  - 고급 필터링 (날짜, 상태, 가격대)

- [ ] **Week 2: 알림 & 리포트**
  - 실시간 알림 (WebSocket or Server-Sent Events)
  - 이메일 템플릿 개선
  - SMS 실제 연동
  - 데이터 내보내기 (CSV, PDF)

### Phase 3: 성능 & 운영 (1주)
**목표:** 확장성 및 모니터링 구축

- [ ] **Performance**
  - 쿼리 최적화 (N+1 문제 해결)
  - Redis 캐싱 활성화
  - 이미지 CDN & 최적화
  - Database 인덱싱 재검토

- [ ] **Monitoring**
  - Sentry 설정 및 에러 추적
  - Winston/Pino 로거 도입
  - 헬스체크 엔드포인트 강화
  - 성능 메트릭 수집

### Phase 4: 고급 기능 (2-3주)
**목표:** 경쟁력 강화

- [ ] **비즈니스 기능**
  - 쿠폰/프로모션 시스템
  - 고객 리뷰 및 평점
  - 위시리스트
  - 반복 주문 (재주문)

- [ ] **관리 기능**
  - 대량 작업 (Bulk operations)
  - 고급 리포팅
  - 재고 예측 (AI/ML)
  - 멀티 언어 지원

---

## 🛠️ 구현 가이드

### 1. 검색 기능 구현

#### Backend API
```typescript
// src/modules/products/products.controller.ts
@Get('search')
@ApiQuery({ name: 'q', description: '검색어' })
@ApiQuery({ name: 'category', required: false })
@ApiQuery({ name: 'minPrice', required: false })
@ApiQuery({ name: 'maxPrice', required: false })
async searchProducts(
  @Query('q') query: string,
  @Query('category') category?: string,
  @Query('minPrice') minPrice?: number,
  @Query('maxPrice') maxPrice?: number,
  @Query() pagination?: PaginationDto,
) {
  return this.productsService.search({
    query,
    category,
    minPrice,
    maxPrice,
    pagination,
  });
}
```

#### Service 구현
```typescript
async search(params: SearchParams): Promise<PaginatedResponse<Product>> {
  const sb = this.supabase.adminClient();

  let query = sb
    .from('products')
    .select('*, branches(name), brands(name)', { count: 'exact' });

  // Text search
  if (params.query) {
    query = query.or(`name.ilike.%${params.query}%,description.ilike.%${params.query}%`);
  }

  // Category filter
  if (params.category) {
    query = query.eq('category', params.category);
  }

  // Price range
  if (params.minPrice) {
    query = query.gte('price', params.minPrice);
  }
  if (params.maxPrice) {
    query = query.lte('price', params.maxPrice);
  }

  // Pagination
  const { page = 1, limit = 20 } = params.pagination || {};
  const { data, error, count } = await query
    .range((page - 1) * limit, page * limit - 1);

  if (error) throw new BusinessException('Search failed');

  return {
    data: data || [],
    pagination: new PaginationMeta(page, limit, count || 0),
  };
}
```

#### Frontend 컴포넌트
```tsx
// components/ProductSearch.tsx
export function ProductSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = useDe bounced(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.data);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  }, 300);

  return (
    <div>
      <input
        type="search"
        placeholder="상품 검색..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          handleSearch(e.target.value);
        }}
        className="w-full px-4 py-2 rounded-lg border border-gray-700 bg-gray-900"
      />

      {loading && <div>검색 중...</div>}

      <div className="mt-4 grid grid-cols-3 gap-4">
        {results.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
```

---

### 2. 이미지 업로드 (Supabase Storage)

#### Storage Bucket 생성
```sql
-- Supabase Dashboard에서 실행하거나 Migration으로
-- Storage > New Bucket > product-images (public)
```

#### Upload API
```typescript
// src/modules/products/products.controller.ts
@Post(':productId/image')
@UseInterceptors(FileInterceptor('file'))
async uploadImage(
  @Param('productId') productId: string,
  @UploadedFile() file: Express.Multer.File,
) {
  // Validate file
  if (!file) {
    throw new BadRequestException('No file provided');
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.mimetype)) {
    throw new BadRequestException('Invalid file type');
  }

  if (file.size > 5 * 1024 * 1024) { // 5MB
    throw new BadRequestException('File too large');
  }

  return this.productsService.uploadImage(productId, file);
}
```

#### Service 구현
```typescript
async uploadImage(productId: string, file: Express.Multer.File) {
  const sb = this.supabase.adminClient();

  // Generate unique filename
  const ext = file.originalname.split('.').pop();
  const filename = `${productId}-${Date.now()}.${ext}`;

  // Upload to Supabase Storage
  const { data, error } = await sb.storage
    .from('product-images')
    .upload(filename, file.buffer, {
      contentType: file.mimetype,
      cacheControl: '3600',
    });

  if (error) {
    throw new BusinessException('Failed to upload image');
  }

  // Get public URL
  const { data: { publicUrl } } = sb.storage
    .from('product-images')
    .getPublicUrl(filename);

  // Update product record
  await sb
    .from('products')
    .update({ image_url: publicUrl })
    .eq('id', productId);

  return { url: publicUrl };
}
```

#### Frontend 업로드 컴포넌트
```tsx
function ImageUpload({ productId, onSuccess }: Props) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      const res = await fetch(`/api/products/${productId}/image`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      onSuccess(data.url);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={handleUpload}
        disabled={uploading}
        className="hidden"
        id="image-upload"
      />
      <label
        htmlFor="image-upload"
        className="cursor-pointer px-4 py-2 bg-white text-black rounded-lg"
      >
        {uploading ? '업로드 중...' : '이미지 선택'}
      </label>
    </div>
  );
}
```

---

### 3. 실시간 알림 (Server-Sent Events)

#### Backend SSE 구현
```typescript
// src/modules/notifications/notifications.controller.ts
import { Controller, Sse, Req } from '@nestjs/common';
import { Observable, interval } from 'rxjs';
import { map } from 'rxjs/operators';

@Controller('notifications')
export class NotificationsController {
  @Sse('stream')
  streamNotifications(@Req() req: AuthRequest): Observable<MessageEvent> {
    const userId = req.user.id;

    // Poll for new notifications every 30 seconds
    return interval(30000).pipe(
      map(() => ({
        data: {
          type: 'notification',
          message: 'New order received!',
          timestamp: new Date().toISOString(),
        },
      })),
    );
  }
}
```

#### Frontend SSE 구독
```tsx
function useNotifications() {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const eventSource = new EventSource('/api/notifications/stream');

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setNotifications(prev => [data, ...prev].slice(0, 10));

      // Show toast
      toast.success(data.message);
    };

    eventSource.onerror = () => {
      console.error('SSE connection error');
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return notifications;
}
```

---

## 📊 체크리스트

### 즉시 개선 (이번 주)
- [x] 주문-재고 연동 완성
- [ ] Tailwind CSS 설정
- [ ] 최소 1개 페이지 리팩토링
- [ ] 주문/재고 테스트 작성
- [ ] ESLint/Prettier 설정
- [ ] Admin DB 관리로 전환

### 프로덕션 준비 (2주 내)
- [ ] 이미지 업로드 구현
- [ ] 검색 기능 구현
- [ ] 전체 필터링 강화
- [ ] Sentry 설정
- [ ] Redis 캐싱 활성화
- [ ] 성능 테스트

### 장기 개선 (1개월 내)
- [ ] 쿠폰/프로모션
- [ ] 고객 리뷰
- [ ] 실시간 알림
- [ ] 데이터 내보내기
- [ ] 고급 분석
- [ ] 모바일 최적화

---

## 🎯 핵심 권장사항

### 1. 우선순위 집중
- ❌ 모든 것을 한 번에 하려고 하지 말 것
- ✅ 한 번에 1-2개 기능만 완벽하게 구현

### 2. 테스트 먼저
- 새 기능 추가 시 테스트 먼저 작성 (TDD)
- 최소 핵심 비즈니스 로직은 반드시 테스트

### 3. 문서화
- 새 API는 Swagger 문서 작성
- 복잡한 로직은 주석 추가
- README에 설정 방법 기록

### 4. 코드 리뷰
- 큰 변경사항은 PR로 관리
- 최소 1명 리뷰 후 merge
- 커밋 메시지 규칙 준수

### 5. 모니터링
- 프로덕션 배포 전 Sentry 필수
- 주요 API 응답 시간 모니터링
- 에러율 추적

---

## 📚 참고 자료

### 문서
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)

### 도구
- [Sentry](https://sentry.io)
- [Redis](https://redis.io)
- [Prettier](https://prettier.io)
- [ESLint](https://eslint.org)

---

**마지막 업데이트:** 2026-02-06
**작성자:** Claude Sonnet 4.5
**프로젝트 상태:** 70/100 → 목표 90/100
