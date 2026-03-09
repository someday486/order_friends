import "./globals.css";
import { AuthProvider } from "@/providers/AuthProvider";
import { Toaster } from "react-hot-toast";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 서버에서 세션을 미리 가져와 클라이언트 초기 로딩 제거
  let initialSession = null;
  try {
    const supabase = await getSupabaseServerClient();
    const { data } = await supabase.auth.getSession();
    initialSession = data.session ?? null;
  } catch {
    // 세션 조회 실패 시 클라이언트에서 재시도
  }

  return (
    <html lang="ko">
      <body>
        <AuthProvider initialSession={initialSession}>
          {children}
        </AuthProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: "var(--color-bg-secondary)",
              color: "var(--color-text-primary)",
              border: "1px solid var(--color-border)",
              borderRadius: "12px",
              fontSize: "14px",
            },
            success: {
              iconTheme: { primary: "#34C759", secondary: "#fff" },
            },
            error: {
              iconTheme: { primary: "#FF3B30", secondary: "#fff" },
            },
          }}
        />
      </body>
    </html>
  );
}
