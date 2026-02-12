import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { ProductNotFoundException } from '../../common/exceptions/product.exception';
import { BusinessException } from '../../common/exceptions/business.exception';

describe('ProductsService', () => {
  let service: ProductsService;

  const mockSupabaseClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockReturnThis(),
  };

  const mockSupabaseService = {
    adminClient: jest.fn(() => mockSupabaseClient),
    userClient: jest.fn(() => mockSupabaseClient),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('getPriceFromRow should handle null row', () => {
    expect((service as any).getPriceFromRow(null)).toBe(0);
  });

  describe('getProducts', () => {
    it('should return list of products', async () => {
      const mockProducts = [
        {
          id: '123',
          name: 'Test Product',
          base_price: 10000,
          is_hidden: false,
          created_at: '2024-01-01',
        },
      ];

      mockSupabaseClient.order.mockResolvedValueOnce({
        data: mockProducts,
        error: null,
      });

      const result = await service.getProducts('token', 'branch-123', true);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: '123',
        name: 'Test Product',
        price: 10000,
        isActive: true,
        sortOrder: 0,
        createdAt: '2024-01-01',
      });
    });

    it('should map price fallback fields', async () => {
      const mockProducts = [
        { id: '1', name: 'A', price: 5, is_hidden: false, created_at: 't' },
        {
          id: '2',
          name: 'B',
          price_amount: 7,
          is_hidden: true,
          created_at: 't',
        },
      ];

      mockSupabaseClient.order.mockResolvedValueOnce({
        data: mockProducts,
        error: null,
      });

      const result = await service.getProducts('token', 'branch-123', true);
      expect(result[0].price).toBe(5);
      expect(result[1].price).toBe(7);
      expect(result[1].isActive).toBe(false);
    });

    it('should throw BusinessException on database error', async () => {
      mockSupabaseClient.order.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(
        service.getProducts('token', 'branch-123', true),
      ).rejects.toThrow(BusinessException);
    });

    it('should return empty list when data is null without error', async () => {
      mockSupabaseClient.order.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await service.getProducts('token', 'branch-123', true);

      expect(result).toEqual([]);
    });

    it('should use user client when isAdmin is false', async () => {
      mockSupabaseClient.order.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      await service.getProducts('token', 'branch-123', false);

      expect(mockSupabaseService.userClient).toHaveBeenCalledWith('token');
    });

    it('should map defaults when price fields are missing', async () => {
      mockSupabaseClient.order.mockResolvedValueOnce({
        data: [{ id: '1', name: 'P', is_hidden: undefined }],
        error: null,
      });

      const result = await service.getProducts('token', 'branch-123', true);
      expect(result[0].price).toBe(0);
      expect(result[0].isActive).toBe(true);
      expect(result[0].createdAt).toBe('');
    });
  });

  describe('getProduct', () => {
    it('should return product details', async () => {
      const mockProduct = {
        id: '123',
        branch_id: 'branch-123',
        name: 'Test Product',
        category_id: null,
        description: 'Test Description',
        base_price: 10000,
        image_url: null,
        is_hidden: false,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      };

      mockSupabaseClient.single.mockResolvedValue({
        data: mockProduct,
        error: null,
      });

      const result = await service.getProduct('token', '123', true);

      expect(result.id).toBe('123');
      expect(result.name).toBe('Test Product');
      expect(result.price).toBe(10000);
    });

    it('should throw ProductNotFoundException when product not found', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(
        service.getProduct('token', 'invalid-id', true),
      ).rejects.toThrow(ProductNotFoundException);
    });

    it('should throw BusinessException on fetch error', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { message: 'fail' },
      });

      await expect(service.getProduct('token', 'bad', true)).rejects.toThrow(
        BusinessException,
      );
    });

    it('should map detail defaults when optional fields missing', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: {
          id: '123',
          branch_id: 'branch-123',
          name: 'Test Product',
          category_id: null,
          description: null,
          base_price: 10000,
          image_url: null,
          is_hidden: null,
          created_at: null,
          updated_at: null,
        },
        error: null,
      });

      const result = await service.getProduct('token', '123', true);
      expect(result.isActive).toBe(true);
      expect(result.createdAt).toBe('');
      expect(result.updatedAt).toBe('');
    });
  });

  describe('searchProducts', () => {
    it('should return paginated response', async () => {
      mockSupabaseClient.range.mockResolvedValueOnce({
        data: [
          {
            id: '1',
            name: 'P',
            base_price: 10,
            is_hidden: false,
            created_at: 't',
          },
        ],
        error: null,
        count: 1,
      });

      const result = await service.searchProducts(
        'token',
        'branch-123',
        { page: 1, limit: 10 } as any,
        true,
      );
      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('should throw BusinessException on search error', async () => {
      mockSupabaseClient.range.mockResolvedValueOnce({
        data: null,
        error: { message: 'fail' },
        count: null,
      });

      await expect(
        service.searchProducts('token', 'branch-123', {} as any, true),
      ).rejects.toThrow(BusinessException);
    });

    it('should handle missing count and defaults', async () => {
      mockSupabaseClient.range.mockResolvedValueOnce({
        data: [
          {
            id: '1',
            name: 'P',
            base_price: 10,
            is_hidden: null,
            created_at: null,
          },
        ],
        error: null,
        count: null,
      });

      const result = await service.searchProducts(
        'token',
        'branch-123',
        {} as any,
        true,
      );
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
      expect(result.pagination.hasNext).toBe(false);
      expect(result.pagination.hasPrev).toBe(false);
      expect(result.data[0].createdAt).toBe('');
    });

    it('should return empty list when search data is null without error', async () => {
      mockSupabaseClient.range.mockResolvedValueOnce({
        data: null,
        error: null,
        count: 0,
      });

      const result = await service.searchProducts(
        'token',
        'branch-123',
        { page: 1, limit: 10 } as any,
        true,
      );

      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });
  });

  describe('getCategories', () => {
    it('should return categories list', async () => {
      mockSupabaseClient.order
        .mockReturnValueOnce(mockSupabaseClient)
        .mockResolvedValueOnce({
          data: [
            {
              id: 'c1',
              branch_id: 'b1',
              name: 'Cat',
              sort_order: 1,
              is_active: true,
              created_at: 't',
            },
          ],
          error: null,
        });

      const result = await service.getCategories('token', 'b1', true);
      expect(result[0].id).toBe('c1');
    });

    it('should throw on category fetch error', async () => {
      mockSupabaseClient.order
        .mockReturnValueOnce(mockSupabaseClient)
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'fail' },
        });

      await expect(service.getCategories('token', 'b1', true)).rejects.toThrow(
        '[products.getCategories]',
      );
    });

    it('should return empty list when category data is null without error', async () => {
      mockSupabaseClient.order
        .mockReturnValueOnce(mockSupabaseClient)
        .mockResolvedValueOnce({
          data: null,
          error: null,
        });

      const result = await service.getCategories('token', 'b1', true);
      expect(result).toEqual([]);
    });

    it('should map category defaults', async () => {
      mockSupabaseClient.order
        .mockReturnValueOnce(mockSupabaseClient)
        .mockResolvedValueOnce({
          data: [
            {
              id: 'c1',
              branch_id: 'b1',
              name: 'Cat',
              sort_order: null,
              is_active: null,
              created_at: null,
            },
          ],
          error: null,
        });

      const result = await service.getCategories('token', 'b1', true);
      expect(result[0].sortOrder).toBe(0);
      expect(result[0].isActive).toBe(true);
      expect(result[0].createdAt).toBe('');
    });
  });

  describe('createProduct', () => {
    it('should create product successfully', async () => {
      const createDto = {
        branchId: 'branch-123',
        name: 'New Product',
        categoryId: null,
        description: 'Description',
        price: 10000,
        imageUrl: null,
        isActive: true,
      };

      const mockCreatedProduct = {
        id: 'new-123',
        ...createDto,
        base_price: createDto.price,
        is_hidden: false,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      };

      mockSupabaseClient.single
        .mockResolvedValueOnce({
          data: { id: 'new-123' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: mockCreatedProduct,
          error: null,
        });

      const result = await service.createProduct('token', createDto, true);

      expect(result.id).toBe('new-123');
      expect(result.name).toBe('New Product');
    });

    it('should throw BusinessException on creation error', async () => {
      const createDto = {
        branchId: 'branch-123',
        name: 'New Product',
        categoryId: null,
        description: 'Description',
        price: 10000,
        imageUrl: null,
        isActive: true,
      };

      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { message: 'Creation failed' },
      });

      await expect(
        service.createProduct('token', createDto, true),
      ).rejects.toThrow(BusinessException);
    });

    it('should warn when options are provided', async () => {
      const createDto = {
        branchId: 'branch-123',
        name: 'New Product',
        categoryId: null,
        description: 'Description',
        price: 10000,
        imageUrl: null,
        isActive: true,
        options: [{ name: 'Opt' }],
      };

      const warnSpy = jest
        .spyOn((service as any).logger, 'warn')
        .mockImplementation(() => undefined);

      mockSupabaseClient.single
        .mockResolvedValueOnce({
          data: { id: 'new-123' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'new-123' },
          error: null,
        });

      await service.createProduct('token', createDto as any, true);
      expect(warnSpy).toHaveBeenCalled();
    });

    it('should handle isActive default when missing', async () => {
      const createDto = {
        branchId: 'branch-123',
        name: 'New Product',
        categoryId: null,
        description: null,
        price: 10000,
      };

      mockSupabaseClient.single
        .mockResolvedValueOnce({
          data: { id: 'new-123' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            id: 'new-123',
            branch_id: 'branch-123',
            name: 'New Product',
            base_price: 10000,
            is_hidden: false,
            created_at: 't',
            updated_at: 't',
          },
          error: null,
        });

      const result = await service.createProduct(
        'token',
        createDto as any,
        true,
      );
      expect(result.id).toBe('new-123');
    });
  });

  describe('updateProduct', () => {
    it('should update product successfully', async () => {
      const updateDto = {
        name: 'Updated Product',
        price: 15000,
      };

      const mockUpdatedProduct = {
        id: '123',
        branch_id: 'branch-123',
        name: 'Updated Product',
        base_price: 15000,
        is_hidden: false,
        created_at: '2024-01-01',
        updated_at: '2024-01-02',
      };

      mockSupabaseClient.maybeSingle.mockResolvedValueOnce({
        data: { id: '123' },
        error: null,
      });

      mockSupabaseClient.single.mockResolvedValue({
        data: mockUpdatedProduct,
        error: null,
      });

      const result = await service.updateProduct(
        'token',
        '123',
        updateDto,
        true,
      );

      expect(result.name).toBe('Updated Product');
      expect(result.price).toBe(15000);
    });

    it('should include description when provided', async () => {
      const spy = jest
        .spyOn(service, 'getProduct')
        .mockResolvedValueOnce({ id: '123', description: 'Desc' } as any);

      mockSupabaseClient.maybeSingle.mockResolvedValueOnce({
        data: { id: '123' },
        error: null,
      });

      await service.updateProduct(
        'token',
        '123',
        { description: 'Desc' } as any,
        true,
      );

      expect(mockSupabaseClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Desc',
        }),
      );
      expect(spy).toHaveBeenCalled();
    });

    it('should throw ProductNotFoundException when product not found', async () => {
      mockSupabaseClient.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(
        service.updateProduct('token', 'invalid-id', { name: 'Test' }, true),
      ).rejects.toThrow(ProductNotFoundException);
    });

    it('should return current product when no fields to update', async () => {
      const spy = jest
        .spyOn(service, 'getProduct')
        .mockResolvedValueOnce({ id: '123' } as any);

      const result = await service.updateProduct(
        'token',
        '123',
        {} as any,
        true,
      );
      expect(result.id).toBe('123');
      expect(spy).toHaveBeenCalled();
    });

    it('should throw BusinessException on update error', async () => {
      mockSupabaseClient.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'fail' },
      });

      await expect(
        service.updateProduct('token', '123', { name: 'X' }, true),
      ).rejects.toThrow(BusinessException);
    });

    it('should update isActive when provided', async () => {
      mockSupabaseClient.maybeSingle.mockResolvedValueOnce({
        data: { id: '123' },
        error: null,
      });
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          id: '123',
          branch_id: 'branch-123',
          name: 'Updated Product',
          base_price: 10000,
          is_hidden: true,
          created_at: 't',
          updated_at: 't',
        },
        error: null,
      });

      const result = await service.updateProduct(
        'token',
        '123',
        { isActive: false } as any,
        true,
      );

      expect(result.isActive).toBe(false);
    });

    it('should update category and image when provided', async () => {
      const spy = jest
        .spyOn(service, 'getProduct')
        .mockResolvedValueOnce({ id: '123' } as any);

      mockSupabaseClient.maybeSingle.mockResolvedValueOnce({
        data: { id: '123' },
        error: null,
      });

      await service.updateProduct(
        'token',
        '123',
        { name: 'Name', categoryId: 'cat-1', imageUrl: 'img.png' } as any,
        true,
      );

      expect(mockSupabaseClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Name',
          category_id: 'cat-1',
          image_url: 'img.png',
        }),
      );
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('deleteProduct', () => {
    it('should delete product successfully', async () => {
      mockSupabaseClient.eq.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await service.deleteProduct('token', '123', true);

      expect(result.deleted).toBe(true);
    });

    it('should throw BusinessException on deletion error', async () => {
      mockSupabaseClient.eq.mockResolvedValue({
        data: null,
        error: { message: 'Deletion failed' },
      });

      await expect(service.deleteProduct('token', '123', true)).rejects.toThrow(
        BusinessException,
      );
    });
  });
});
