import { QueryBuilder } from './query-builder.util';
import { ProductSearchDto, OrderSearchDto } from '../dto/search.dto';

describe('QueryBuilder', () => {
  let mockSupabase: any;
  let mockQuery: any;

  beforeEach(() => {
    mockQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
    };

    mockSupabase = {
      from: jest.fn().mockReturnValue(mockQuery),
    };
  });

  describe('buildProductSearchQuery', () => {
    it('should build basic product query with branch filter', () => {
      const searchDto: ProductSearchDto = {};
      const branchId = 'branch-123';

      QueryBuilder.buildProductSearchQuery(mockSupabase, branchId, searchDto);

      expect(mockSupabase.from).toHaveBeenCalledWith('products');
      expect(mockQuery.select).toHaveBeenCalledWith('*', { count: 'exact' });
      expect(mockQuery.eq).toHaveBeenCalledWith('branch_id', branchId);
    });

    it('should add text search filter when q parameter is provided', () => {
      const searchDto: ProductSearchDto = {
        q: '샘플 상품',
      };

      QueryBuilder.buildProductSearchQuery(
        mockSupabase,
        'branch-123',
        searchDto,
      );

      expect(mockQuery.or).toHaveBeenCalledWith(
        'name.ilike.%샘플 상품%,description.ilike.%샘플 상품%',
      );
    });

    it('should add category filter when category is provided', () => {
      const searchDto: ProductSearchDto = {
        category: 'category-456',
      };

      QueryBuilder.buildProductSearchQuery(
        mockSupabase,
        'branch-123',
        searchDto,
      );

      expect(mockQuery.eq).toHaveBeenCalledWith('category', 'category-456');
    });

    it('should add price range filters when provided', () => {
      const searchDto: ProductSearchDto = {
        minPrice: 1000,
        maxPrice: 5000,
      };

      QueryBuilder.buildProductSearchQuery(
        mockSupabase,
        'branch-123',
        searchDto,
      );

      expect(mockQuery.gte).toHaveBeenCalledWith('price', 1000);
      expect(mockQuery.lte).toHaveBeenCalledWith('price', 5000);
    });

    it('should filter by stock status when inStock is true', () => {
      const searchDto: ProductSearchDto = {
        inStock: true,
      };

      QueryBuilder.buildProductSearchQuery(
        mockSupabase,
        'branch-123',
        searchDto,
      );

      expect(mockQuery.gt).toHaveBeenCalledWith('stock_qty', 0);
    });

    it('should apply sorting when sortBy is provided', () => {
      const searchDto: ProductSearchDto = {
        sortBy: 'price',
        sortOrder: 'desc',
      };

      QueryBuilder.buildProductSearchQuery(
        mockSupabase,
        'branch-123',
        searchDto,
      );

      expect(mockQuery.order).toHaveBeenCalledWith('price', {
        ascending: false,
      });
    });

    it('should default to created_at desc when no sort is specified', () => {
      const searchDto: ProductSearchDto = {};

      QueryBuilder.buildProductSearchQuery(
        mockSupabase,
        'branch-123',
        searchDto,
      );

      expect(mockQuery.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      });
    });

    it('should apply pagination when page and limit are provided', () => {
      const searchDto: ProductSearchDto = {
        page: 2,
        limit: 20,
      };

      QueryBuilder.buildProductSearchQuery(
        mockSupabase,
        'branch-123',
        searchDto,
      );

      expect(mockQuery.range).toHaveBeenCalledWith(20, 39);
    });

    it('should combine multiple filters correctly', () => {
      const searchDto: ProductSearchDto = {
        q: '샘플',
        category: 'cat-1',
        minPrice: 1000,
        maxPrice: 5000,
        inStock: true,
        sortBy: 'name',
        sortOrder: 'asc',
        page: 1,
        limit: 10,
      };

      QueryBuilder.buildProductSearchQuery(
        mockSupabase,
        'branch-123',
        searchDto,
      );

      expect(mockQuery.or).toHaveBeenCalledWith(
        'name.ilike.%샘플%,description.ilike.%샘플%',
      );
      expect(mockQuery.eq).toHaveBeenCalledWith('category', 'cat-1');
      expect(mockQuery.gte).toHaveBeenCalledWith('price', 1000);
      expect(mockQuery.lte).toHaveBeenCalledWith('price', 5000);
      expect(mockQuery.gt).toHaveBeenCalledWith('stock_qty', 0);
      expect(mockQuery.order).toHaveBeenCalledWith('name', {
        ascending: true,
      });
      expect(mockQuery.range).toHaveBeenCalledWith(0, 9);
    });
  });

  describe('buildOrderSearchQuery', () => {
    beforeEach(() => {
      mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
      };

      mockSupabase = {
        from: jest.fn().mockReturnValue(mockQuery),
      };
    });

    it('should build basic order query with branch filter', () => {
      const searchDto: OrderSearchDto = {};
      const branchId = 'branch-123';

      QueryBuilder.buildOrderSearchQuery(mockSupabase, branchId, searchDto);

      expect(mockSupabase.from).toHaveBeenCalledWith('orders');
      expect(mockQuery.select).toHaveBeenCalledWith('*', { count: 'exact' });
      expect(mockQuery.eq).toHaveBeenCalledWith('branch_id', branchId);
    });

    it('should add text search filter for order number and customer name', () => {
      const searchDto: OrderSearchDto = {
        q: 'ORD-123',
      };

      QueryBuilder.buildOrderSearchQuery(mockSupabase, 'branch-123', searchDto);

      expect(mockQuery.or).toHaveBeenCalledWith(
        'order_no.ilike.%ORD-123%,customer_name.ilike.%ORD-123%,customer_phone.ilike.%ORD-123%',
      );
    });

    it('should add status filter when provided', () => {
      const searchDto: OrderSearchDto = {
        status: 'CONFIRMED',
      };

      QueryBuilder.buildOrderSearchQuery(mockSupabase, 'branch-123', searchDto);

      expect(mockQuery.eq).toHaveBeenCalledWith('status', 'CONFIRMED');
    });

    it('should add customer name filter when provided', () => {
      const searchDto: OrderSearchDto = {
        customerName: 'Kim',
      };

      QueryBuilder.buildOrderSearchQuery(mockSupabase, 'branch-123', searchDto);

      expect(mockQuery.ilike).toHaveBeenCalledWith('customer_name', '%Kim%');
    });

    it('should add date range filters when provided', () => {
      const searchDto: OrderSearchDto = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };

      QueryBuilder.buildOrderSearchQuery(mockSupabase, 'branch-123', searchDto);

      expect(mockQuery.gte).toHaveBeenCalledWith('created_at', '2024-01-01');
      expect(mockQuery.lt).toHaveBeenCalledWith('created_at', '2024-02-01');
    });

    it('should add amount range filters when provided', () => {
      const searchDto: OrderSearchDto = {
        minAmount: 1000,
        maxAmount: 5000,
      };

      QueryBuilder.buildOrderSearchQuery(mockSupabase, 'branch-123', searchDto);

      expect(mockQuery.gte).toHaveBeenCalledWith('total_amount', 1000);
      expect(mockQuery.lte).toHaveBeenCalledWith('total_amount', 5000);
    });

    it('should apply sorting and pagination', () => {
      const searchDto: OrderSearchDto = {
        sortBy: 'total_amount',
        sortOrder: 'asc',
        page: 3,
        limit: 15,
      };

      QueryBuilder.buildOrderSearchQuery(mockSupabase, 'branch-123', searchDto);

      expect(mockQuery.order).toHaveBeenCalledWith('total_amount', {
        ascending: true,
      });
      expect(mockQuery.range).toHaveBeenCalledWith(30, 44);
    });

    it('should combine multiple order filters correctly', () => {
      const searchDto: OrderSearchDto = {
        q: '홍길동',
        status: 'PENDING',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        sortBy: 'created_at',
        sortOrder: 'desc',
        page: 1,
        limit: 25,
      };

      QueryBuilder.buildOrderSearchQuery(mockSupabase, 'branch-123', searchDto);

      expect(mockQuery.or).toHaveBeenCalledWith(
        'order_no.ilike.%홍길동%,customer_name.ilike.%홍길동%,customer_phone.ilike.%홍길동%',
      );
      expect(mockQuery.eq).toHaveBeenCalledWith('status', 'PENDING');
      expect(mockQuery.gte).toHaveBeenCalledWith('created_at', '2024-01-01');
      expect(mockQuery.lt).toHaveBeenCalledWith('created_at', '2025-01-01');
      expect(mockQuery.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      });
      expect(mockQuery.range).toHaveBeenCalledWith(0, 24);
    });
  });

  describe('buildGenericSearchQuery', () => {
    it('should apply ilike filter on given field', () => {
      const query = { ilike: jest.fn().mockReturnThis() };

      QueryBuilder.buildGenericSearchQuery(query as any, 'name', 'foo');

      expect(query.ilike).toHaveBeenCalledWith('name', '%foo%');
    });
  });
});
