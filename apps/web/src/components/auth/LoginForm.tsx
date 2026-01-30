"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Props = {
  redirectTo?: string; // default: /app
};

export function LoginForm({ redirectTo = "/app" }: Props) {
  const router = useRouter();
  const { refresh } = useAuth(); // ✅ 여기서만 호출 (컴포넌트 본문)
  
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

      // ✅ 로그인 직후 상태 강제 동기화
      await refresh();

      router.replace(redirectTo);
      router.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      style={{ display: "grid", gap: 12, maxWidth: 360 }}
    >
      <label style={{ display: "grid", gap: 6 }}>
        <span>Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
          disabled={submitting}
          required
        />
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <span>Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          placeholder="••••••••"
          disabled={submitting}
          required
        />
      </label>

      {errorMsg && <div role="alert">{errorMsg}</div>}

      <button type="submit" disabled={!canSubmit}>
        {submitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
