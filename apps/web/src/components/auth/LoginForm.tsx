"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Props = {
  redirectTo?: string;
};

export function LoginForm({ redirectTo = "/" }: Props) {
  const router = useRouter();
  const { refresh } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canSubmit =
    email.trim().length > 0 && password.length > 0 && !submitting;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const { error } = await supabaseBrowser.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMsg(error.message || "Login failed");
        return;
      }

      await refresh();

      window.location.assign(redirectTo);
      router.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-text-secondary">이메일</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
          disabled={submitting}
          required
          className="input-field"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-text-secondary">비밀번호</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          placeholder="••••••••"
          disabled={submitting}
          required
          className="input-field"
        />
      </label>

      {errorMsg && (
        <div role="alert" className="text-sm text-danger-500 bg-danger-50 p-3 rounded-md animate-shake">
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full py-3 rounded-md bg-primary-500 text-white font-bold text-sm
          hover:bg-primary-600 active:scale-95 transition-all duration-150
          disabled:opacity-50 disabled:cursor-not-allowed mt-2"
      >
        {submitting ? "로그인 중..." : "로그인"}
      </button>
    </form>
  );
}
