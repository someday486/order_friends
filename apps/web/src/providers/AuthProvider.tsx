"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AuthState } from "@/lib/auth/types";
import { getInitialSession, subscribeAuth } from "@/lib/auth/client";

type AuthContextValue = AuthState & {
  /** 호환용: 기존 코드가 loading을 쓰면 그대로 동작 */
  loading: boolean;
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

  useEffect(() => {
    let mounted = true;

    // 1) 최초 1회만: loading -> authenticated|unauthenticated
    (async () => {
      const session = await getInitialSession();
      if (!mounted) return;
      setState(derive(session));
    })();

    // 2) 이후 이벤트: 곧바로 최종 상태 반영 (loading으로 되돌리지 않음)
    const unsubscribe = subscribeAuth((session) => {
      setState(derive(session));
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    return { ...state, loading: state.status === "loading" };
  }, [state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
