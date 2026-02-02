"use client";

import { LoginForm } from "@/components/auth/LoginForm";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginClient({ next }: { next: string }) {
  const router = useRouter();
  const { status } = useAuth();

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
