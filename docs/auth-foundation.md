# 🔐 Auth Foundation

> Order Friends (오더프렌즈)
> Auth Foundation Documentation

---

## 1. 문서 개요

이 문서는 **Order Friends 웹앱에서 인증(Auth)을 어떻게 “사용”해야 하는지에 대한 규칙 문서**이다.

### 목적

* 인증 구조를 **한 번만 제대로 만들고**
* 이후 모든 기능 개발에서 **같은 기준으로 사용**하기 위함

### 이 문서가 다루는 것

* AuthProvider / useAuth 사용 규칙
* App Router 인증 구조
* 인증 에러 판단 기준
* 팀 공용 금지 규칙

### 이 문서가 다루지 않는 것 ❌

* 로그인 UI 구현
* redirect 실제 동작
* OAuth / Email 인증 로직
* 권한(role) 체크 구현

> ⚠️ 위 항목들은 **auth-foundation 이후 Epic**에서 다룬다.

---

## 2. Auth 구조 개요

### 전체 구조 요약

```
Supabase Auth
   ↓
AuthProvider (전역 상태)
   ↓
useAuth()
   ↓
Page / Component
```

### 핵심 원칙

* **Auth 상태의 단일 소스는 AuthProvider**
* Page/Component는 auth를 “판단”하지 않고 “소비”만 한다

---

## 3. Auth 상태 모델

### 3.1 AuthStatus

Auth 상태는 반드시 아래 3가지 중 하나다.

```ts
type AuthStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated";
```

### 3.2 상태 의미

| status          | 의미                      |
| --------------- | ----------------------- |
| loading         | 최초 mount 시 auth 상태 확인 중 |
| authenticated   | 로그인된 사용자                |
| unauthenticated | 로그인되지 않은 사용자            |

### 3.3 상태 전이 규칙

* `loading`은 **최초 1회만**
* auth 이벤트 발생 시 바로 최종 상태로 전이
* loading으로 되돌아가는 케이스는 없음

---

## 4. AuthProvider 규칙 (중요)

### 4.1 AuthProvider의 책임

AuthProvider는 아래 역할만 수행한다.

* 최초 session 1회 로드
* `onAuthStateChange` 구독
* 전역 auth 상태 제공

### 4.2 ❌ 금지 사항

다음 행위는 **절대 금지**한다.

```ts
// ❌ 금지
supabase.auth.getSession();
supabase.auth.getUser();
```

* Page / Component에서 supabase auth 직접 접근 ❌
* 개별 컴포넌트에서 auth 상태 캐싱 ❌

---

## 5. `useAuth()` 사용 가이드

### 5.1 기본 사용법

```tsx
const { status, user, session } = useAuth();
```

### 5.2 사용 가능 범위

| 위치               | 가능 여부 |
| ---------------- | ----- |
| Client Component | ✅     |
| Server Component | ❌     |
| Middleware       | ❌     |

### 5.3 Provider 없는 곳에서 호출 시

* 즉시 Error throw
* 이는 **의도된 동작**이며 버그가 아님

---

## 6. App Router 인증 구조

### 6.1 Route Group 규칙

```
app/
  (public)/
  (protected)/
```

* `(public)` : 로그인 없이 접근 가능
* `(protected)` : 로그인 필요

### 6.2 보호 영역 기준

* `(protected)/layout.tsx`가 **보호 기준점**
* redirect는 이 단계에서 구현하지 않음

---

## 7. Auth Error 처리 기준 (Epic 4)

### 7.1 AuthErrorCode

```ts
type AuthErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "SESSION_EXPIRED"
  | "UNKNOWN";
```

### 7.2 에러 판단 기준

| 코드              | 의미     |
| --------------- | ------ |
| UNAUTHENTICATED | 로그인 필요 |
| FORBIDDEN       | 권한 없음  |
| SESSION_EXPIRED | 세션 만료  |
| UNKNOWN         | 분류 불가  |

### 7.3 처리 정책 (행동 기준)

* UNAUTHENTICATED
  → `/login` redirect (추후 Epic)
* FORBIDDEN
  → redirect 없음, 에러 노출
* SESSION_EXPIRED
  → silent logout 후 `/login`
* UNKNOWN
  → 기본 에러 처리

> ⚠️ 실제 redirect / UI는 아직 구현하지 않는다.

---

## 8. Import & 사용 규칙 (팀 규칙)

### 8.1 허용되는 접근

```ts
useAuth();
lib/auth/client;
lib/errors/authErrors;
```

### 8.2 ❌ 금지되는 접근

```ts
supabaseBrowser.auth.*
supabaseServer.auth.*
```

* 직접 호출 금지
* 반드시 wrapper / provider 경유

---

## 9. 다음 브랜치 작업 가이드

### 9.1 auth-login 브랜치

* 로그인 UI 구현
* AuthProvider 수정 ❌

### 9.2 auth-redirect 브랜치

* middleware / protected layout 연결
* redirect 구현

---

## 10. 자주 하는 실수

* loading 상태를 여러 번 쓰려는 시도
* server component에서 useAuth 사용
* auth-foundation 브랜치에서 기능 구현

---

## 11. 변경 시 주의사항

* 이 문서는 **기반 규칙**
* 변경 시 auth 전반에 영향
* 반드시 팀 합의 후 수정

---

## ✅ 문서 상태

* Auth Foundation 기준 고정 완료
* auth-foundation 브랜치 종료 가능
* 이후 브랜치는 이 문서를 기준으로 진행

---

### 📎 참고

* Architecture: `docs/02-architecture.md`
* Authorization Decision: `docs/decisions/ADR-0001-authorization-model.md`