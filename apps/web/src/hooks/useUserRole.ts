'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';

export type UserRole = 'system_admin' | 'brand_owner' | 'branch_manager' | 'staff' | 'customer';

export interface UserData {
  user: {
    id: string;
    email?: string;
    role: UserRole;
  };
  memberships: any[];
  ownedBrands: any[];
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

    // Fetch user role from /me endpoint
    const fetchUserRole = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/me`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          },
        );

        if (!response.ok) {
          throw new Error('Failed to fetch user data');
        }

        const data = await response.json();
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
