import "./globals.css";
import type { Metadata } from 'next';
import type { Session, User } from "@supabase/supabase-js";
import { Toaster } from "react-hot-toast";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { AuthProvider } from "@/providers/AuthProvider";
import { DocumentTitleSync } from '@/components/DocumentTitleSync';

export const metadata: Metadata = {
  applicationName: '오더프렌즈',
  title: {
    default: '오더프렌즈',
    template: '%s | 오더프렌즈',
  },
  description: '브랜드 운영과 주문 관리를 위한 오더프렌즈',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let initialUser: User | null = null;
  let initialSession: Session | null = null;

  try {
    const supabase = await getSupabaseServerClient();
    const [{ data: sessionData }, { data: userData }] = await Promise.all([
      supabase.auth.getSession(),
      supabase.auth.getUser(),
    ]);
    initialSession = sessionData.session ?? null;
    initialUser = userData.user ?? null;
  } catch {
    // Fall back to client-side auth sync when server auth lookup fails.
  }

  return (
    <html lang="ko">
      <body>
        <AuthProvider
          initialSession={initialSession}
          initialUser={initialUser}
        >
          <DocumentTitleSync />
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
