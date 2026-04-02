# 프로젝트 현황 분석 및 개선 방향

**작성일:** 2026-02-06
**브랜치:** feature/phase8-9-analytics-advanced
**최종 커밋:** cd1abb5

---

## 📊 프로젝트 현황 요약

### 구현 완료된 주요 기능 (Phase 1-9)

#### ✅ Phase 1-3: 기반 인프라
- [x] NestJS 백엔드 구조
- [x] Supabase 통합 (Auth, Database)
- [x] 브랜드/지점/상품/주문 CRUD
- [x] 페이지네이션 및 캐싱
- [x] 전역 에러 처리
- [x] Throttling (Rate Limiting)

#### ✅ Phase 4: 고객 대시보드
- [x] 고객용 브랜드/지점 조회
- [x] 고객용 상품 카탈로그
- [x] 고객용 주문 내역
- [x] Next.js 15 프론트엔드

#### ✅ Phase 5: 재고 관리
- [x] 재고 추적 시스템
- [x] 주문-재고 연동
- [x] 재고 부족 알림 트리거
- [x] 재고 복원 로직 (주문 취소)

#### ✅ Phase 6: 결제 시스템
- [x] 토스페이먼츠 통합
- [x] 결제 승인/취소 플로우
- [x] 가상계좌 처리
- [x] Webhook 처리

#### ✅ Phase 7: 알림 시스템
- [x] 알림 모듈 기초 구조
- [x] 실시간 알림 아키텍처 설계
- [x] PostgreSQL 트리거 예시
- [x] React Hook 예시

#### ✅ Phase 8-9: 고급 기능
- [x] 검색 및 필터링 시스템
- [x] 이미지 업로드 (Supabase Storage)
- [x] 사용자별 Rate Limiting
- [x] Sentry 모니터링
- [x] Tailwind CSS 통합
- [x] 테스트 커버리지 확장

---

## 🎯 프로젝트 강점

### 1. 탄탄한 백엔드 아키텍처
```
✅ NestJS 모듈화 구조
✅ Dependency Injection 활용
✅ Guard/Interceptor 패턴
✅ DTO 기반 데이터 검증
✅ 중앙 집중식 에러 처리
```

### 2. 완성도 높은 비즈니스 로직
- **재고-주문 연동**: 주문 생성 시 재고 예약, 취소 시 복원
- **결제 통합**: 토스페이먼츠 전체 플로우 구현
- **권한 관리**: RBAC (Role-Based Access Control)
- **멀티 테넌시**: 브랜드별 데이터 분리

### 3. 현대적인 기술 스택
- **Backend**: NestJS 11 + TypeScript 5.7
- **Frontend**: Next.js 15 + React 19 + Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Payment**: 토스페이먼츠
- **Monitoring**: Sentry
- **Testing**: Jest

### 4. 개발자 경험 (DX)
- 타입 안전성 (TypeScript)
- 명확한 폴더 구조
- 일관된 네이밍 컨벤션
- 포괄적인 문서화

---

## ⚠️ 부족한 점 및 개선 필요 사항

### 1. 테스트 커버리지 부족 ⚠️⚠️⚠️

**현재 상태:**
```
전체 테스트: 76개
테스트 실패: 11개
평균 커버리지: ~40%
```

**문제점:**
- 대부분의 Controller 테스트 없음 (0% 커버리지)
- Payment 모듈 완전히 미테스트 (812줄)
- Public 모듈 미테스트 (322줄)
- Analytics 모듈 미테스트
- Customer 관련 모듈 미테스트

**실패 중인 테스트:**
```typescript
// products.service.spec.ts - Mock 설정 오류
TypeError: sb.from(...).delete(...).eq is not a function

// public-order.service.spec.ts - 의존성 주입 오류
Nest can't resolve dependencies of the PublicOrderService

// orders.service.spec.ts - Mock 메서드 누락
TypeError: sb.from(...).select(...).eq(...).order(...).range is not a function
```

**개선 방안:**
```
1. 모든 Service 단위 테스트 작성 (우선순위: 높음)
2. Controller 통합 테스트 작성 (우선순위: 중간)
3. E2E 테스트 작성 (우선순위: 중간)
4. Mock 객체 표준화 (우선순위: 높음)
5. 테스트 유틸리티 함수 작성
6. CI에서 테스트 커버리지 80% 이상 강제
```

