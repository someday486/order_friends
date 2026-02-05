"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductOutOfStockException = exports.ProductCategoryNotFoundException = exports.ProductNotFoundException = void 0;
const common_1 = require("@nestjs/common");
const business_exception_1 = require("./business.exception");
class ProductNotFoundException extends business_exception_1.ResourceNotFoundException {
    constructor(productId) {
        super('Product', productId);
    }
}
exports.ProductNotFoundException = ProductNotFoundException;
class ProductCategoryNotFoundException extends business_exception_1.ResourceNotFoundException {
    constructor(categoryId) {
        super('Product Category', categoryId);
    }
}
exports.ProductCategoryNotFoundException = ProductCategoryNotFoundException;
class ProductOutOfStockException extends business_exception_1.BusinessException {
    constructor(productId) {
        super('Product is out of stock', 'PRODUCT_OUT_OF_STOCK', common_1.HttpStatus.CONFLICT, { productId });
    }
}
exports.ProductOutOfStockException = ProductOutOfStockException;
//# sourceMappingURL=product.exception.js.map