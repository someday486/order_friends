"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { AuthState } from "@/lib/auth/types";
import { getInitialSession, subscribeAuth } from "@/lib/auth/client";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Session } from "@supabase/supabase-js";

type AuthContextValue = AuthState & {
  /** 기존 코드 호환용 로딩 상태 */
  loading: boolean;
  /** 로그인/로그아웃 직후 세션 상태 강제 동기화 */
  refresh: () => Promise<void>;
  /** 로그아웃 */
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

function derive(session: AuthState["session"]): AuthState {
  if (!session) return { status: "unauthenticated", session: null, user: null };
  return { status: "authenticated", session, user: session.user ?? null };
}

export function AuthProvider({
  children,
  initialSession = null,
}: {
  children: React.ReactNode;
  initialSession?: Session | null;
}) {
  // SSR에서 세션을 받은 경우 loading 없이 바로 최종 상태로 시작
  const [state, setState] = useState<AuthState>(() => derive(initialSession));

  const refresh = useCallback(async () => {
    const session = await getInitialSession();
    setState(derive(session));
  }, []);

  const signOut = useCallback(async () => {
    await supabaseBrowser.auth.signOut();
    await refresh();
    window.location.assign("/login");
  }, [refresh]);

  useEffect(() => {
    let mounted = true;

    // initialSession이 없을 때만 클라이언트에서 세션을 다시 확인
    if (!initialSession) {
      (async () => {
        const session = await getInitialSession();
        if (!mounted) return;
        setState(derive(session));
      })();
    }

    // 이후 이벤트: 곧바로 최종 상태 반영 (loading으로 되돌리지 않음)
    // access_token이 동일하면 상태를 업데이트하지 않아 불필요한 재렌더 방지
    const unsubscribe = subscribeAuth((session) => {
      setState((prev) => {
        if (
          prev.session?.access_token === session?.access_token &&
          prev.status === (session ? "authenticated" : "unauthenticated")
        ) {
          return prev;
        }
        return derive(session);
      });
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    return {
      ...state,
      loading: state.status === "loading",
      refresh,
      signOut,
    };
  }, [state, refresh, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
