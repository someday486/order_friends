import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PROTECTED_PREFIXES = ['/app', '/admin', '/customer'];
const AUTH_PAGES = new Set(['/login', '/signup']);
const E2E_AUTH_COOKIE = 'of_e2e_auth';
const E2E_AUTH_HEADER = 'x-of-e2e-auth';
const E2E_BYPASS_AUTH = process.env.NEXT_PUBLIC_E2E_BYPASS_AUTH === 'true';

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );
}

function shouldBypassAuth(request: NextRequest) {
  const cookieBypass = request.cookies.get(E2E_AUTH_COOKIE)?.value === '1';
  const headerBypass = request.headers.get(E2E_AUTH_HEADER) === '1';

  const host = request.nextUrl.hostname;
  const isLocalHost = host === '127.0.0.1' || host === 'localhost';
  if (!isLocalHost) return false;

  if (E2E_BYPASS_AUTH) return cookieBypass || headerBypass;

  return cookieBypass && headerBypass;
}

function resolveAuthPageRedirectPath(request: NextRequest) {
  const next = request.nextUrl.searchParams.get('next')?.trim();
  if (
    !next ||
    next === '/app' ||
    !next.startsWith('/') ||
    next.startsWith('//')
  ) {
    return '/';
  }

  const target = new URL(next, request.nextUrl.origin);
  if (
    target.origin !== request.nextUrl.origin ||
    AUTH_PAGES.has(target.pathname)
  ) {
    return '/';
  }

  return `${target.pathname}${target.search}${target.hash}`;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 기본 응답을 먼저 만들어두고 (쿠키 싱크용)
  const response = NextResponse.next();

  if (shouldBypassAuth(request)) {
    return response;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // ✅ 핵심: response에 쿠키를 실어야 다음 요청에 반영됨
        cookiesToSet.forEach(({ name, value, options }) => {
          // ✅ request도 갱신 (중요)
          request.cookies.set(name, value);
          // ✅ response도 갱신
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  const isAuthed = !!data?.user && !error;

  // 1) /app 접근: 비로그인 -> /login?next=/app
  if (isProtectedPath(pathname) && !isAuthed) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);

    // ✅ redirect 응답을 만들되, response의 쿠키 헤더를 그대로 복사
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => {
      redirect.cookies.set(c.name, c.value, c);
    });
    return redirect;
  }

  // 2) /login 접근: 로그인 -> next 또는 / (루트에서 역할 기반 라우팅)
  if (AUTH_PAGES.has(pathname) && isAuthed) {
    const url = new URL(resolveAuthPageRedirectPath(request), request.url);

    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => {
      redirect.cookies.set(c.name, c.value, c);
    });
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    '/app/:path*',
    '/admin/:path*',
    '/customer/:path*',
    '/login',
    '/signup',
  ],
};
