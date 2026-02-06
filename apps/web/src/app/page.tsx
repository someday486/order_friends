"use client";

import { LoginForm } from "@/components/auth/LoginForm";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const { status } = useAuth();
  const { role, loading: roleLoading } = useUserRole();

  // 이미 로그인 상태면 역할에 따라 리다이렉트
  useEffect(() => {
    if (status === "authenticated" && !roleLoading) {
      // 역할에 따라 적절한 대시보드로 리다이렉트
      switch (role) {
        case "brand_owner":
        case "branch_manager":
        case "staff":
          // 관리자는 /admin으로
          router.replace("/admin");
          break;
        case "customer":
        default:
          // 소비자는 /customer로
          router.replace("/customer");
          break;
      }
      router.refresh();
    }
  }, [status, role, roleLoading, router]);

  // 로딩 중일 때 표시
  if (status === "loading" || (status === "authenticated" && roleLoading)) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <p>로딩 중...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Login</h1>
      <p style={{ marginBottom: 16 }}>Sign in with email and password.</p>

      <LoginForm />
    </div>
  );
}
