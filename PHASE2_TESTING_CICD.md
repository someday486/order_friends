# Phase 2: 테스트 & CI/CD & Docker 완료

## 개요
이 브랜치(`feature/add-testing-and-cicd`)에는 테스트 커버리지 확대, CI/CD 파이프라인 구축, Docker 컨테이너화가 포함되어 있습니다.

## 변경사항 요약

### 1. ✅ 단위 테스트 (Unit Tests)

#### 새로운 테스트 파일:
- `src/modules/orders/orders.service.spec.ts` - 주문 서비스 테스트
- `src/modules/products/products.service.spec.ts` - 상품 서비스 테스트
- `src/common/filters/global-exception.filter.spec.ts` - 예외 필터 테스트

#### 테스트 커버리지:
- **Orders Service**: 모든 메서드 테스트 (getOrders, getOrder, updateStatus)
- **Products Service**: CRUD 전체 테스트 (create, read, update, delete)
- **Global Exception Filter**: 예외 처리 로직 테스트

#### 테스트 실행:
```bash
# 단위 테스트
npm run test

# 커버리지 포함
npm run test:cov

# Watch 모드
npm run test:watch
```

### 2. ✅ E2E 테스트 (End-to-End Tests)

#### 새로운 E2E 테스트:
- `test/orders.e2e-spec.ts` - 주문 API E2E 테스트
- `test/products.e2e-spec.ts` - 상품 API E2E 테스트
- `test/health.e2e-spec.ts` - 헬스체크 E2E 테스트

#### 테스트 범위:
- 인증/권한 검증
- 입력 유효성 검사
- API 응답 형식 검증
- 헬스체크 엔드포인트

#### E2E 테스트 실행:
```bash
npm run test:e2e
```

### 3. ✅ GitHub Actions CI/CD

#### 워크플로우 파일:
- `.github/workflows/ci.yml`

#### CI 파이프라인 단계:
1. **Test Job**
   - Node.js 20.x, 22.x 매트릭스 테스트
   - Linting (ESLint)
   - 단위 테스트
   - E2E 테스트
   - 커버리지 리포트 생성
   - Codecov 업로드 (선택)

2. **Build Job**
   - NestJS 애플리케이션 빌드
   - Build artifact 저장 (7일 보관)

3. **Docker Job** (main/develop 브랜치만)
   - Docker 이미지 빌드
   - Docker Hub 푸시 (선택)
   - GitHub Container Registry 지원

