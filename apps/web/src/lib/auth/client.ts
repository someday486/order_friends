'use client';

import type { Session, User } from '@supabase/supabase-js';
import { supabaseBrowser } from '@/lib/supabase/client';

const SESSION_CACHE_TTL_MS = 2_000;

let cachedSession: Session | null = null;
let cachedSessionFetchedAt = 0;
let inFlightSessionPromise: Promise<Session | null> | null = null;
let cachedVerifiedUser: User | null = null;
let cachedVerifiedUserFetchedAt = 0;
let inFlightVerifiedUserPromise: Promise<User | null> | null = null;

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

export async function getInitialSession(): Promise<Session | null> {
  if (hasFreshSessionCache()) {
    return cachedSession;
  }

  if (inFlightSessionPromise) {
    return inFlightSessionPromise;
  }

  inFlightSessionPromise = supabaseBrowser.auth
    .getSession()
    .then(({ data, error }) => {
      if (error) {
        console.warn('[auth] getSession error:', error.message);
        cachedSession = null;
        cachedSessionFetchedAt = Date.now();
        return null;
      }

      cachedSession = data.session ?? null;
      cachedSessionFetchedAt = Date.now();
      return cachedSession;
    })
    .finally(() => {
      inFlightSessionPromise = null;
    });

  return inFlightSessionPromise;
}

export async function getVerifiedUser(): Promise<User | null> {
  if (hasFreshVerifiedUserCache()) {
    return cachedVerifiedUser;
  }

  if (inFlightVerifiedUserPromise) {
    return inFlightVerifiedUserPromise;
  }

  inFlightVerifiedUserPromise = supabaseBrowser.auth
    .getUser()
    .then(({ data, error }) => {
      if (error) {
        console.warn('[auth] getUser error:', error.message);
        cachedVerifiedUser = null;
        cachedVerifiedUserFetchedAt = Date.now();
        return null;
      }

      cachedVerifiedUser = data.user ?? null;
      cachedVerifiedUserFetchedAt = Date.now();
      return cachedVerifiedUser;
    })
    .finally(() => {
      inFlightVerifiedUserPromise = null;
    });

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
