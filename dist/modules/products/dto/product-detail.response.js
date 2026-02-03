"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductDetailResponse = exports.ProductOptionResponse = void 0;
class ProductOptionResponse {
    id;
    name;
    priceDelta;
    isActive;
    sortOrder;
}
exports.ProductOptionResponse = ProductOptionResponse;
class ProductDetailResponse {
    id;
    branchId;
    name;
    description;
    price;
    isActive;
    sortOrder;
    createdAt;
    updatedAt;
    options;
}
exports.ProductDetailResponse = ProductDetailResponse;
//# sourceMappingURL=product-detail.response.js.map