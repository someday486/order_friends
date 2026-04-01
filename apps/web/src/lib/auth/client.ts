'use client';

import type { Session, User } from '@supabase/supabase-js';
import { supabaseBrowser } from '@/lib/supabase/client';

const SESSION_CACHE_TTL_MS = 2_000;
const BROKEN_SESSION_PATTERNS = [
  /invalid refresh token/i,
  /refresh token not found/i,
  /refresh token .* not found/i,
  /refresh token .* already used/i,
  /refresh token .* revoked/i,
  /jwt expired/i,
];

let cachedSession: Session | null = null;
let cachedSessionFetchedAt = 0;
let inFlightSessionPromise: Promise<Session | null> | null = null;
let cachedVerifiedUser: User | null = null;
let cachedVerifiedUserFetchedAt = 0;
let inFlightVerifiedUserPromise: Promise<User | null> | null = null;
let inFlightBrokenSessionRecoveryPromise: Promise<void> | null = null;

function hasFreshSessionCache() {
  return Date.now() - cachedSessionFetchedAt < SESSION_CACHE_TTL_MS;
}

function hasFreshVerifiedUserCache() {
  return Date.now() - cachedVerifiedUserFetchedAt < SESSION_CACHE_TTL_MS;
}

function clearVerifiedUserCache() {
  cachedVerifiedUser = null;
  cachedVerifiedUserFetchedAt = 0;
  inFlightVerifiedUserPromise = null;
}

function getAuthErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return 'Unknown auth error';
}

export function invalidateSessionCache() {
  cachedSession = null;
  cachedSessionFetchedAt = 0;
  inFlightSessionPromise = null;
  clearVerifiedUserCache();
}

export function seedSessionCache(session: Session | null) {
  cachedSession = session;
  cachedSessionFetchedAt = Date.now();
  inFlightSessionPromise = null;
  clearVerifiedUserCache();
}

export function seedVerifiedUserCache(user: User | null) {
  cachedVerifiedUser = user;
  cachedVerifiedUserFetchedAt = Date.now();
  inFlightVerifiedUserPromise = null;
}

export function isRecoverableAuthError(error: unknown): boolean {
  const message = getAuthErrorMessage(error);
  return BROKEN_SESSION_PATTERNS.some((pattern) => pattern.test(message));
}

export async function clearBrokenSession(): Promise<void> {
  invalidateSessionCache();

  if (inFlightBrokenSessionRecoveryPromise) {
    return inFlightBrokenSessionRecoveryPromise;
  }

  inFlightBrokenSessionRecoveryPromise = supabaseBrowser.auth
    .signOut({ scope: 'local' })
    .then(() => undefined)
    .catch((error) => {
      console.warn(
        '[auth] failed to clear broken local session:',
        getAuthErrorMessage(error),
      );
    })
    .finally(() => {
      invalidateSessionCache();
      inFlightBrokenSessionRecoveryPromise = null;
    });

  return inFlightBrokenSessionRecoveryPromise;
}

export async function recoverFromAuthError(error: unknown): Promise<boolean> {
  if (!isRecoverableAuthError(error)) {
    return false;
  }

  console.warn(
    '[auth] detected broken session, clearing local auth state:',
    getAuthErrorMessage(error),
  );
  await clearBrokenSession();
  return true;
}

export async function signOutClientSession(): Promise<void> {
  const { error } = await supabaseBrowser.auth.signOut();

  if (error) {
    if (await recoverFromAuthError(error)) {
      return;
    }

    throw error;
  }

  invalidateSessionCache();
}

export async function getInitialSession(): Promise<Session | null> {
  if (hasFreshSessionCache()) {
    return cachedSession;
  }

  if (inFlightSessionPromise) {
    return inFlightSessionPromise;
  }

  inFlightSessionPromise = (async () => {
    try {
      const { data, error } = await supabaseBrowser.auth.getSession();

      if (error) {
        if (await recoverFromAuthError(error)) {
          return null;
        }

        console.warn('[auth] getSession error:', error.message);
        cachedSession = null;
        cachedSessionFetchedAt = Date.now();
        return null;
      }

      cachedSession = data.session ?? null;
      cachedSessionFetchedAt = Date.now();
      return cachedSession;
    } catch (error) {
      if (await recoverFromAuthError(error)) {
        return null;
      }

      console.warn('[auth] getSession threw:', getAuthErrorMessage(error));
      cachedSession = null;
      cachedSessionFetchedAt = Date.now();
      return null;
    } finally {
      inFlightSessionPromise = null;
    }
  })();

  return inFlightSessionPromise;
}

export async function getVerifiedUser(): Promise<User | null> {
  if (hasFreshVerifiedUserCache()) {
    return cachedVerifiedUser;
  }

  if (inFlightVerifiedUserPromise) {
    return inFlightVerifiedUserPromise;
  }

  inFlightVerifiedUserPromise = (async () => {
    try {
      const { data, error } = await supabaseBrowser.auth.getUser();

      if (error) {
        if (await recoverFromAuthError(error)) {
          return null;
        }

        console.warn('[auth] getUser error:', error.message);
        cachedVerifiedUser = null;
        cachedVerifiedUserFetchedAt = Date.now();
        return null;
      }

      cachedVerifiedUser = data.user ?? null;
      cachedVerifiedUserFetchedAt = Date.now();
      return cachedVerifiedUser;
    } catch (error) {
      if (await recoverFromAuthError(error)) {
        return null;
      }

      console.warn('[auth] getUser threw:', getAuthErrorMessage(error));
      cachedVerifiedUser = null;
      cachedVerifiedUserFetchedAt = Date.now();
      return null;
    } finally {
      inFlightVerifiedUserPromise = null;
    }
  })();

  return inFlightVerifiedUserPromise;
}

export function subscribeAuth(
  onSession: (s: Session | null) => void,
): () => void {
  const { data } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
    cachedSession = session ?? null;
    cachedSessionFetchedAt = Date.now();
    inFlightSessionPromise = null;
    clearVerifiedUserCache();
    onSession(session ?? null);
  });
  return () => data.subscription.unsubscribe();
}
