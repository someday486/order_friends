"use client";

import { LoginForm } from "@/components/auth/LoginForm";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const { status } = useAuth();

  // 이미 로그인 상태면 로그인 페이지에 있을 이유 없음
  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/app");
      router.refresh();
    }
  }, [status, router]);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Login</h1>
      <p style={{ marginBottom: 16 }}>Sign in with email and password.</p>

      <LoginForm redirectTo="/app" />
    </div>
  );
}
