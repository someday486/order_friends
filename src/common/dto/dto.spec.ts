import { plainToInstance } from 'class-transformer';
import { PaginationDto, PaginationMeta } from './pagination.dto';
import { SearchDto, ProductSearchDto, OrderSearchDto } from './search.dto';
import {
  CreateProductOptionDto,
  CreateProductRequest,
} from '../../modules/products/dto/create-product.request';
import {
  CreateCategoryRequest,
  UpdateCategoryRequest,
  ReorderCategoriesRequest,
  ReorderCategoryItem,
} from '../../modules/products/dto/category-crud.request';
import {
  ReorderProductsRequest,
  ReorderItem,
} from '../../modules/products/dto/reorder-products.request';
import {
  CreatePublicOrderRequest as CreatePublicOrderDto,
  OrderItemDto,
  OrderItemOptionDto,
  PublicBranchResponse,
  PublicProductResponse,
  PublicOrderResponse,
} from '../../modules/public/dto/public.dto';
import {
  CreatePublicOrderRequest as CreatePublicOrderV2,
  PaymentMethod,
  PublicCategoryResponse,
  OrderItemOptionDto as PublicOrderItemOptionDto,
} from '../../modules/public-order/dto/public-order.dto';

describe('DTO defaults and constructors', () => {
  it('PaginationDto should apply default values', () => {
    const dto = new PaginationDto();
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
  });

  it('PaginationMeta should compute pagination flags', () => {
    const meta = new PaginationMeta(2, 10, 25);
    expect(meta.totalPages).toBe(3);
    expect(meta.hasNext).toBe(true);
    expect(meta.hasPrev).toBe(true);
  });

  it('Search DTOs should construct with defaults', () => {
    const base = new SearchDto();
    expect(base.page).toBe(1);
    expect(base.limit).toBe(20);

    const prod = new ProductSearchDto();
    expect(prod.page).toBe(1);

    const order = new OrderSearchDto();
    expect(order.limit).toBe(20);
  });

  it('Search DTOs should transform numeric fields', () => {
    const product = plainToInstance(ProductSearchDto, {
      page: '2',
      limit: '5',
      minPrice: '10',
      maxPrice: '20',
    });

    const order = plainToInstance(OrderSearchDto, {
      page: '3',
      limit: '7',
      minAmount: '100',
      maxAmount: '200',
    });

    expect(product.page).toBe(2);
    expect(product.limit).toBe(5);
    expect(product.minPrice).toBe(10);
    expect(product.maxPrice).toBe(20);
    expect(order.page).toBe(3);
    expect(order.limit).toBe(7);
    expect(order.minAmount).toBe(100);
    expect(order.maxAmount).toBe(200);
  });

  it('Product request DTOs should set option defaults', () => {
    const opt = new CreateProductOptionDto();
    expect(opt.priceDelta).toBe(0);
    expect(opt.isActive).toBe(true);
    expect(opt.sortOrder).toBe(0);

    const req = new CreateProductRequest();
    expect(req.isActive).toBe(true);
    expect(req.sortOrder).toBe(0);
  });

  it('Product request DTOs should transform nested options', () => {
    const req = plainToInstance(CreateProductRequest, {
      branchId: 'b1',
      name: 'Product',
      categoryId: 'c1',
      price: 10,
      options: [{ name: 'Opt', priceDelta: 2, isActive: true, sortOrder: 1 }],
    });

    expect(req.options?.[0]).toBeInstanceOf(CreateProductOptionDto);
    expect(req.options?.[0].priceDelta).toBe(2);
    expect(req.options?.[0].sortOrder).toBe(1);
  });

  it('Category request DTOs should instantiate', () => {
    const create = new CreateCategoryRequest();
    const update = new UpdateCategoryRequest();
    const reorder = new ReorderCategoriesRequest();
    const item = new ReorderCategoryItem();
    expect(create).toBeDefined();
    expect(update).toBeDefined();
    expect(reorder).toBeDefined();
    expect(item).toBeDefined();
  });

  it('Category request DTOs should transform nested items', () => {
    const reorder = plainToInstance(ReorderCategoriesRequest, {
      branchId: 'b1',
      items: [{ id: 'c1', sortOrder: 2 }],
    });
    expect(reorder.items[0]).toBeInstanceOf(ReorderCategoryItem);
    expect(reorder.items[0].sortOrder).toBe(2);
  });

  it('Reorder products DTOs should instantiate', () => {
    const item = new ReorderItem();
    const req = new ReorderProductsRequest();
    expect(item).toBeDefined();
    expect(req).toBeDefined();
  });

  it('Reorder products DTOs should transform nested items', () => {
    const req = plainToInstance(ReorderProductsRequest, {
      branchId: 'b1',
      items: [{ id: 'p1', sortOrder: 2 }],
    });

    expect(req.items[0]).toBeInstanceOf(ReorderItem);
    expect(req.items[0].sortOrder).toBe(2);
  });

  it('PaginationDto should transform numeric fields', () => {
    const dto = plainToInstance(PaginationDto, { page: '4', limit: '9' });
    expect(dto.page).toBe(4);
    expect(dto.limit).toBe(9);
  });

  it('Public DTOs should instantiate', () => {
    const dto = new CreatePublicOrderDto();
    const item = new OrderItemDto();
    const option = new OrderItemOptionDto();
    const branch = new PublicBranchResponse();
    const product = new PublicProductResponse();
    const order = new PublicOrderResponse();
    expect(dto).toBeDefined();
    expect(item).toBeDefined();
    expect(option).toBeDefined();
    expect(branch).toBeDefined();
    expect(product).toBeDefined();
    expect(order).toBeDefined();
  });

  it('Public DTOs should transform nested items', () => {
    const dto = plainToInstance(CreatePublicOrderDto, {
      branchId: 'b1',
      customerName: 'A',
      items: [{ productId: 'p1', qty: 1, options: [{ optionId: 'o1' }] }],
    });
    expect(dto.items[0]).toBeInstanceOf(OrderItemDto);
    expect(dto.items[0].options?.[0]).toBeInstanceOf(OrderItemOptionDto);
  });

  it('Public order DTO should set default payment method', () => {
    const dto = new CreatePublicOrderV2();
    expect(dto.paymentMethod).toBe(PaymentMethod.CARD);
  });

  it('Public order DTO should transform nested items', () => {
    const dto = plainToInstance(CreatePublicOrderV2, {
      branchId: 'b1',
      customerName: 'A',
      items: [{ productId: 'p1', qty: 1, options: [{ optionId: 'o1' }] }],
    });
    expect(dto.items[0].options?.[0]).toBeInstanceOf(PublicOrderItemOptionDto);
  });

  it('Public order DTO responses should instantiate', () => {
    const category = new PublicCategoryResponse();
    expect(category).toBeDefined();
  });
});
