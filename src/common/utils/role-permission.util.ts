/**
 * 역할 기반 수정 권한 체크 유틸리티
 *
 * 브랜드 레벨 역할: OWNER, ADMIN, MANAGER, MEMBER
 * 브랜치 레벨 역할: BRANCH_OWNER, BRANCH_ADMIN, STAFF, VIEWER
 */

/** 상품/재고 수정 가능 역할 */
const PRODUCT_INVENTORY_WRITE_ROLES = [
  'OWNER',
  'ADMIN',
  'BRANCH_OWNER',
  'BRANCH_ADMIN',
];

/** 주문 수정 가능 역할 (스태프 포함) */
const ORDER_WRITE_ROLES = [...PRODUCT_INVENTORY_WRITE_ROLES, 'STAFF'];

export function canModifyProductOrInventory(role: string): boolean {
  return PRODUCT_INVENTORY_WRITE_ROLES.includes(role);
}

export function canModifyOrder(role: string): boolean {
  return ORDER_WRITE_ROLES.includes(role);
}
