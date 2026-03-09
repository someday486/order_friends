'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

type SignupFormProps = {
  loginHref?: string;
};

export function SignupForm({ loginHref = '/login' }: SignupFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const canSubmit =
    email.trim().length > 0 &&
    password.length >= 8 &&
    confirmPassword.length >= 8 &&
    !submitting;

  const submitSignup = async () => {
    if (!canSubmit) return;

    if (password !== confirmPassword) {
      setErrorMsg('비밀번호가 일치하지 않습니다.');
      setSuccessMsg(null);
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const emailRedirectTo = `${window.location.origin}/login`;
      const { data, error } = await supabaseBrowser.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo,
        },
      });

      if (error) {
        setErrorMsg(error.message || '회원가입에 실패했습니다.');
        return;
      }

      if (data.session) {
        await supabaseBrowser.auth.signOut();
      }

      setSuccessMsg(
        '회원가입 요청이 접수되었습니다. 이메일 확인 후 로그인해 주세요. 관리자 권한 연결은 별도 승인 후 반영됩니다.',
      );
      setEmail('');
      setPassword('');
      setConfirmPassword('');

      window.setTimeout(() => {
        router.push(
          loginHref.includes('?')
            ? `${loginHref}&registered=1`
            : `${loginHref}?registered=1`,
        );
      }, 800);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : '회원가입에 실패했습니다.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitSignup();
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
          placeholder="manager@example.com"
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
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          placeholder="영문/숫자 포함 8자 이상"
          disabled={submitting}
          minLength={8}
          required
          className="input-field"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-text-secondary">
          비밀번호 확인
        </span>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          placeholder="비밀번호를 다시 입력하세요"
          disabled={submitting}
          minLength={8}
          required
          className="input-field"
        />
      </label>

      {errorMsg ? (
        <div
          role="alert"
          className="rounded-md bg-danger-50 p-3 text-sm text-danger-500 animate-shake"
        >
          {errorMsg}
        </div>
      ) : null}

      {successMsg ? (
        <div className="rounded-md bg-success-50 p-3 text-sm text-success-600">
          {successMsg}
        </div>
      ) : null}

      <div className="rounded-md border border-border bg-bg-secondary p-3 text-xs leading-5 text-text-secondary">
        가입 후에도 브랜드/매장 관리자 권한은 자동 부여되지 않습니다. 시스템
        관리자가{' '}
        <span className="font-semibold text-foreground">/admin/members</span>
        에서 멤버십을 연결해야 실제 관리 화면 접근이 가능합니다.
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-2 w-full rounded-md bg-primary-500 py-3 text-sm font-bold text-white transition-all duration-150 hover:bg-primary-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? '회원가입 중...' : '회원가입'}
      </button>
    </form>
  );
}
