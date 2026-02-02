import { Permission } from '../../modules/auth/authorization/permissions';
export declare const REQUIRE_PERMISSIONS_KEY = "require_permissions";
export declare const RequirePermissions: (...perms: Permission[]) => import("@nestjs/common").CustomDecorator<string>;
