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
}

export function useUserRole() {
  const { session, status } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  // 최초 1회 fetch 완료 여부 — 이후 재요청은 로딩 표시 없이 백그라운드 갱신
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    if (status === 'unauthenticated' || !session) {
      setUserData(null);
      setLoading(false);
      hasFetchedRef.current = false;
      return;
    }

    const fetchUserRole = async () => {
      try {
        // 데이터가 없을 때만 로딩 표시 (토큰 갱신 등 재요청 시 사이드바 깜빡임 방지)
        if (!hasFetchedRef.current) setLoading(true);
        const data = await apiClient.get<UserData>('/me');
        setUserData(data);
        hasFetchedRef.current = true;
      } catch (err) {
        console.error('Error fetching user role:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    void fetchUserRole();
  }, [session, status]);

  return {
    userData,
    role: userData?.user?.role || 'customer',
    loading,
    error,
  };
}
