import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED_PREFIXES = ["/app"];
const AUTH_PAGES = new Set(["/login"]);

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ✅ response를 let으로 두고, 필요 시 redirect로 "교체"할 것
  let response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // ✅ Supabase가 쓰는 쿠키는 항상 "현재 response"에 실린다
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data, error } = await supabase.auth.getUser();
  const isAuthed = !!data?.user && !error;

  // 1) /app 접근: 비로그인 -> /login?next=/app
  if (isProtectedPath(pathname) && !isAuthed) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);

    // ✅ 여기서 response를 redirect로 바꾼다 (쿠키 복사 X)
    response = NextResponse.redirect(url);
    return response;
  }

  // 2) /login 접근: 로그인 -> /app
  if (AUTH_PAGES.has(pathname) && isAuthed) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";

    response = NextResponse.redirect(url);
    return response;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
