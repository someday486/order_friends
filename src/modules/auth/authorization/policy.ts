import { Role } from './roles.enum';
import { Permission } from './permissions';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.OWNER]: [
    Permission.ORDER_READ,
    Permission.ORDER_UPDATE_STATUS,
    Permission.PRODUCT_READ,
    Permission.PRODUCT_WRITE,
    Permission.MEMBER_READ,
    Permission.MEMBER_WRITE,
  ],
  [Role.STAFF]: [
    Permission.ORDER_READ,
    Permission.ORDER_UPDATE_STATUS,
    Permission.PRODUCT_READ,
    // STAFF는 기본적으로 write 제한
    Permission.MEMBER_READ,
  ],
};
