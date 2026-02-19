# Order Friends

브랜드/지점 기반 주문 운영 플랫폼입니다.  
백엔드(NestJS)와 프론트엔드(Next.js)가 같은 저장소에 있습니다.

## 구성
- Backend API: `src/` (NestJS 11)
- Web App: `apps/web/` (Next.js 16)
- Database migrations/seeds: `supabase/`

## 사전 요구사항
- Node.js 20+
- npm
- Supabase 프로젝트 (로컬 또는 원격)

## 설치
```bash
npm ci
npm ci --prefix apps/web
```

## 환경 변수
### Backend
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TOSS_SECRET_KEY` (선택)
- `TOSS_CLIENT_KEY` (선택)

### Web
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_BASE_URL`

## 실행
```bash
# backend
npm run start:dev

# web
npm run dev --prefix apps/web
```

## 품질/검증
```bash
# backend
npm run lint
npm run test
npm run test:e2e
npm run build

# web
npm run lint --prefix apps/web
npm run build --prefix apps/web
npm run test:e2e --prefix apps/web
```

## 마이그레이션
- SQL 파일 위치: `supabase/migrations/`
- 신규 마이그레이션은 타임스탬프 prefix를 유지합니다.

## 운영 참고
- 주문 수출(Export) 버킷: `exports`
- 결제/알림 외부 연동은 환경 변수로 mock/live 모드를 제어합니다.
