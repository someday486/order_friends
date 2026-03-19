'use client';

import { apiClient } from '@/lib/api-client';

type MeResponse = {
  user: {
    id: string;
    email?: string;
    role: string;
  };
  memberships: unknown[];
  ownedBrands: unknown[];
  isSystemAdmin?: boolean;
  canCreateBrand?: boolean;
};

let inFlightDestinationPromise: Promise<string> | null = null;

function isMembershipPendingError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('401') ||
    message.includes('403') ||
    message.includes('No active brand or branch memberships found') ||
    message.includes('Admin users cannot access customer area')
  );
}

export async function resolveAuthenticatedDestination(): Promise<string> {
  if (inFlightDestinationPromise) {
    return inFlightDestinationPromise;
  }

  inFlightDestinationPromise = (async () => {
    try {
      const me = await apiClient.get<MeResponse>('/me');

      if (me.isSystemAdmin || me.user.role === 'system_admin') {
        return '/admin';
      }

      const hasActiveAccess =
        me.memberships.length > 0 || me.ownedBrands.length > 0;

      if (hasActiveAccess) {
        return '/customer';
      }

      if (me.canCreateBrand) {
        return '/customer/brands';
      }

      return '/approval-pending';
    } catch (error) {
      if (isMembershipPendingError(error)) {
        return '/approval-pending';
      }

      throw error;
    } finally {
      inFlightDestinationPromise = null;
    }
  })();

  return inFlightDestinationPromise;
}
