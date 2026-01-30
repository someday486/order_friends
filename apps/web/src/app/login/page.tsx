"use client";

import { useAuth } from "@/hooks/useAuth";
import { LoginForm } from "@/components/auth/LoginForm";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { status } = useAuth();

  const next = params.get("next") ?? "/app";

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

      <LoginForm redirectTo={next} />
    </div>
  );
}
