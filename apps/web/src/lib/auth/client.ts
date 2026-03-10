'use client';

import type { Session } from '@supabase/supabase-js';
import { supabaseBrowser } from '@/lib/supabase/client';

const SESSION_CACHE_TTL_MS = 2_000;

let cachedSession: Session | null = null;
let cachedSessionFetchedAt = 0;
let inFlightSessionPromise: Promise<Session | null> | null = null;

function hasFreshSessionCache() {
  return Date.now() - cachedSessionFetchedAt < SESSION_CACHE_TTL_MS;
}

export function invalidateSessionCache() {
  cachedSession = null;
  cachedSessionFetchedAt = 0;
  inFlightSessionPromise = null;
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

export function subscribeAuth(
  onSession: (s: Session | null) => void,
): () => void {
  const { data } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
    cachedSession = session ?? null;
    cachedSessionFetchedAt = Date.now();
    inFlightSessionPromise = null;
    onSession(session ?? null);
  });
  return () => data.subscription.unsubscribe();
}
