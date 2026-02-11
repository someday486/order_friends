"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canModifyProductOrInventory = canModifyProductOrInventory;
exports.canModifyOrder = canModifyOrder;
const PRODUCT_INVENTORY_WRITE_ROLES = [
    'OWNER',
    'ADMIN',
    'BRANCH_OWNER',
    'BRANCH_ADMIN',
];
const ORDER_WRITE_ROLES = [...PRODUCT_INVENTORY_WRITE_ROLES, 'STAFF'];
function canModifyProductOrInventory(role) {
    return PRODUCT_INVENTORY_WRITE_ROLES.includes(role);
}
function canModifyOrder(role) {
    return ORDER_WRITE_ROLES.includes(role);
}
//# sourceMappingURL=role-permission.util.js.map