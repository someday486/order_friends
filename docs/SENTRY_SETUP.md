# Sentry 모니터링 설정 가이드

## 개요

Sentry는 애플리케이션의 에러와 성능을 모니터링하는 도구입니다. 이미 프로젝트에 통합되어 있습니다.

## 설정 방법

### 1. Sentry 프로젝트 생성

1. [Sentry 웹사이트](https://sentry.io)에 가입
2. 새 프로젝트 생성 (Node.js/NestJS 선택)
3. DSN (Data Source Name) 복사

### 2. 환경 변수 설정

`.env` 파일에 다음 추가:

```env
# Sentry Configuration
SENTRY_DSN=your_sentry_dsn_here
NODE_ENV=production
```

### 3. 자동 설정 완료

`src/main.ts`에 이미 Sentry가 설정되어 있습니다:

```typescript
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 1.0,
  });
}
```

## 기능

### 자동 에러 추적

모든 uncaught exception과 unhandled rejection이 자동으로 Sentry에 전송됩니다.

### 수동 에러 리포팅

```typescript
import * as Sentry from '@sentry/nestjs';

// 에러 캡처
Sentry.captureException(new Error('Something went wrong'));

// 메시지 캡처
Sentry.captureMessage('Important event happened');

// 컨텍스트 추가
Sentry.setContext('order', {
  orderId: '123',
  amount: 10000,
});
```

### 성능 모니터링

```typescript
const transaction = Sentry.startTransaction({
  op: 'create-order',
  name: 'Create Order Transaction',
});

try {
  // 비즈니스 로직
  await this.ordersService.createOrder(dto);
} finally {
  transaction.finish();
}
```

## 권장 설정

### Production 환경

```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: 'production',
  tracesSampleRate: 0.1, // 10% 샘플링
  beforeSend(event) {
    // 민감한 데이터 필터링
    if (event.request?.data?.password) {
      delete event.request.data.password;
    }
    return event;
  },
});
```

### Development 환경

개발 환경에서는 SENTRY_DSN을 설정하지 않으면 Sentry가 비활성화됩니다.

## 모니터링 대상

현재 설정으로 다음을 모니터링합니다:

1. **에러 추적**
   - API 엔드포인트 에러
   - 데이터베이스 쿼리 실패
   - 비즈니스 로직 예외

2. **성능 모니터링**
   - API 응답 시간
   - 데이터베이스 쿼리 성능
   - 트랜잭션 추적

3. **사용자 컨텍스트**
   - 사용자 ID
   - 요청 IP
   - 브라우저 정보

## 알림 설정

Sentry 대시보드에서:

1. **Alerts** 메뉴로 이동
2. 새 Alert Rule 생성
3. 조건 설정:
   - 에러 발생 시
   - 성능 저하 시
   - 에러 빈도 증가 시

4. 알림 채널 선택:
   - 이메일
   - Slack
   - Discord
   - PagerDuty

## 유용한 팁

### 에러 그룹화

동일한 에러를 그룹화하여 노이즈 감소:

```typescript
Sentry.captureException(error, {
  fingerprint: ['{{ default }}', orderId],
});
```

### 사용자 식별

```typescript
Sentry.setUser({
  id: user.id,
  email: user.email,
  username: user.name,
});
```

### 태그 추가

```typescript
Sentry.setTag('payment_method', 'card');
Sentry.setTag('branch_id', branchId);
```

## 비용 최적화

1. **샘플링 조정**: `tracesSampleRate`를 0.1-0.3으로 설정
2. **필터링**: 중요하지 않은 에러 필터링
3. **데이터 스크러빙**: 민감한 정보 자동 제거

## 문제 해결

### Sentry에 에러가 전송되지 않을 때

1. SENTRY_DSN 환경 변수 확인
2. 네트워크 연결 확인
3. Sentry 프로젝트 설정 확인

### 너무 많은 에러가 전송될 때

1. `beforeSend` 훅으로 필터링
2. 에러 빈도 제한 설정
3. 샘플링 비율 조정

## 참고 자료

- [Sentry NestJS 문서](https://docs.sentry.io/platforms/javascript/guides/nestjs/)
- [Sentry 성능 모니터링](https://docs.sentry.io/product/performance/)
- [Sentry 알림 설정](https://docs.sentry.io/product/alerts/)
