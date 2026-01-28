"use client";

import { useAuth } from "@/hooks/useAuth";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status } = useAuth();

  if (status === "loading") {
    return <div>checking auth...</div>;
  }

  if (status === "unauthenticated") {
    return <div>unauthorized (redirect 예정)</div>;
  }

  return <>{children}</>;
}