### 2. 보안 취약점 ⚠️⚠️

**현재 문제:**
- [ ] SQL Injection 방어: Supabase는 자동 방어하지만 raw query 검증 필요
- [ ] XSS 방어: 프론트엔드에서 입력값 살균 부족
- [ ] CSRF 토큰: 구현 안됨
- [ ] Rate Limiting: 엔드포인트별로 적용 안됨 (전역만)
- [ ] 파일 업로드: 파일 내용 검증 부족 (MIME 타입만 확인)
- [ ] 민감 정보: 로그에 토큰/비밀번호 노출 가능성

**개선 방안:**
```typescript
// 1. Input Sanitization
import { sanitizeHtml } from 'sanitize-html';

@Post('create')
async create(@Body() dto: CreateDto) {
  dto.description = sanitizeHtml(dto.description);
}

// 2. Rate Limiting per endpoint
@Post('login')
@UserRateLimit({ points: 5, duration: 300 }) // 5분에 5번
async login() {}

@Post('order')
@UserRateLimit({ points: 20, duration: 60 }) // 1분에 20번
async createOrder() {}

// 3. File content validation
import * as FileType from 'file-type';

async validateFile(buffer: Buffer) {
  const type = await FileType.fromBuffer(buffer);
  if (!ALLOWED_TYPES.includes(type?.mime)) {
    throw new BadRequestException('Invalid file type');
  }
}

// 4. Sensitive data filtering
const logger = new Logger({
  redact: ['password', 'token', 'secret', 'api_key']
});
```

### 3. 성능 최적화 필요 ⚠️

**현재 문제:**
- [ ] N+1 쿼리 문제 (주문 조회 시 상품 정보 반복 조회)
- [ ] 캐싱 전략 부족 (5분 TTL만, 무효화 로직 없음)
- [ ] DB 인덱스 누락 가능성
- [ ] 이미지 최적화 없음 (원본 그대로 업로드)
- [ ] 프론트엔드 번들 사이즈 최적화 안됨

**개선 방안:**
```sql
-- 1. 인덱스 추가
CREATE INDEX idx_orders_branch_status ON orders(branch_id, status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_products_branch_category ON products(branch_id, category_id);
CREATE INDEX idx_inventory_product_branch ON product_inventory(product_id, branch_id);

-- 2. 복합 쿼리 최적화
SELECT
  o.*,
  json_agg(
    json_build_object(
      'product_id', oi.product_id,
      'product_name', p.name,
      'qty', oi.qty,
      'price', oi.unit_price
    )
  ) as items
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
LEFT JOIN products p ON oi.product_id = p.id
WHERE o.branch_id = $1
GROUP BY o.id;
```

```typescript
// 3. Redis 캐싱 전략
class CacheService {
  // 상품 목록 캐싱
  async getProducts(branchId: string) {
    const key = `products:${branchId}`;
    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached);

    const products = await this.db.getProducts(branchId);
    await this.redis.setex(key, 300, JSON.stringify(products));
    return products;
  }

  // 캐시 무효화
  async invalidateProductCache(branchId: string) {
    await this.redis.del(`products:${branchId}`);
  }
}

// 4. 이미지 최적화
import sharp from 'sharp';

async optimizeImage(buffer: Buffer) {
  return await sharp(buffer)
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}
```

### 4. 에러 처리 및 로깅 ⚠️

**현재 문제:**
- [ ] 에러 메시지가 일관성 없음
- [ ] 스택 트레이스가 프로덕션에 노출됨
- [ ] 로그 레벨 관리 부족
- [ ] 요청 추적 ID 없음 (distributed tracing)
- [ ] 에러 알림 설정 안됨

**개선 방안:**
```typescript
// 1. 일관된 에러 응답
class ErrorResponse {
  statusCode: number;
  message: string;
  errorCode: string; // PRODUCT_NOT_FOUND, ORDER_INVALID, etc.
  timestamp: string;
  path: string;
  requestId: string;
  details?: any; // 개발 환경에서만
}

// 2. Request ID 추적
@Injectable()
class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    request.id = uuid();
    return next.handle();
  }
}

// 3. Sentry 알림 설정
Sentry.init({
  beforeSend(event) {
    // 프로덕션에서만 전송
    if (process.env.NODE_ENV !== 'production') return null;
    // 민감 정보 제거
    delete event.request?.cookies;
    return event;
  },
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
  ],
});
```

