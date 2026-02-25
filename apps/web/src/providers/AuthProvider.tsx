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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: "loading",
    user: null,
    session: null,
  });

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

    // 최초 1회 로드: loading -> authenticated|unauthenticated
    (async () => {
      const session = await getInitialSession();
      if (!mounted) return;
      setState(derive(session));
    })();

    // 이후 인증 이벤트를 최종 상태로 반영
    const unsubscribe = subscribeAuth((session) => {
      setState(derive(session));
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
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
