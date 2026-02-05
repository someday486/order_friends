import { HttpStatus } from '@nestjs/common';
import { BusinessException, ResourceNotFoundException } from './business.exception';

/**
 * 상품을 찾을 수 없을 때
 */
export class ProductNotFoundException extends ResourceNotFoundException {
  constructor(productId: string) {
    super('Product', productId);
  }
}

/**
 * 카테고리를 찾을 수 없을 때
 */
export class ProductCategoryNotFoundException extends ResourceNotFoundException {
  constructor(categoryId: string) {
    super('Product Category', categoryId);
  }
}

/**
 * 상품이 품절 상태일 때
 */
export class ProductOutOfStockException extends BusinessException {
  constructor(productId: string) {
    super(
      'Product is out of stock',
      'PRODUCT_OUT_OF_STOCK',
      HttpStatus.CONFLICT,
      { productId },
    );
  }
}
