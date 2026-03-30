"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AuthState } from "@/lib/auth/types";
import {
  getInitialSession,
  getVerifiedUser,
  seedSessionCache,
  seedVerifiedUserCache,
  subscribeAuth,
} from "@/lib/auth/client";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

type AuthContextValue = AuthState & {
  /** 기존 코드 호환용 로딩 상태 */
  loading: boolean;
  /** 로그인/로그아웃 직후 세션 상태 강제 동기화 */
  refresh: () => Promise<void>;
  /** 로그아웃 */
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

function derive(
  session: AuthState["session"],
  user: AuthState["user"],
): AuthState {
  if (!session && !user) {
    return { status: "unauthenticated", session: null, user: null };
  }

  return {
    status: "authenticated",
    session: session ?? null,
    user: user ?? null,
  };
}

function getInitialState(
  session: Session | null,
  user: User | null,
): AuthState {
  if (!session && !user) {
    return { status: "loading", session: null, user: null };
  }

  return derive(session, user);
}

export function AuthProvider({
  children,
  initialSession = null,
  initialUser = null,
}: {
  children: React.ReactNode;
  initialSession?: Session | null;
  initialUser?: User | null;
}) {
  const syncIdRef = useRef(0);
  const [state, setState] = useState<AuthState>(() =>
    getInitialState(initialSession, initialUser),
  );

  useEffect(() => {
    if (initialSession !== undefined) {
      seedSessionCache(initialSession);
    }

    if (initialUser !== undefined) {
      seedVerifiedUserCache(initialUser);
    }
  }, [initialSession, initialUser]);

  const syncAuthState = useCallback(async (sessionOverride?: Session | null) => {
    const syncId = ++syncIdRef.current;
    const session =
      sessionOverride === undefined
        ? await getInitialSession()
        : sessionOverride;

    if (!session) {
      if (syncId !== syncIdRef.current) return;
      setState((prev) => {
        const next = derive(null, null);
        if (
          prev.status === next.status &&
          prev.session === next.session &&
          prev.user === next.user
        ) {
          return prev;
        }
        return next;
      });
      return;
    }

    const user = await getVerifiedUser();
    if (syncId !== syncIdRef.current) return;

    setState((prev) => {
      const next = derive(session, user);
      if (
        prev.session?.access_token === next.session?.access_token &&
        prev.user?.id === next.user?.id &&
        prev.status === next.status
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    await syncAuthState();
  }, [syncAuthState]);

  const signOut = useCallback(async () => {
    await supabaseBrowser.auth.signOut();
    await refresh();
    window.location.assign("/login");
  }, [refresh]);

  useEffect(() => {
    let mounted = true;

    if (!initialSession || !initialUser) {
      (async () => {
        if (!mounted) return;
        await syncAuthState();
      })();
    }

    const unsubscribe = subscribeAuth((session) => {
      if (!mounted) return;
      void syncAuthState(session);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [initialSession, initialUser, syncAuthState]);

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
