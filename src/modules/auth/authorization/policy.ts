import { Role } from './roles.enum';
import { Permission } from './permissions';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.OWNER]: [
    Permission.BRAND_READ,
    Permission.BRAND_WRITE,
    Permission.BRANCH_READ,
    Permission.BRANCH_WRITE,
    Permission.ORDER_READ,
    Permission.ORDER_UPDATE_STATUS,
    Permission.DASHBOARD_READ,
    Permission.PRODUCT_READ,
    Permission.PRODUCT_WRITE,
    Permission.MEMBER_READ,
    Permission.MEMBER_WRITE,
  ],
  [Role.STAFF]: [
    Permission.BRAND_READ,
    Permission.BRANCH_READ,
    Permission.ORDER_READ,
    Permission.ORDER_UPDATE_STATUS,
    Permission.DASHBOARD_READ,
    Permission.PRODUCT_READ,
    // STAFF는 쓰기 권한 없음
    Permission.MEMBER_READ,
  ],
};
