import { BusinessException, ResourceNotFoundException } from './business.exception';
export declare class ProductNotFoundException extends ResourceNotFoundException {
    constructor(productId: string);
}
export declare class ProductCategoryNotFoundException extends ResourceNotFoundException {
    constructor(categoryId: string);
}
export declare class ProductOutOfStockException extends BusinessException {
    constructor(productId: string);
}
