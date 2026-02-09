import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';

describe('ProductsController', () => {
  let controller: ProductsController;

  const mockService = {
    getProducts: jest.fn(),
    searchProducts: jest.fn(),
    getCategories: jest.fn(),
    getProduct: jest.fn(),
    createProduct: jest.fn(),
    updateProduct: jest.fn(),
    deleteProduct: jest.fn(),
  };
  const mockGuard = { canActivate: jest.fn(() => true) };

  const makeReq = (overrides: Record<string, any> = {}) =>
    ({ accessToken: 'token', isAdmin: false, ...overrides }) as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        { provide: ProductsService, useValue: mockService },
        { provide: AuthGuard, useValue: mockGuard },
        { provide: AdminGuard, useValue: mockGuard },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockGuard)
      .overrideGuard(AdminGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<ProductsController>(ProductsController);
    jest.clearAllMocks();
  });

  it.each([
    {
      name: 'getProducts',
      call: () => controller.getProducts(makeReq(), 'branch-1'),
      mockFn: mockService.getProducts,
      args: ['token', 'branch-1', false],
    },
    {
      name: 'searchProducts',
      call: () =>
        controller.searchProducts(
          makeReq(),
          'branch-1',
          { keyword: 'coffee' } as any,
        ),
      mockFn: mockService.searchProducts,
      args: ['token', 'branch-1', { keyword: 'coffee' }, false],
    },
    {
      name: 'getCategories',
      call: () => controller.getCategories(makeReq(), 'branch-1'),
      mockFn: mockService.getCategories,
      args: ['token', 'branch-1', false],
    },
    {
      name: 'getProduct',
      call: () => controller.getProduct(makeReq(), 'product-1'),
      mockFn: mockService.getProduct,
      args: ['token', 'product-1', false],
    },
    {
      name: 'createProduct',
      call: () => controller.createProduct(makeReq(), { name: 'Latte' } as any),
      mockFn: mockService.createProduct,
      args: ['token', { name: 'Latte' }, false],
    },
    {
      name: 'updateProduct',
      call: () =>
        controller.updateProduct(makeReq(), 'product-1', { name: 'Latte' } as any),
      mockFn: mockService.updateProduct,
      args: ['token', 'product-1', { name: 'Latte' }, false],
    },
    {
      name: 'deleteProduct',
      call: () => controller.deleteProduct(makeReq(), 'product-1'),
      mockFn: mockService.deleteProduct,
      args: ['token', 'product-1', false],
    },
  ])('should call service for $name', async ({ call, mockFn, args }) => {
    mockFn.mockResolvedValue({ ok: true });

    const result = await call();

    expect(result).toEqual({ ok: true });
    expect(mockFn).toHaveBeenCalledWith(...args);
  });

  it.each([
    { name: 'getProducts', call: () => controller.getProducts(makeReq({ accessToken: undefined }), 'branch-1') },
    { name: 'searchProducts', call: () => controller.searchProducts(makeReq({ accessToken: undefined }), 'branch-1', {} as any) },
    { name: 'getCategories', call: () => controller.getCategories(makeReq({ accessToken: undefined }), 'branch-1') },
    { name: 'getProduct', call: () => controller.getProduct(makeReq({ accessToken: undefined }), 'product-1') },
    { name: 'createProduct', call: () => controller.createProduct(makeReq({ accessToken: undefined }), {} as any) },
    { name: 'updateProduct', call: () => controller.updateProduct(makeReq({ accessToken: undefined }), 'product-1', {} as any) },
    { name: 'deleteProduct', call: () => controller.deleteProduct(makeReq({ accessToken: undefined }), 'product-1') },
  ])('should throw missing access token for $name', async ({ call }) => {
    await expect(call()).rejects.toThrow('Missing access token');
  });
});
