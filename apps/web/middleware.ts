import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // 이 호출이 핵심: 세션을 읽고 필요한 쿠키를 response에 반영
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // API 포함 전체에 적용되어야 /api/auth/me에도 쿠키가 반영됩니다.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
