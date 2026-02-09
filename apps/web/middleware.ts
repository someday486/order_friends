import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PROTECTED_PREFIXES = ['/app'];
const AUTH_PAGES = new Set(['/login']);

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 기본 응답을 먼저 만들어두고 (쿠키 싱크용)
  const response = NextResponse.next();

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

  // 2) /login 접근: 로그인 -> / (역할 기반 라우팅)
  if (AUTH_PAGES.has(pathname) && isAuthed) {
    const url = request.nextUrl.clone();
    url.pathname = '/';

    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => {
      redirect.cookies.set(c.name, c.value, c);
    });
    return redirect;
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
