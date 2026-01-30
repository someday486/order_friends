"use client";

import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { status } = useAuth();

  useEffect(() => {
    // ✅ 로그아웃 직후(클라이언트 상태 변화)에 즉시 /login으로 보냄
    if (status === "unauthenticated") {
      const next = pathname + (searchParams?.toString() ? `?${searchParams}` : "");
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      router.refresh();
    }
  }, [status, router, pathname, searchParams]);

  if (status === "loading") {
    return <div>checking auth...</div>;
  }

  // ✅ 빈 화면 방지: 리다이렉트가 일어나기 전 짧은 순간 보여줄 fallback
  if (status === "unauthenticated") {
    return <div>redirecting to login...</div>;
  }

  return <>{children}</>;
}
