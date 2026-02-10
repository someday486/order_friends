import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PublicService } from './public.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';

describe('PublicService', () => {
  let service: PublicService;
  let mockSb: any;
  let chains: Record<string, any>;

  const makeChain = () => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn(),
    order: jest.fn(),
    single: jest.fn(),
    maybeSingle: jest.fn(),
    insert: jest.fn().mockReturnThis(),
  });

  const setup = () => {
    chains = {
      branches: makeChain(),
      products: makeChain(),
      orders: makeChain(),
      order_items: makeChain(),
      order_item_options: makeChain(),
    };

    mockSb = {
      from: jest.fn((table: string) => chains[table]),
    };

    const supabase = {
      anonClient: jest.fn(() => mockSb),
    };

    service = new PublicService(supabase as SupabaseService);
  };

  beforeEach(() => {
    setup();
    jest.clearAllMocks();
  });

  it('getBranch should return branch data', async () => {
    chains.branches.single.mockResolvedValueOnce({
      data: { id: 'b1', name: 'Branch', brands: { name: 'Brand' } },
      error: null,
    });

    const result = await service.getBranch('b1');

    expect(result).toEqual({ id: 'b1', name: 'Branch', brandName: 'Brand' });
  });

  it('getBranch should map undefined brand when missing', async () => {
    chains.branches.single.mockResolvedValueOnce({
      data: { id: 'b1', name: 'Branch', brands: null },
      error: null,
    });

    const result = await service.getBranch('b1');

    expect(result.brandName).toBeUndefined();
  });

  it('getBranch should throw when missing', async () => {
    chains.branches.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'missing' },
    });

    await expect(service.getBranch('b1')).rejects.toThrow(NotFoundException);
  });

  it('getProducts should return products on first attempt', async () => {
    chains.products.order.mockResolvedValueOnce({
      data: [{ id: 'p1', name: 'P', base_price: 10 }],
      error: null,
    });

    const result = await service.getProducts('b1');

    expect(result).toEqual([
      { id: 'p1', name: 'P', description: null, price: 10, options: [] },
    ]);
  });

  it('getProducts should retry for missing columns', async () => {
    chains.products.order
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'column \"is_hidden\" does not exist' },
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'column \"is_sold_out\" does not exist' },
      })
      .mockResolvedValueOnce({
        data: [{ id: 'p1', name: 'P', price: 5 }],
        error: null,
      });

    const result = await service.getProducts('b1');

    expect(result[0].price).toBe(5);
  });

  it('getProducts should return empty list when data is null', async () => {
    chains.products.order.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const result = await service.getProducts('b1');

    expect(result).toEqual([]);
  });

  it('getProducts should throw on unrecoverable error', async () => {
    chains.products.order.mockResolvedValueOnce({
      data: null,
      error: { message: 'other' },
    });

    await expect(service.getProducts('b1')).rejects.toThrow(
      '[public.getProducts]',
    );
  });

  it('getProducts should throw when error message is missing', async () => {
    chains.products.order.mockResolvedValueOnce({
      data: null,
      error: {},
    });

    await expect(service.getProducts('b1')).rejects.toThrow(
      '[public.getProducts]',
    );
  });

  it('getPriceFromRow should handle price fallbacks', () => {
    expect((service as any).getPriceFromRow(null)).toBe(0);
    expect((service as any).getPriceFromRow({})).toBe(0);
    expect((service as any).getPriceFromRow({ base_price: 7 })).toBe(7);
    expect((service as any).getPriceFromRow({ price: 5 })).toBe(5);
    expect((service as any).getPriceFromRow({ price_amount: 3 })).toBe(3);
  });

  it('createOrder should throw on products error', async () => {
    chains.products.in.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });

    await expect(
      service.createOrder({
        branchId: 'b1',
        customerName: 'A',
        items: [{ productId: 'p1', qty: 1 }],
      } as any),
    ).rejects.toThrow('상품 조회 실패');
  });

  it('createOrder should validate product branch and status', async () => {
    chains.products.in.mockResolvedValueOnce({
      data: [
        {
          id: 'p1',
          name: 'P',
          branch_id: 'b2',
          is_hidden: false,
          is_sold_out: false,
        },
      ],
      error: null,
    });

    await expect(
      service.createOrder({
        branchId: 'b1',
        customerName: 'A',
        items: [{ productId: 'p1', qty: 1 }],
      } as any),
    ).rejects.toThrow(BadRequestException);

    chains.products.in.mockResolvedValueOnce({
      data: [
        {
          id: 'p1',
          name: 'P',
          branch_id: 'b1',
          is_hidden: true,
          is_sold_out: false,
        },
      ],
      error: null,
    });

    await expect(
      service.createOrder({
        branchId: 'b1',
        customerName: 'A',
        items: [{ productId: 'p1', qty: 1 }],
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('createOrder should reject unsupported options', async () => {
    chains.products.in.mockResolvedValueOnce({
      data: [
        {
          id: 'p1',
          name: 'P',
          branch_id: 'b1',
          is_hidden: false,
          is_sold_out: false,
        },
      ],
      error: null,
    });

    await expect(
      service.createOrder({
        branchId: 'b1',
        customerName: 'A',
        items: [{ productId: 'p1', qty: 1, options: [{ optionId: 'o1' }] }],
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('createOrder should throw when product missing in map', async () => {
    chains.products.in.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    await expect(
      service.createOrder({
        branchId: 'b1',
        customerName: 'A',
        items: [{ productId: 'p1', qty: 1 }],
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('createOrder should throw when products list is null', async () => {
    chains.products.in.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    await expect(
      service.createOrder({
        branchId: 'b1',
        customerName: 'A',
        items: [{ productId: 'p1', qty: 1 }],
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('createOrder should throw when order insert fails', async () => {
    chains.products.in.mockResolvedValueOnce({
      data: [
        {
          id: 'p1',
          name: 'P',
          branch_id: 'b1',
          is_hidden: false,
          is_sold_out: false,
          price: 10,
        },
      ],
      error: null,
    });
    chains.orders.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });

    await expect(
      service.createOrder({
        branchId: 'b1',
        customerName: 'A',
        items: [{ productId: 'p1', qty: 1 }],
      } as any),
    ).rejects.toThrow('주문 생성 실패');
  });

  it('createOrder should return order even if item insert fails', async () => {
    chains.products.in.mockResolvedValueOnce({
      data: [
        {
          id: 'p1',
          name: 'P',
          branch_id: 'b1',
          is_hidden: false,
          is_sold_out: false,
          base_price: 10,
        },
        {
          id: 'p2',
          name: 'Q',
          branch_id: 'b1',
          is_hidden: false,
          is_sold_out: false,
          base_price: 5,
        },
      ],
      error: null,
    });
    chains.orders.single.mockResolvedValueOnce({
      data: {
        id: 'o1',
        order_no: 'O-1',
        status: 'CREATED',
        total_amount: 15,
        created_at: 't',
      },
      error: null,
    });
    chains.order_items.single
      .mockResolvedValueOnce({ data: { id: 'i1' }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

    const result = await service.createOrder({
      branchId: 'b1',
      customerName: 'A',
      items: [
        { productId: 'p1', qty: 1 },
        { productId: 'p2', qty: 1 },
      ],
    } as any);

    expect(result.id).toBe('o1');
    expect(result.items.length).toBe(2);
  });

  it('createOrder should insert option snapshots when present', async () => {
    chains.products.in.mockResolvedValueOnce({
      data: [
        {
          id: 'p1',
          name: 'P',
          branch_id: 'b1',
          is_hidden: false,
          is_sold_out: false,
          price: 10,
        },
      ],
      error: null,
    });
    chains.orders.single.mockResolvedValueOnce({
      data: {
        id: 'o1',
        order_no: 'O-1',
        status: 'CREATED',
        total_amount: 10,
        created_at: 't',
      },
      error: null,
    });
    chains.order_items.single.mockResolvedValueOnce({
      data: { id: 'i1' },
      error: null,
    });
    chains.order_item_options.insert.mockResolvedValueOnce({
      data: {},
      error: null,
    });

    const originalPush = Array.prototype.push;
    Array.prototype.push = function (...args: any[]) {
      if (args[0] && Array.isArray(args[0].options)) {
        args[0].options.push({
          product_option_id: 'opt-1',
          option_name_snapshot: 'Opt',
          price_delta_snapshot: 1,
        });
      }
      return originalPush.apply(this, args as any);
    };

    try {
      const result = await service.createOrder({
        branchId: 'b1',
        customerName: 'A',
        items: [{ productId: 'p1', qty: 1 }],
      } as any);

      expect(result.items[0].name).toBe('P');
      expect(chains.order_item_options.insert).toHaveBeenCalled();
    } finally {
      Array.prototype.push = originalPush;
    }
  });

  it('getOrder should resolve by id', async () => {
    chains.orders.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'o1',
        order_no: 'O-1',
        status: 'CREATED',
        total_amount: 10,
        created_at: 't',
        order_items: [{ product_name_snapshot: 'P', qty: 1, unit_price: 10 }],
      },
      error: null,
    });

    const result = await service.getOrder('o1');
    expect(result.id).toBe('o1');
  });

  it('getOrder should handle missing order items', async () => {
    chains.orders.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'o1',
        order_no: 'O-1',
        status: 'CREATED',
        total_amount: 10,
        created_at: 't',
        order_items: undefined,
      },
      error: null,
    });

    const result = await service.getOrder('o1');
    expect(result.items).toEqual([]);
  });

  it('getOrder should resolve by orderNo when id lookup misses', async () => {
    chains.orders.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 'o2',
          order_no: 'O-2',
          status: 'CREATED',
          total_amount: 12,
          created_at: 't',
          order_items: [{ product_name_snapshot: 'Q', qty: 2, unit_price: 6 }],
        },
        error: null,
      });

    const result = await service.getOrder('O-2');
    expect(result.orderNo).toBe('O-2');
  });

  it('getOrder should throw when not found', async () => {
    chains.orders.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    await expect(service.getOrder('missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});
