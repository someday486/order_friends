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
      router.replace("/");
      router.refresh();
    }
  }, [status, router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🍽️</div>
          <h1 className="text-2xl font-extrabold text-foreground">OrderFriends</h1>
          <p className="text-sm text-text-secondary mt-2">계정에 로그인하세요</p>
        </div>

        <div className="card p-6">
          <LoginForm redirectTo={next} />
        </div>
      </div>
    </div>
  );
}
