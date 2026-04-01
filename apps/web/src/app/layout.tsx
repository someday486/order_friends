import './globals.css';
import type { Metadata } from 'next';
import type { User } from '@supabase/supabase-js';
import { Toaster } from 'react-hot-toast';
import { DocumentTitleSync } from '@/components/DocumentTitleSync';
import { BusinessFooter } from '@/components/common/BusinessFooter';
import { AuthProvider } from '@/providers/AuthProvider';
import { getSupabaseServerClient } from '@/lib/supabase/server';

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

  try {
    const supabase = await getSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    initialUser = userData.user ?? null;
  } catch {
    // Fall back to client-side auth sync when server auth lookup fails.
  }

  return (
    <html lang="ko">
      <body className="min-h-screen bg-bg-primary">
        <AuthProvider initialUser={initialUser}>
          <div className="flex min-h-screen flex-col">
            <DocumentTitleSync />
            <div className="flex-1">{children}</div>
            <BusinessFooter />
          </div>
        </AuthProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: 'var(--color-bg-secondary)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
              borderRadius: '12px',
              fontSize: '14px',
            },
            success: {
              iconTheme: { primary: '#34C759', secondary: '#fff' },
            },
            error: {
              iconTheme: { primary: '#FF3B30', secondary: '#fff' },
            },
          }}
        />
      </body>
    </html>
  );
}
