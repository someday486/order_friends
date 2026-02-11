'use client';

import { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    if (status === 'unauthenticated' || !session) {
      setUserData(null);
      setLoading(false);
      return;
    }

    const fetchUserRole = async () => {
      try {
        setLoading(true);
        const data = await apiClient.get<UserData>('/me');
        setUserData(data);
      } catch (err) {
        console.error('Error fetching user role:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, [session, status]);

  return {
    userData,
    role: userData?.user?.role || 'customer',
    loading,
    error,
  };
}
