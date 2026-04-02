# Sentry 모니터링 설정 가이드

## 개요

이 프로젝트는 Sentry NestJS SDK가 연결된 상태입니다.
다만 `SENTRY_DSN` 환경 변수가 설정된 경우에만 활성화되며, 값이 없으면 애플리케이션은 정상 동작하고 Sentry만 비활성화됩니다.

현재 구현은 다음과 같이 구성되어 있습니다.

- `src/instrument.ts`에서 가장 먼저 `Sentry.init(...)` 실행
- `src/main.ts` 최상단에서 `import './instrument'`로 조기 초기화
- `src/app.module.ts`에서 `SentryModule.forRoot()` 등록
- 전역 예외 필터 `catch()`에 `@SentryExceptionCaptured()` 적용

## 꼭 해야 하나요?

- 로컬 개발만 하는 경우: 필수 아닙니다.
- 이미 운영 배포된 환경인 경우: 강하게 권장합니다.
- 다른 에러 모니터링 도구를 이미 사용 중인 경우: 중복 운영 여부를 먼저 판단하세요.

운영 환경에서 Sentry를 붙이면 다음을 더 빨리 파악할 수 있습니다.

- 예기치 않은 서버 예외
- 배포 직후 발생한 회귀 오류
- 특정 API에서 반복되는 장애
- 환경별 오류 발생 차이

## 현재 코드 기준 동작

### 1. 초기화 파일

`src/instrument.ts`

```typescript
import * as Sentry from '@sentry/nestjs';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 1.0,
  });
}
```

### 2. main.ts에서 가장 먼저 로드

`src/main.ts`

```typescript
import './instrument';
```

### 3. AppModule 등록

`src/app.module.ts`

```typescript
import { SentryModule } from '@sentry/nestjs/setup';

@Module({
  imports: [SentryModule.forRoot()],
})
export class AppModule {}
```

### 4. 전역 예외 필터 연동

`src/common/filters/global-exception.filter.ts`

```typescript
import { SentryExceptionCaptured } from '@sentry/nestjs';

@SentryExceptionCaptured()
catch(exception: unknown, host: ArgumentsHost) {
  // ...
}
```

## 설정 순서

### 1. Sentry 계정 및 프로젝트 생성

1. [Sentry](https://sentry.io)에 가입합니다.
2. 조직과 프로젝트를 생성합니다.
3. 플랫폼은 `Node.js` 또는 `NestJS` 기준으로 선택합니다.
4. 발급된 DSN 값을 복사합니다.

### 2. 운영 환경 변수 설정

```env
SENTRY_DSN=your_sentry_dsn_here
SENTRY_ENVIRONMENT=production
NODE_ENV=production
```

참고:

- 현재 코드에서 실제 `environment` 값은 `NODE_ENV`를 사용합니다.
- `SENTRY_ENVIRONMENT`는 운영 관리용으로 함께 둘 수 있지만, 현재 코드에서 직접 읽지는 않습니다.

### 3. 배포 설정 반영

이 저장소에서는 다음 설정에서 `SENTRY_DSN`이 사용됩니다.

- `docker-compose.yml`
- `docker-compose.staging.yml`
- `docker-compose.prod.yml`
- `render.yaml`

## 활성화 확인 방법

### 1. 배포 환경 변수 확인

운영 환경에 `SENTRY_DSN`이 들어갔는지 먼저 확인합니다.

### 2. 이벤트 전송 확인

스테이징 또는 안전한 환경에서 다음과 같이 테스트할 수 있습니다.

```typescript
import * as Sentry from '@sentry/nestjs';

Sentry.captureException(new Error('Sentry setup test'));
Sentry.captureMessage('Sentry test message');
```

그 후 Sentry 대시보드에서 이벤트 수집 여부를 확인합니다.

### 3. 환경 값 확인

수집된 이벤트에 `production`, `staging`, `development` 중 올바른 환경 값이 표시되는지 확인합니다.

## 운영 환경 권장 사항

현재 코드의 `tracesSampleRate`는 `1.0`입니다.
운영 트래픽이 있는 환경에서는 비용과 노이즈가 커질 수 있으므로 보통 더 낮은 값을 검토합니다.

예시:

```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'production',
  tracesSampleRate: 0.1,
});
```

권장 방향:

- 초기 운영 적용: `0.1`
- 트래픽이 적은 초기 서비스: `0.1 ~ 0.3`
- 장애 분석 기간의 일시적 확대: 필요 시 한시적으로 상향

문서 시점 기준으로 저장소 코드는 아직 `1.0`입니다.
실제 샘플링 값을 바꾸려면 코드 수정과 검증을 별도로 진행하세요.

## 민감 정보 주의

Sentry 예외 이벤트에 요청 본문이나 사용자 정보가 포함될 수 있으므로 다음 항목은 주의해서 다뤄야 합니다.

- 비밀번호
- 액세스 토큰
- 결제 관련 민감 정보
- 전화번호, 이메일 등 개인정보

필요하면 `beforeSend`에서 마스킹 또는 제거 로직을 적용하세요.

```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  beforeSend(event) {
    if (event.request?.data?.password) {
      delete event.request.data.password;
    }
    return event;
  },
});
```

## 이번 구현에서 일부러 하지 않은 것

- `sendDefaultPii: true` 기본 활성화
- 운영 API에 상시 노출되는 `/debug-sentry` 테스트 엔드포인트 추가

이 두 항목은 개인정보와 운영 안전성 측면에서 영향이 있으므로, 필요성이 명확할 때 별도로 판단하는 편이 안전합니다.

## 자주 쓰는 예시

### 예외 수집

```typescript
Sentry.captureException(error);
```

### 메시지 수집

```typescript
Sentry.captureMessage('Important event happened');
```

### 컨텍스트 추가

```typescript
Sentry.setContext('order', {
  orderId: '123',
  amount: 10000,
});
```

### 사용자 정보 연결

```typescript
Sentry.setUser({
  id: user.id,
  email: user.email,
});
```

### 태그 추가

```typescript
Sentry.setTag('branch_id', branchId);
Sentry.setTag('payment_method', 'card');
```

## 문제 해결

### 이벤트가 안 들어오는 경우

1. `SENTRY_DSN` 값이 실제 배포 환경에 들어갔는지 확인
2. 애플리케이션이 해당 환경 변수로 실행 중인지 확인
3. Sentry 프로젝트의 DSN이 올바른지 확인
4. 방화벽 또는 네트워크 제한이 없는지 확인

### 이벤트가 너무 많이 들어오는 경우

1. `tracesSampleRate`를 낮춥니다.
2. 불필요한 예외 수집 지점을 줄입니다.
3. `beforeSend`로 노이즈 이벤트를 필터링합니다.

## 참고 자료

- [Sentry NestJS 문서](https://docs.sentry.io/platforms/javascript/guides/nestjs/)
- [Sentry Performance 문서](https://docs.sentry.io/product/performance/)
- [Sentry Alerts 문서](https://docs.sentry.io/product/alerts/)
