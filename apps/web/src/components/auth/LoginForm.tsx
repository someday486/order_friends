'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { seedSessionCache } from '@/lib/auth/client';
import { supabaseBrowser } from '@/lib/supabase/client';

export function LoginForm() {
  const { refresh } = useAuth();
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const canSubmit = hydrated && !submitting;

  useEffect(() => {
    setHydrated(true);
  }, []);

  const submitLogin = async (form: HTMLFormElement) => {
    if (!canSubmit) return;

    const formData = new FormData(form);
    const emailField = formData.get('email');
    const passwordField = formData.get('password');
    const email = typeof emailField === 'string' ? emailField.trim() : '';
    const password = typeof passwordField === 'string' ? passwordField : '';

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabaseBrowser.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMsg(error.message || 'Login failed');
        return;
      }

      seedSessionCache(data.session ?? null);
      await refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void submitLogin(e.currentTarget);
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-text-secondary">이메일</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@example.com"
          disabled={submitting}
          required
          className="input-field"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-text-secondary">
          비밀번호
        </span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="••••••••"
          disabled={submitting}
          required
          className="input-field"
        />
      </label>

      {errorMsg && (
        <div
          role="alert"
          className="text-sm text-danger-500 bg-danger-50 p-3 rounded-md animate-shake"
        >
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
        {submitting ? '로그인 중...' : '로그인'}
      </button>
    </form>
  );
}
