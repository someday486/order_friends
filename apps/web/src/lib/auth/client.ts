'use client';

import type { Session } from '@supabase/supabase-js';
import { supabaseBrowser } from '@/lib/supabase/client';

export async function getInitialSession(): Promise<Session | null> {
  const { data, error } = await supabaseBrowser.auth.getSession();
  if (error) {
    console.warn('[auth] getSession error:', error.message);
    return null;
  }
  return data.session ?? null;
}

export function subscribeAuth(
  onSession: (s: Session | null) => void,
): () => void {
  const { data } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
    onSession(session ?? null);
  });
  return () => data.subscription.unsubscribe();
}