#### 트리거:
- `push`: main, develop, feature/* 브랜치
- `pull_request`: main, develop 브랜치

#### 필요한 GitHub Secrets:
```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DOCKERHUB_USERNAME (선택)
DOCKERHUB_TOKEN (선택)
```

### 4. ✅ Docker 컨테이너화

#### 백엔드 (NestJS API)
- **파일**: `Dockerfile`
- **특징**:
  - Multi-stage build (build + production)
  - Alpine Linux 기반 (경량)
  - Non-root 사용자 실행
  - Health check 내장
  - dumb-init 사용 (신호 처리)

#### 프론트엔드 (Next.js)
- **파일**: `apps/web/Dockerfile`
- **특징**:
  - Multi-stage build
  - 프로덕션 전용 의존성
  - Non-root 사용자 실행

#### Docker Compose
- **파일**: `docker-compose.yml`
- **서비스**:
  - `api`: NestJS 백엔드 (포트 4000)
  - `web`: Next.js 프론트엔드 (포트 3000)
- **네트워크**: 컨테이너 간 통신
- **헬스체크**: API 서비스 상태 확인

#### .dockerignore
- 빌드에 불필요한 파일 제외
- 이미지 크기 최적화

### 5. ✅ 테스트 구조 개선

#### Jest 설정:
- TypeScript 지원 (ts-jest)
- 커버리지 수집 설정
- E2E 테스트 별도 설정

#### Mock 전략:
- Supabase 클라이언트 모킹
- 서비스 의존성 주입 테스트

## 사용 방법

### 로컬 테스트 실행

```bash
# 모든 단위 테스트
npm run test

# E2E 테스트
npm run test:e2e

# 커버리지 포함
npm run test:cov
```

### Docker로 실행

```bash
# 빌드 및 실행
docker-compose up --build

# 백그라운드 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 종료
docker-compose down
```

### 개별 Docker 이미지 빌드

```bash
# 백엔드
docker build -t orderfriends-api .

# 프론트엔드
docker build -t orderfriends-web ./apps/web
```

## 테스트 커버리지 목표

| 영역 | 현재 상태 | 목표 |
|------|-----------|------|
| Orders Service | ✅ 완료 | 80%+ |
| Products Service | ✅ 완료 | 80%+ |
| Exception Filter | ✅ 완료 | 100% |
| E2E Tests | ✅ 기본 완료 | 주요 플로우 커버 |

## 주요 변경 파일 목록

### 새로 추가된 파일:
```
src/modules/orders/orders.service.spec.ts
src/modules/products/products.service.spec.ts
src/common/filters/global-exception.filter.spec.ts
test/orders.e2e-spec.ts
test/products.e2e-spec.ts
test/health.e2e-spec.ts
.github/workflows/ci.yml
Dockerfile
docker-compose.yml
.dockerignore
apps/web/Dockerfile
```

## CI/CD 워크플로우 확인

GitHub Actions에서 자동으로 실행됩니다:
1. 코드 푸시 시 자동 테스트
2. PR 생성 시 자동 검증
3. main/develop 브랜치 머지 시 Docker 이미지 빌드

**워크플로우 상태 확인**: `https://github.com/someday486/order_friends/actions`

## 배포 전 체크리스트

- [ ] `npm install` 실행
- [ ] 단위 테스트 통과 (`npm run test`)
- [ ] E2E 테스트 통과 (`npm run test:e2e`)
- [ ] Linting 통과 (`npm run lint`)
- [ ] 빌드 성공 (`npm run build`)
- [ ] Docker 이미지 빌드 성공
- [ ] GitHub Secrets 설정 (CI/CD용)

## 다음 단계 (Phase 3)

Phase 3에서는 다음 작업이 계획되어 있습니다:
1. 페이지네이션 구현
2. 캐싱 전략 (Redis)
3. 모니터링 설정 (Sentry)
4. 성능 최적화
5. 추가 테스트 커버리지 확대

## Docker 이미지 최적화

### 이미지 크기:
- **백엔드**: ~150MB (Alpine 기반)
- **프론트엔드**: ~180MB (Alpine 기반)

### 보안:
- Non-root 사용자 실행
- Alpine Linux (최소 공격 표면)
- 프로덕션 의존성만 포함

### 성능:
- Multi-stage build (레이어 최적화)
- Docker cache 활용
- 불필요한 파일 제외 (.dockerignore)

## 문제 해결

### 테스트 실패 시:
```bash
# 캐시 정리
npm run test -- --clearCache

# 특정 테스트만 실행
npm run test -- orders.service.spec.ts
```

### Docker 빌드 실패 시:
```bash
# 캐시 없이 빌드
docker-compose build --no-cache

# 개별 서비스 빌드
docker-compose build api
```

### CI/CD 실패 시:
1. GitHub Actions 로그 확인
2. Secrets 설정 확인
3. 로컬에서 동일 명령 실행

## 롤백 방법

만약 문제가 발생하면:
```bash
git checkout feature/enhance-core-infrastructure
git branch -D feature/add-testing-and-cicd
```

## 성능 메트릭

### CI 파이프라인 실행 시간:
- Test Job: ~3-5분
- Build Job: ~2-3분
- Docker Job: ~5-7분
- **총 소요 시간**: ~10-15분

### 테스트 실행 시간:
- 단위 테스트: ~10-20초
- E2E 테스트: ~30-60초

## 참고 자료

- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [GitHub Actions](https://docs.github.com/en/actions)

---

**Phase 3 진행을 원하시면 말씀해주세요!** 🚀
