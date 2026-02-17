import { createServerClient } from '@supabase/ssr';

export function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      // 서버 컴포넌트에서는 읽기 전용 쿠키 접근만 사용한다.
      getAll() {
        // 세션 갱신은 미들웨어에서 처리하므로 서버 클라이언트는
        // 쿠키 쓰기를 수행하지 않는다.
        return [];
      },

      // 읽기 전용 모드: setAll은 no-op
      setAll() {
        // noop
      },
    },
  });
}
