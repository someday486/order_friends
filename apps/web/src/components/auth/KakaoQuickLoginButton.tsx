"use client";

import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabaseBrowser } from "@/lib/supabase/client";

type KakaoQuickLoginButtonProps = {
  beforeLogin?: () => void;
  className?: string;
};

export function KakaoQuickLoginButton({
  beforeLogin,
  className,
}: KakaoQuickLoginButtonProps) {
  const { status } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (status === "authenticated") return null;

  const onKakaoLogin = async () => {
    try {
      beforeLogin?.();
      setSubmitting(true);
      setErrorMsg(null);

      const queryString = searchParams?.toString();
      const pathWithQuery = `${pathname}${queryString ? `?${queryString}` : ""}`;
      const redirectTo = `${window.location.origin}${pathWithQuery}`;
      const provider = "kakao" as Parameters<
        typeof supabaseBrowser.auth.signInWithOAuth
      >[0]["provider"];

      const { error } = await supabaseBrowser.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });

      if (error) {
        setErrorMsg(error.message || "카카오 로그인에 실패했습니다.");
      }
    } catch (e) {
      setErrorMsg(
        e instanceof Error ? e.message : "카카오 로그인에 실패했습니다.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={onKakaoLogin}
        disabled={submitting}
        className="w-full h-11 rounded-lg bg-[#FEE500] text-[#191919] font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? "카카오 로그인 이동 중..." : "카카오로 간편로그인"}
      </button>
      {errorMsg ? (
        <p className="mt-2 text-xs text-danger-500" role="alert">
          {errorMsg}
        </p>
      ) : null}
    </div>
  );
}
