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
const NETWORK_RETRY_DELAYS_MS = [400, 900, 1600];

function isMembershipPendingError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('401') ||
    message.includes('403') ||
    message.includes('No active brand or branch memberships found') ||
    message.includes('Admin users cannot access customer area')
  );
}

function isMeNetworkError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('API Network Error: /me');
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function getMeWithRetry(): Promise<MeResponse> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= NETWORK_RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await apiClient.get<MeResponse>('/me');
    } catch (error) {
      lastError = error;

      if (
        !isMeNetworkError(error) ||
        attempt === NETWORK_RETRY_DELAYS_MS.length
      ) {
        break;
      }

      await wait(NETWORK_RETRY_DELAYS_MS[attempt]);
    }
  }

  throw lastError;
}

export async function resolveAuthenticatedDestination(): Promise<string> {
  if (inFlightDestinationPromise) {
    return inFlightDestinationPromise;
  }

  inFlightDestinationPromise = (async () => {
    try {
      const me = await getMeWithRetry();

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
