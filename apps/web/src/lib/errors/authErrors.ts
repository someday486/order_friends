// apps/web/src/lib/errors/authErrors.ts
import type { AuthError } from "@supabase/supabase-js";

/**
 * Auth Error Code
 *
 * - UNAUTHENTICATED: 로그인 필요
 * - FORBIDDEN: 권한 없음
 * - SESSION_EXPIRED: 세션 만료
 * - UNKNOWN: 분류 불가
 */
export type AuthErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "SESSION_EXPIRED"
  | "UNKNOWN";

/**
 * Supabase AuthError -> App AuthErrorCode
 */
export function mapAuthError(error: AuthError | null): AuthErrorCode {
  if (!error) return "UNKNOWN";

  if (error.status === 401) return "UNAUTHENTICATED";
  if (error.status === 403) return "FORBIDDEN";

  if (
    error.message?.includes("JWT expired") ||
    error.message?.includes("session")
  ) {
    return "SESSION_EXPIRED";
  }

  return "UNKNOWN";
}

/**
 * Auth Error Handling Policy (Epic 4)
 *
 * UNAUTHENTICATED:
 *  - 로그인 필요 상태
 *  - redirect to /login (Epic 6에서 구현)
 *
 * FORBIDDEN:
 *  - 권한 없음
 *  - redirect 하지 않음 (권한 에러 메시지 노출 예정)
 *
 * SESSION_EXPIRED:
 *  - 세션 만료
 *  - silent logout 후 redirect to /login
 *
 * UNKNOWN:
 *  - 기본 에러 처리
 *  - 필요 시 로그만 남김
 */
