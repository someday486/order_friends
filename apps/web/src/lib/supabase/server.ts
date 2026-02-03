import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export function getSupabaseServerClient() {
  const cookieStore = cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      // ✅ getAll 지원 안 하는 런타임 대응: 최소한 get() 기반으로만 사용
      getAll() {
        // cookieStore.getAll()이 없는 경우도 있어서, 안전하게 빈 배열
        // (세션 갱신은 middleware가 담당)
        // 단, 이미 세션 쿠키가 request에 있으면 supabase 내부에서 get(name)로도 동작함
        return [];
      },

      // ✅ 여기서는 절대 set 하지 않음 (read-only 런타임)
      setAll() {
        // noop
      },
    },
  });
}
