'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabaseBrowser } from '@/lib/supabase/client';
import { KakaoQuickLoginButton } from './KakaoQuickLoginButton';

type PublicAuthActionsProps = {
  className?: string;
  loginClassName?: string;
  beforeLogin?: () => void;
  hideWhenLoggedOut?: boolean;
};

export function PublicAuthActions({
  className,
  loginClassName,
  beforeLogin,
  hideWhenLoggedOut = false,
}: PublicAuthActionsProps) {
  const { status } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      const { error } = await supabaseBrowser.auth.signOut();
      if (error) {
        toast.error(error.message || '로그아웃에 실패했습니다.');
        return;
      }

      toast.success('로그아웃되었습니다.');
    } finally {
      setLoggingOut(false);
    }
  };

  if (status === 'authenticated') {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => {
            void handleLogout();
          }}
          disabled={loggingOut}
          className="w-full h-11 rounded-lg border border-border bg-bg-secondary text-foreground font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loggingOut ? '로그아웃 중...' : '로그아웃'}
        </button>
      </div>
    );
  }

  if (hideWhenLoggedOut) {
    return null;
  }

  return (
    <div className={className}>
      <KakaoQuickLoginButton
        beforeLogin={beforeLogin}
        className={loginClassName}
      />
    </div>
  );
}
