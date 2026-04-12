/**
 * Effective authorization roles used by guards and policy checks.
 *
 * Database membership roles remain more granular
 * (OWNER/ADMIN/MANAGER/MEMBER, BRANCH_OWNER/BRANCH_ADMIN/STAFF/VIEWER) and
 * are normalized into this smaller app-level enum by MembershipGuard.
 */
export enum Role {
  OWNER = 'OWNER',
  STAFF = 'STAFF',
}
