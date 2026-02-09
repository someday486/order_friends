import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { ProductNotFoundException } from '../../common/exceptions/product.exception';
import { BusinessException } from '../../common/exceptions/business.exception';

describe('ProductsService', () => {
  let service: ProductsService;
  let supabaseService: SupabaseService;

  const mockSupabaseClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
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
    supabaseService = module.get<SupabaseService>(SupabaseService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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

      mockSupabaseClient.order.mockResolvedValue({
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

    it('should throw BusinessException on database error', async () => {
      mockSupabaseClient.order.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(
        service.getProducts('token', 'branch-123', true),
      ).rejects.toThrow(BusinessException);
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

    it('should throw ProductNotFoundException when product not found', async () => {
      mockSupabaseClient.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(
        service.updateProduct('token', 'invalid-id', { name: 'Test' }, true),
      ).rejects.toThrow(ProductNotFoundException);
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
