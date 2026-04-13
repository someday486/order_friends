'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { apiClient } from '@/lib/api-client';

export type UserRole =
  | 'system_admin'
  | 'brand_owner'
  | 'branch_manager'
  | 'staff'
  | 'customer';

export interface UserData {
  user: {
    id: string;
    email?: string;
    role: UserRole;
  };
  memberships: Array<{
    brandId: string;
    branchId?: string;
    role: string;
  }>;
  ownedBrands: Array<{
    id: string;
    name: string;
  }>;
  canCreateBrand?: boolean;
}

let cachedUserId: string | null = null;
let cachedUserData: UserData | null = null;
let inFlightUserId: string | null = null;
let inFlightUserRolePromise: Promise<UserData | null> | null = null;
const USER_ROLE_CACHE_KEY = 'orderfriends:user-role-cache';
const USER_ROLE_CACHE_TTL_MS = 60_000;

type StoredUserRoleCache = {
  userId: string;
  userData: UserData;
  expiresAt: number;
};

function readStoredUserRoleCache(userId: string | null): UserData | null {
  if (!userId || typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(USER_ROLE_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredUserRoleCache;
    if (
      parsed.userId !== userId ||
      !parsed.userData ||
      parsed.expiresAt <= Date.now()
    ) {
      window.localStorage.removeItem(USER_ROLE_CACHE_KEY);
      return null;
    }

    return parsed.userData;
  } catch {
    window.localStorage.removeItem(USER_ROLE_CACHE_KEY);
    return null;
  }
}

function writeStoredUserRoleCache(userId: string, userData: UserData) {
  if (typeof window === 'undefined') return;

  const payload: StoredUserRoleCache = {
    userId,
    userData,
    expiresAt: Date.now() + USER_ROLE_CACHE_TTL_MS,
  };

  try {
    window.localStorage.setItem(USER_ROLE_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota/private mode failures and keep in-memory cache only.
  }
}

function clearStoredUserRoleCache() {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(USER_ROLE_CACHE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

function getCachedUserRole(userId: string | null) {
  if (!userId) return null;
  if (cachedUserId === userId && cachedUserData) {
    return cachedUserData;
  }

  const stored = readStoredUserRoleCache(userId);
  if (!stored) return null;

  cachedUserId = userId;
  cachedUserData = stored;
  return stored;
}

function clearUserRoleCache() {
  cachedUserId = null;
  cachedUserData = null;
  inFlightUserId = null;
  inFlightUserRolePromise = null;
  clearStoredUserRoleCache();
}

async function fetchUserRoleData(userId: string): Promise<UserData | null> {
  const cached = getCachedUserRole(userId);
  if (cached) {
    return cached;
  }

  if (inFlightUserId === userId && inFlightUserRolePromise) {
    return inFlightUserRolePromise;
  }

  inFlightUserId = userId;
  inFlightUserRolePromise = apiClient
    .get<UserData>('/me')
    .then((data) => {
      cachedUserId = userId;
      cachedUserData = data;
      writeStoredUserRoleCache(userId, data);
      return data;
    })
    .finally(() => {
      inFlightUserId = null;
      inFlightUserRolePromise = null;
    });

  return inFlightUserRolePromise;
}

export function useUserRole() {
  const { user, status } = useAuth();
  const userId = user?.id ?? null;
  const initialUserData = getCachedUserRole(userId);
  const [userData, setUserData] = useState<UserData | null>(initialUserData);
  const [loading, setLoading] = useState(() => {
    if (status === 'loading') return true;
    if (status === 'unauthenticated' || !userId) return false;
    return initialUserData === null;
  });
  const [error, setError] = useState<Error | null>(null);
  const hasFetchedRef = useRef(Boolean(initialUserData));

  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    if (status === 'unauthenticated' || !userId) {
      clearUserRoleCache();
      setUserData(null);
      setLoading(false);
      setError(null);
      hasFetchedRef.current = false;
      return;
    }

    const cached = getCachedUserRole(userId);
    if (cached) {
      setUserData(cached);
      setLoading(false);
      hasFetchedRef.current = true;
    } else if (!hasFetchedRef.current) {
      setLoading(true);
    }

    const fetchUserRole = async () => {
      try {
        setError(null);
        const data = await fetchUserRoleData(userId);
        if (data) {
          setUserData(data);
          hasFetchedRef.current = true;
        }
      } catch (err) {
        console.error('Error fetching user role:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    void fetchUserRole();
  }, [userId, status]);

  return {
    userData,
    role: userData?.user?.role || 'customer',
    loading,
    error,
  };
}
