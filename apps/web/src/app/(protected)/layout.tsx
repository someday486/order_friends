"use client";

import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useAuth();

  useEffect(() => {
    if (status === "unauthenticated") {
      // ✅ searchParams 없이도 충분 (최소 next는 pathname만)
      const next = pathname || "/app";
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      router.refresh();
    }
  }, [status, router, pathname]);

  if (status === "loading") return <div>checking auth...</div>;
  if (status === "unauthenticated") return <div>redirecting to login...</div>;

  return <>{children}</>;
}
