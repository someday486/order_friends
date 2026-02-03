"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_PERMISSIONS = void 0;
const roles_enum_1 = require("./roles.enum");
const permissions_1 = require("./permissions");
exports.ROLE_PERMISSIONS = {
    [roles_enum_1.Role.OWNER]: [
        permissions_1.Permission.BRAND_READ,
        permissions_1.Permission.BRAND_WRITE,
        permissions_1.Permission.BRANCH_READ,
        permissions_1.Permission.BRANCH_WRITE,
        permissions_1.Permission.ORDER_READ,
        permissions_1.Permission.ORDER_UPDATE_STATUS,
        permissions_1.Permission.DASHBOARD_READ,
        permissions_1.Permission.PRODUCT_READ,
        permissions_1.Permission.PRODUCT_WRITE,
        permissions_1.Permission.MEMBER_READ,
        permissions_1.Permission.MEMBER_WRITE,
    ],
    [roles_enum_1.Role.STAFF]: [
        permissions_1.Permission.BRAND_READ,
        permissions_1.Permission.BRANCH_READ,
        permissions_1.Permission.ORDER_READ,
        permissions_1.Permission.ORDER_UPDATE_STATUS,
        permissions_1.Permission.DASHBOARD_READ,
        permissions_1.Permission.PRODUCT_READ,
        permissions_1.Permission.MEMBER_READ,
    ],
};
//# sourceMappingURL=policy.js.map