### 5. 실시간 기능 미구현 ⚠️

**현재 상태:**
- [x] 알림 시스템 아키텍처 설계됨
- [x] PostgreSQL 트리거 예시 작성됨
- [x] React Hook 예시 작성됨
- [ ] **실제 구현 안됨**

**필요한 작업:**
```typescript
// 1. Notifications Module 완전 구현
@Module({
  imports: [SupabaseModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}

// 2. Realtime Subscription
class NotificationsService {
  async subscribeToNotifications(userId: string) {
    return this.supabase
      .channel(`notifications:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        // WebSocket으로 클라이언트에 푸시
      })
      .subscribe();
  }
}

// 3. 프론트엔드 실시간 연결
function useRealtimeNotifications() {
  useEffect(() => {
    const channel = supabase.channel('notifications')
      .on('postgres_changes', { /* ... */ }, (payload) => {
        setNotifications(prev => [payload.new, ...prev]);

        // Toast 알림
        toast.success(payload.new.title);

        // 브라우저 알림
        if (Notification.permission === 'granted') {
          new Notification(payload.new.title);
        }
      })
      .subscribe();

    return () => channel.unsubscribe();
  }, []);
}
```

### 6. CI/CD 파이프라인 부족 ⚠️

**현재 상태:**
- [ ] GitHub Actions 워크플로우 없음
- [ ] 자동 테스트 실행 안됨
- [ ] 자동 배포 설정 안됨
- [ ] 코드 품질 검사 없음
- [ ] Docker 이미지 빌드 자동화 안됨

**개선 방안:**
```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run tests
        run: npm test -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3

      - name: Check coverage threshold
        run: |
          coverage=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          if (( $(echo "$coverage < 80" | bc -l) )); then
            echo "Coverage $coverage% is below 80%"
            exit 1
          fi

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build Docker image
        run: docker build -t order-friends:${{ github.sha }} .

      - name: Push to registry
        run: docker push order-friends:${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to production
        run: |
          # Deploy script
```

### 7. 문서화 부족 ⚠️

**현재 상태:**
- [x] Phase 8-9 개선사항 문서
- [x] Rate Limiting 가이드
- [x] Sentry 설정 가이드
- [x] 실시간 알림 아키텍처
- [ ] API 문서 자동 생성 안됨
- [ ] 개발 가이드 부족
- [ ] 배포 가이드 부족
- [ ] 트러블슈팅 가이드 없음

**개선 방안:**
```typescript
// 1. Swagger/OpenAPI 통합
@Controller('products')
@ApiTags('Products')
export class ProductsController {
  @Get(':id')
  @ApiOperation({ summary: '상품 상세 조회' })
  @ApiParam({ name: 'id', description: '상품 ID' })
  @ApiResponse({ status: 200, type: ProductDetailResponse })
  @ApiResponse({ status: 404, description: '상품을 찾을 수 없음' })
  async getProduct(@Param('id') id: string) {
    // ...
  }
}

// main.ts
const config = new DocumentBuilder()
  .setTitle('Order Friends API')
  .setDescription('주문 관리 시스템 API')
  .setVersion('1.0')
  .addBearerAuth()
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api-docs', app, document);
```

### 8. 프론트엔드 미완성 ⚠️

**현재 상태:**
- [x] Tailwind CSS 통합
- [x] 기본 UI 컴포넌트 (Button, Card, Badge)
- [x] 관리자 페이지 일부
- [x] 고객 대시보드 일부
- [ ] 알림 UI 미구현
- [ ] 결제 UI 미완성
- [ ] 재고 관리 UI 부족
- [ ] 반응형 디자인 미흡
- [ ] 로딩/에러 상태 처리 부족

**개선 방안:**
```typescript
// 1. Loading/Error 상태 관리
function ProductList() {
  const { data, isLoading, error } = useProducts();

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorMessage error={error} />;

  return <ProductGrid products={data} />;
}

// 2. 재사용 가능한 컴포넌트
const DataTable = <T,>({
  data,
  columns,
  onSort,
  onFilter,
  pagination
}: DataTableProps<T>) => {
  // ...
};

// 3. 폼 검증
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({
  name: z.string().min(1, '상품명은 필수입니다'),
  price: z.number().min(0, '가격은 0 이상이어야 합니다'),
});

function ProductForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name')} />
      {errors.name && <span>{errors.name.message}</span>}
    </form>
  );
}
```

---

## 🚀 우선순위별 개선 계획

### Priority 1 (즉시 수정 필요) 🔴

1. **테스트 실패 수정** (1-2일)
   - products.service.spec.ts Mock 수정
   - public-order.service.spec.ts 의존성 주입 수정
   - orders.service.spec.ts Mock 메서드 추가

2. **보안 강화** (3-5일)
   - 엔드포인트별 Rate Limiting 적용
   - Input Sanitization 추가
   - 파일 내용 검증 강화
   - 민감 정보 로그 필터링

3. **핵심 모듈 테스트 작성** (1주)
   - PaymentsService 테스트 (최우선)
   - PublicService 테스트
   - OrdersController 테스트
   - ProductsController 테스트

### Priority 2 (단기 개선) 🟡

4. **성능 최적화** (1-2주)
   - DB 인덱스 추가
   - N+1 쿼리 해결
   - Redis 캐싱 전략 구현
   - 이미지 최적화

5. **실시간 알림 완성** (1주)
   - NotificationsController/Service 구현
   - Realtime Subscription 설정
   - 프론트엔드 통합
   - 브라우저 알림 권한 처리

6. **CI/CD 구축** (3-5일)
   - GitHub Actions 워크플로우
   - 자동 테스트 실행
   - 코드 품질 검사
   - Docker 빌드 자동화

### Priority 3 (중기 개선) 🟢

7. **API 문서화** (2-3일)
   - Swagger/OpenAPI 통합
   - 모든 엔드포인트 문서화
   - 예시 요청/응답 추가

8. **프론트엔드 완성** (2-3주)
   - 알림 UI 구현
   - 결제 UI 완성
   - 재고 관리 UI 개선
   - 반응형 디자인 적용

9. **에러 처리 개선** (1주)
   - 일관된 에러 응답 포맷
   - Request ID 추적
   - Sentry 알림 설정
   - 에러 페이지 개선

### Priority 4 (장기 개선) 🔵

10. **고급 기능** (필요시)
    - Elasticsearch 통합
    - WebSocket 실시간 통신
    - 푸시 알림 (FCM)
    - 이메일 알림
    - SMS 알림
    - 대시보드 분석

---

## 📈 개선 후 기대 효과

### 안정성
- ✅ 테스트 커버리지 80% 이상
- ✅ 프로덕션 에러율 1% 이하
- ✅ 자동화된 품질 검사

### 보안
- ✅ OWASP Top 10 방어
- ✅ 입력값 검증 및 살균
- ✅ Rate Limiting 적용

### 성능
- ✅ 응답 시간 200ms 이하 (평균)
- ✅ 동시 사용자 1000명 처리
- ✅ 이미지 로딩 속도 50% 개선

### 개발 생산성
- ✅ CI/CD 파이프라인으로 배포 시간 90% 단축
- ✅ API 문서 자동화로 커뮤니케이션 비용 감소
- ✅ 테스트 자동화로 버그 조기 발견

---

## 🎯 결론

### 현재 프로젝트 상태: **B+ (80/100)**

**강점:**
- ✅ 탄탄한 백엔드 아키텍처
- ✅ 핵심 비즈니스 로직 완성
- ✅ 현대적인 기술 스택
- ✅ 모듈화된 구조

**약점:**
- ⚠️ 테스트 커버리지 부족 (40%)
- ⚠️ 보안 취약점 존재
- ⚠️ 성능 최적화 미흡
- ⚠️ 실시간 기능 미완성
- ⚠️ CI/CD 미구축

### 권장 사항

1. **즉시 조치 (1-2주)**
   - 실패 중인 테스트 수정
   - 보안 강화 (Rate Limiting, Input Sanitization)
   - 핵심 모듈 테스트 작성

2. **단기 목표 (1개월)**
   - 테스트 커버리지 80% 달성
   - 실시간 알림 완성
   - CI/CD 파이프라인 구축
   - 성능 최적화

3. **중기 목표 (2-3개월)**
   - 프론트엔드 완성
   - API 문서화
   - 프로덕션 배포 준비

이 개선 사항들을 순차적으로 진행하면, 프로젝트는 **A+ (95/100)** 수준의 프로덕션 레디 상태가 될 것입니다.

---

**다음 단계:** [Priority 1 작업부터 시작하세요](#priority-1-즉시-수정-필요-)
