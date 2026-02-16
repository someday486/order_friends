import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CustomerProductsController } from './customer-products.controller';
import { CustomerProductsService } from './customer-products.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CustomerGuard } from '../../common/guards/customer.guard';

describe('CustomerProductsController', () => {
  let controller: CustomerProductsController;

  const mockService = {
    getMyProducts: jest.fn(),
    getBrandProductTemplates: jest.fn(),
    createBrandProductTemplate: jest.fn(),
    updateBrandProductTemplate: jest.fn(),
    bulkUpdateBrandProductTemplates: jest.fn(),
    deleteBrandProductTemplate: jest.fn(),
    applyBrandTemplateToBranch: jest.fn(),
    unapplyBrandTemplateFromBranch: jest.fn(),
    getMyCategories: jest.fn(),
    createCategory: jest.fn(),
    bulkCreateCategories: jest.fn(),
    reorderCategories: jest.fn(),
    updateCategory: jest.fn(),
    deleteCategory: jest.fn(),
    reorderProducts: jest.fn(),
    getMyProduct: jest.fn(),
    createMyProduct: jest.fn(),
    updateMyProduct: jest.fn(),
    deleteMyProduct: jest.fn(),
  };
  const mockGuard = { canActivate: jest.fn(() => true) };

  const makeReq = (overrides: Record<string, any> = {}) =>
    ({
      user: { id: 'user-1' },
      brandMemberships: [],
      branchMemberships: [],
      ...overrides,
    }) as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerProductsController],
      providers: [
        { provide: CustomerProductsService, useValue: mockService },
        { provide: AuthGuard, useValue: mockGuard },
        { provide: CustomerGuard, useValue: mockGuard },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockGuard)
      .overrideGuard(CustomerGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<CustomerProductsController>(
      CustomerProductsController,
    );
    jest.clearAllMocks();
  });

  it('getProducts should call service and return result', async () => {
    mockService.getMyProducts.mockResolvedValue([{ id: 'prod-1' }]);

    const result = await controller.getProducts(makeReq(), 'branch-1');

    expect(result).toEqual([{ id: 'prod-1' }]);
    expect(mockService.getMyProducts).toHaveBeenCalledWith(
      'user-1',
      'branch-1',
      [],
      [],
    );
  });

  it('getProducts should throw when branchId is missing', async () => {
    await expect(controller.getProducts(makeReq(), '')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('getBrandTemplates should call service and return result', async () => {
    mockService.getBrandProductTemplates.mockResolvedValue([{ id: 'tpl-1' }]);

    const result = await controller.getBrandTemplates(
      makeReq(),
      'brand-1',
      'branch-1',
    );

    expect(result).toEqual([{ id: 'tpl-1' }]);
    expect(mockService.getBrandProductTemplates).toHaveBeenCalledWith(
      'user-1',
      'brand-1',
      'branch-1',
      [],
      [],
    );
  });

  it('getBrandTemplates should throw when brandId is missing', async () => {
    await expect(
      controller.getBrandTemplates(makeReq(), '', 'branch-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('createBrandTemplate should call service', async () => {
    mockService.createBrandProductTemplate.mockResolvedValue({ id: 'tpl-1' });

    const dto = {
      brandId: 'brand-1',
      name: 'Americano',
      price: 4500,
    } as any;
    const result = await controller.createBrandTemplate(makeReq(), dto);

    expect(result).toEqual({ id: 'tpl-1' });
    expect(mockService.createBrandProductTemplate).toHaveBeenCalledWith(
      'user-1',
      dto,
      [],
      [],
    );
  });

  it('createBrandTemplate should throw when brandId is missing', async () => {
    await expect(
      controller.createBrandTemplate(makeReq(), {
        name: 'Americano',
        price: 4500,
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('updateBrandTemplate should call service', async () => {
    mockService.updateBrandProductTemplate.mockResolvedValue({ id: 'tpl-1' });
    const dto = { name: 'Americano Ice' } as any;

    const result = await controller.updateBrandTemplate(
      makeReq(),
      'tpl-1',
      dto,
    );

    expect(result).toEqual({ id: 'tpl-1' });
    expect(mockService.updateBrandProductTemplate).toHaveBeenCalledWith(
      'user-1',
      'tpl-1',
      dto,
      [],
      [],
    );
  });

  it('bulkUpdateBrandTemplates should call service', async () => {
    mockService.bulkUpdateBrandProductTemplates.mockResolvedValue({
      updatedCount: 2,
    });
    const dto = {
      brandId: 'brand-1',
      templateIds: ['tpl-1', 'tpl-2'],
      branchIds: ['branch-1'],
      isActive: true,
    } as any;

    const result = await controller.bulkUpdateBrandTemplates(makeReq(), dto);

    expect(result).toEqual({ updatedCount: 2 });
    expect(mockService.bulkUpdateBrandProductTemplates).toHaveBeenCalledWith(
      'user-1',
      dto,
      [],
      [],
    );
  });

  it('bulkUpdateBrandTemplates should throw when brandId is missing', async () => {
    await expect(
      controller.bulkUpdateBrandTemplates(makeReq(), {
        templateIds: ['tpl-1'],
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('bulkUpdateBrandTemplates should throw when templateIds is missing', async () => {
    await expect(
      controller.bulkUpdateBrandTemplates(makeReq(), {
        brandId: 'brand-1',
        templateIds: [],
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('deleteBrandTemplate should call service', async () => {
    mockService.deleteBrandProductTemplate.mockResolvedValue({ deleted: true });

    const result = await controller.deleteBrandTemplate(makeReq(), 'tpl-1');

    expect(result).toEqual({ deleted: true });
    expect(mockService.deleteBrandProductTemplate).toHaveBeenCalledWith(
      'user-1',
      'tpl-1',
      [],
      [],
    );
  });

  it('applyBrandTemplateToBranch should call service', async () => {
    mockService.applyBrandTemplateToBranch.mockResolvedValue({ id: 'prod-1' });

    const result = await controller.applyBrandTemplateToBranch(
      makeReq(),
      'tpl-1',
      { branchId: 'branch-1' } as any,
    );

    expect(result).toEqual({ id: 'prod-1' });
    expect(mockService.applyBrandTemplateToBranch).toHaveBeenCalledWith(
      'user-1',
      'tpl-1',
      'branch-1',
      [],
      [],
    );
  });

  it('applyBrandTemplateToBranch should throw when branchId is missing', async () => {
    await expect(
      controller.applyBrandTemplateToBranch(makeReq(), 'tpl-1', {} as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('unapplyBrandTemplateFromBranch should call service', async () => {
    mockService.unapplyBrandTemplateFromBranch.mockResolvedValue({
      updated: 1,
    });

    const result = await controller.unapplyBrandTemplateFromBranch(
      makeReq(),
      'tpl-1',
      { branchId: 'branch-1' } as any,
    );

    expect(result).toEqual({ updated: 1 });
    expect(mockService.unapplyBrandTemplateFromBranch).toHaveBeenCalledWith(
      'user-1',
      'tpl-1',
      'branch-1',
      [],
      [],
    );
  });

  it('getCategories should call service and return result', async () => {
    mockService.getMyCategories.mockResolvedValue([{ id: 'cat-1' }]);

    const result = await controller.getCategories(makeReq(), 'branch-1');

    expect(result).toEqual([{ id: 'cat-1' }]);
    expect(mockService.getMyCategories).toHaveBeenCalledWith(
      'user-1',
      'branch-1',
      [],
      [],
    );
  });

  it('getCategories should throw when branchId is missing', async () => {
    await expect(controller.getCategories(makeReq(), '')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('createCategory should call service and return result', async () => {
    mockService.createCategory.mockResolvedValue({ id: 'cat-1' });

    const dto = {
      branchId: 'branch-1',
      name: 'Coffee',
      sortOrder: 1,
      isActive: true,
    } as any;
    const result = await controller.createCategory(makeReq(), dto);

    expect(result).toEqual({ id: 'cat-1' });
    expect(mockService.createCategory).toHaveBeenCalledWith(
      'user-1',
      'branch-1',
      'Coffee',
      1,
      true,
      [],
      [],
    );
  });

  it('createCategory should throw when branchId is missing', async () => {
    await expect(
      controller.createCategory(makeReq(), { name: 'Coffee' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('bulkCreateCategories should call service and return result', async () => {
    mockService.bulkCreateCategories.mockResolvedValue({
      created: 2,
      skipped: 0,
      categories: [{ id: 'cat-1' }, { id: 'cat-2' }],
    });

    const dto = {
      branchIds: ['branch-1', 'branch-2'],
      name: 'Coffee',
    } as any;

    const result = await controller.bulkCreateCategories(makeReq(), dto);

    expect(result).toEqual({
      created: 2,
      skipped: 0,
      categories: [{ id: 'cat-1' }, { id: 'cat-2' }],
    });
    expect(mockService.bulkCreateCategories).toHaveBeenCalledWith(
      'user-1',
      dto,
      [],
      [],
    );
  });

  it('bulkCreateCategories should throw when branchIds is missing', async () => {
    await expect(
      controller.bulkCreateCategories(makeReq(), {
        branchIds: [],
        name: 'Coffee',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('reorderCategories should call service and return result', async () => {
    mockService.reorderCategories.mockResolvedValue({ ok: true });

    const dto = {
      branchId: 'branch-1',
      items: [{ id: 'cat-1', sortOrder: 1 }],
    } as any;
    const result = await controller.reorderCategories(makeReq(), dto);

    expect(result).toEqual({ ok: true });
    expect(mockService.reorderCategories).toHaveBeenCalledWith(
      'user-1',
      'branch-1',
      dto.items,
      [],
      [],
    );
  });

  it('updateCategory should call service and return result', async () => {
    mockService.updateCategory.mockResolvedValue({ id: 'cat-1' });

    const dto = { name: 'Tea' } as any;
    const result = await controller.updateCategory(makeReq(), 'cat-1', dto);

    expect(result).toEqual({ id: 'cat-1' });
    expect(mockService.updateCategory).toHaveBeenCalledWith(
      'user-1',
      'cat-1',
      dto,
      [],
      [],
    );
  });

  it('deleteCategory should call service and return result', async () => {
    mockService.deleteCategory.mockResolvedValue({ ok: true });

    const result = await controller.deleteCategory(makeReq(), 'cat-1');

    expect(result).toEqual({ ok: true });
    expect(mockService.deleteCategory).toHaveBeenCalledWith(
      'user-1',
      'cat-1',
      [],
      [],
    );
  });

  it('reorderProducts should call service and return result', async () => {
    mockService.reorderProducts.mockResolvedValue({ ok: true });

    const dto = {
      branchId: 'branch-1',
      items: [{ id: 'prod-1', sortOrder: 1 }],
    } as any;
    const result = await controller.reorderProducts(makeReq(), dto);

    expect(result).toEqual({ ok: true });
    expect(mockService.reorderProducts).toHaveBeenCalledWith(
      'user-1',
      'branch-1',
      dto.items,
      [],
      [],
    );
  });

  it('getProduct should call service and return result', async () => {
    mockService.getMyProduct.mockResolvedValue({ id: 'prod-1' });

    const result = await controller.getProduct(makeReq(), 'prod-1');

    expect(result).toEqual({ id: 'prod-1' });
    expect(mockService.getMyProduct).toHaveBeenCalledWith(
      'user-1',
      'prod-1',
      [],
      [],
    );
  });

  it('createProduct should call service and return result', async () => {
    mockService.createMyProduct.mockResolvedValue({ id: 'prod-1' });

    const dto = { branchId: 'branch-1', name: 'Latte' } as any;
    const result = await controller.createProduct(makeReq(), dto);

    expect(result).toEqual({ id: 'prod-1' });
    expect(mockService.createMyProduct).toHaveBeenCalledWith(
      'user-1',
      dto,
      [],
      [],
    );
  });

  it('createProduct should throw when branchId is missing', async () => {
    await expect(
      controller.createProduct(makeReq(), { name: 'Latte' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('updateProduct should call service and return result', async () => {
    mockService.updateMyProduct.mockResolvedValue({ id: 'prod-1' });

    const dto = { name: 'Mocha' } as any;
    const result = await controller.updateProduct(makeReq(), 'prod-1', dto);

    expect(result).toEqual({ id: 'prod-1' });
    expect(mockService.updateMyProduct).toHaveBeenCalledWith(
      'user-1',
      'prod-1',
      dto,
      [],
      [],
    );
  });

  it('deleteProduct should call service and return result', async () => {
    mockService.deleteMyProduct.mockResolvedValue({ ok: true });

    const result = await controller.deleteProduct(makeReq(), 'prod-1');

    expect(result).toEqual({ ok: true });
    expect(mockService.deleteMyProduct).toHaveBeenCalledWith(
      'user-1',
      'prod-1',
      [],
      [],
    );
  });

  it.each([
    {
      name: 'getProducts',
      call: () =>
        controller.getProducts(makeReq({ user: undefined }), 'branch-1'),
    },
    {
      name: 'getCategories',
      call: () =>
        controller.getCategories(makeReq({ user: undefined }), 'branch-1'),
    },
    {
      name: 'createCategory',
      call: () =>
        controller.createCategory(makeReq({ user: undefined }), {
          branchId: 'branch-1',
        } as any),
    },
    {
      name: 'reorderCategories',
      call: () =>
        controller.reorderCategories(makeReq({ user: undefined }), {
          branchId: 'branch-1',
          items: [],
        } as any),
    },
    {
      name: 'updateCategory',
      call: () =>
        controller.updateCategory(
          makeReq({ user: undefined }),
          'cat-1',
          {} as any,
        ),
    },
    {
      name: 'deleteCategory',
      call: () =>
        controller.deleteCategory(makeReq({ user: undefined }), 'cat-1'),
    },
    {
      name: 'reorderProducts',
      call: () =>
        controller.reorderProducts(makeReq({ user: undefined }), {
          branchId: 'branch-1',
          items: [],
        } as any),
    },
    {
      name: 'getProduct',
      call: () => controller.getProduct(makeReq({ user: undefined }), 'prod-1'),
    },
    {
      name: 'createProduct',
      call: () =>
        controller.createProduct(makeReq({ user: undefined }), {
          branchId: 'branch-1',
        } as any),
    },
    {
      name: 'updateProduct',
      call: () =>
        controller.updateProduct(
          makeReq({ user: undefined }),
          'prod-1',
          {} as any,
        ),
    },
    {
      name: 'deleteProduct',
      call: () =>
        controller.deleteProduct(makeReq({ user: undefined }), 'prod-1'),
    },
  ])('should throw missing user for $name', async ({ call }) => {
    await expect(call()).rejects.toThrow('Missing user');
  });

  it.each([
    {
      name: 'getProducts',
      setup: () =>
        mockService.getMyProducts.mockResolvedValueOnce([{ id: 'prod-1' }]),
      call: () =>
        controller.getProducts(
          makeReq({
            brandMemberships: undefined,
            branchMemberships: undefined,
          }),
          'branch-1',
        ),
      expectCall: () =>
        expect(mockService.getMyProducts).toHaveBeenCalledWith(
          'user-1',
          'branch-1',
          [],
          [],
        ),
    },
    {
      name: 'getCategories',
      setup: () =>
        mockService.getMyCategories.mockResolvedValueOnce([{ id: 'cat-1' }]),
      call: () =>
        controller.getCategories(
          makeReq({
            brandMemberships: undefined,
            branchMemberships: undefined,
          }),
          'branch-1',
        ),
      expectCall: () =>
        expect(mockService.getMyCategories).toHaveBeenCalledWith(
          'user-1',
          'branch-1',
          [],
          [],
        ),
    },
    {
      name: 'createCategory',
      setup: () =>
        mockService.createCategory.mockResolvedValueOnce({ id: 'cat-1' }),
      call: () =>
        controller.createCategory(
          makeReq({
            brandMemberships: undefined,
            branchMemberships: undefined,
          }),
          {
            branchId: 'branch-1',
            name: 'Coffee',
            sortOrder: 1,
            isActive: true,
          } as any,
        ),
      expectCall: () =>
        expect(mockService.createCategory).toHaveBeenCalledWith(
          'user-1',
          'branch-1',
          'Coffee',
          1,
          true,
          [],
          [],
        ),
    },
    {
      name: 'reorderCategories',
      setup: () =>
        mockService.reorderCategories.mockResolvedValueOnce({ ok: true }),
      call: () =>
        controller.reorderCategories(
          makeReq({
            brandMemberships: undefined,
            branchMemberships: undefined,
          }),
          {
            branchId: 'branch-1',
            items: [{ id: 'cat-1', sortOrder: 1 }],
          } as any,
        ),
      expectCall: () =>
        expect(mockService.reorderCategories).toHaveBeenCalledWith(
          'user-1',
          'branch-1',
          [{ id: 'cat-1', sortOrder: 1 }],
          [],
          [],
        ),
    },
    {
      name: 'updateCategory',
      setup: () =>
        mockService.updateCategory.mockResolvedValueOnce({ id: 'cat-1' }),
      call: () =>
        controller.updateCategory(
          makeReq({
            brandMemberships: undefined,
            branchMemberships: undefined,
          }),
          'cat-1',
          { name: 'Tea' } as any,
        ),
      expectCall: () =>
        expect(mockService.updateCategory).toHaveBeenCalledWith(
          'user-1',
          'cat-1',
          { name: 'Tea' },
          [],
          [],
        ),
    },
    {
      name: 'deleteCategory',
      setup: () =>
        mockService.deleteCategory.mockResolvedValueOnce({ ok: true }),
      call: () =>
        controller.deleteCategory(
          makeReq({
            brandMemberships: undefined,
            branchMemberships: undefined,
          }),
          'cat-1',
        ),
      expectCall: () =>
        expect(mockService.deleteCategory).toHaveBeenCalledWith(
          'user-1',
          'cat-1',
          [],
          [],
        ),
    },
    {
      name: 'reorderProducts',
      setup: () =>
        mockService.reorderProducts.mockResolvedValueOnce({ ok: true }),
      call: () =>
        controller.reorderProducts(
          makeReq({
            brandMemberships: undefined,
            branchMemberships: undefined,
          }),
          {
            branchId: 'branch-1',
            items: [{ id: 'prod-1', sortOrder: 1 }],
          } as any,
        ),
      expectCall: () =>
        expect(mockService.reorderProducts).toHaveBeenCalledWith(
          'user-1',
          'branch-1',
          [{ id: 'prod-1', sortOrder: 1 }],
          [],
          [],
        ),
    },
    {
      name: 'getProduct',
      setup: () =>
        mockService.getMyProduct.mockResolvedValueOnce({ id: 'prod-1' }),
      call: () =>
        controller.getProduct(
          makeReq({
            brandMemberships: undefined,
            branchMemberships: undefined,
          }),
          'prod-1',
        ),
      expectCall: () =>
        expect(mockService.getMyProduct).toHaveBeenCalledWith(
          'user-1',
          'prod-1',
          [],
          [],
        ),
    },
    {
      name: 'createProduct',
      setup: () =>
        mockService.createMyProduct.mockResolvedValueOnce({ id: 'prod-1' }),
      call: () =>
        controller.createProduct(
          makeReq({
            brandMemberships: undefined,
            branchMemberships: undefined,
          }),
          { branchId: 'branch-1', name: 'Latte' } as any,
        ),
      expectCall: () =>
        expect(mockService.createMyProduct).toHaveBeenCalledWith(
          'user-1',
          { branchId: 'branch-1', name: 'Latte' },
          [],
          [],
        ),
    },
    {
      name: 'updateProduct',
      setup: () =>
        mockService.updateMyProduct.mockResolvedValueOnce({ id: 'prod-1' }),
      call: () =>
        controller.updateProduct(
          makeReq({
            brandMemberships: undefined,
            branchMemberships: undefined,
          }),
          'prod-1',
          { name: 'Mocha' } as any,
        ),
      expectCall: () =>
        expect(mockService.updateMyProduct).toHaveBeenCalledWith(
          'user-1',
          'prod-1',
          { name: 'Mocha' },
          [],
          [],
        ),
    },
    {
      name: 'deleteProduct',
      setup: () =>
        mockService.deleteMyProduct.mockResolvedValueOnce({ ok: true }),
      call: () =>
        controller.deleteProduct(
          makeReq({
            brandMemberships: undefined,
            branchMemberships: undefined,
          }),
          'prod-1',
        ),
      expectCall: () =>
        expect(mockService.deleteMyProduct).toHaveBeenCalledWith(
          'user-1',
          'prod-1',
          [],
          [],
        ),
    },
  ])(
    'should default memberships for $name',
    async ({ setup, call, expectCall }) => {
      setup();
      await call();
      expectCall();
    },
  );
});
