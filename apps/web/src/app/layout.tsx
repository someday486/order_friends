import "./globals.css";
import type { User } from "@supabase/supabase-js";
import { Toaster } from "react-hot-toast";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { AuthProvider } from "@/providers/AuthProvider";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let initialUser: User | null = null;

  try {
    const supabase = await getSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    initialUser = data.user ?? null;
  } catch {
    // Fall back to client-side auth sync when server auth lookup fails.
  }

  return (
    <html lang="ko">
      <body>
        <AuthProvider initialUser={initialUser}>
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
