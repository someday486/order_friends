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

  useEffect(() => {
    if (status === "authenticated" && !roleLoading) {
      switch (role) {
        case "system_admin":
          router.replace("/admin");
          break;
        case "brand_owner":
        case "branch_manager":
        case "staff":
          router.replace("/customer");
          break;
        case "customer":
        default:
          router.replace("/customer");
          break;
      }
      router.refresh();
    }
  }, [status, role, roleLoading, router]);

  if (status === "loading" || (status === "authenticated" && roleLoading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="text-4xl mb-4">🍽️</div>
          <p className="text-text-secondary text-sm">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🍽️</div>
          <h1 className="text-2xl font-extrabold text-foreground">OrderFriends</h1>
          <p className="text-sm text-text-secondary mt-2">계정에 로그인하세요</p>
        </div>

        <div className="card p-6">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
