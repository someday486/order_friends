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

function getCachedUserRole(userId: string | null) {
  if (!userId) return null;
  if (cachedUserId !== userId) return null;
  return cachedUserData;
}

function clearUserRoleCache() {
  cachedUserId = null;
  cachedUserData = null;
  inFlightUserId = null;
  inFlightUserRolePromise = null;
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
      return data;
    })
    .finally(() => {
      inFlightUserId = null;
      inFlightUserRolePromise = null;
    });

  return inFlightUserRolePromise;
}

export function useUserRole() {
  const { session, status } = useAuth();
  const userId = session?.user?.id ?? null;
  const [userData, setUserData] = useState<UserData | null>(() =>
    getCachedUserRole(userId),
  );
  const [loading, setLoading] = useState(() => {
    if (status === 'loading') return true;
    if (status !== 'authenticated' || !userId) return false;
    return !getCachedUserRole(userId);
  });
  const [error, setError] = useState<Error | null>(null);
  const hasFetchedRef = useRef(Boolean(getCachedUserRole(userId)));

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
