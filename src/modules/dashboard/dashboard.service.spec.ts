import { DashboardService } from './dashboard.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let mockSb: any;

  const makeSupabase = () => {
    mockSb = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn(),
      in: jest.fn(),
      gte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn(),
    };
    return {
      adminClient: jest.fn(() => mockSb),
      userClient: jest.fn(() => mockSb),
    };
  };

  beforeEach(() => {
    const supabase = makeSupabase();
    service = new DashboardService(supabase as SupabaseService);
    jest.clearAllMocks();
  });

  it('should return zeros when no branches found', async () => {
    mockSb.eq.mockResolvedValueOnce({ data: [], error: null });

    const result = await service.getStats('token', 'brand-1', true);

    expect(result.totalOrders).toBe(0);
    expect(result.totalBranches).toBe(0);
    expect(result.recentOrders).toEqual([]);
  });

  it('should throw when branch lookup fails', async () => {
    mockSb.eq.mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

    await expect(service.getStats('token', 'brand-1', true)).rejects.toThrow(
      /dashboard.getStats/,
    );
  });

  it('should return aggregated stats', async () => {
    // branch lookup
    mockSb.eq
      .mockResolvedValueOnce({ data: [{ id: 'b1' }], error: null }) // branches for brand
      .mockResolvedValueOnce({ count: 1, error: null }); // total branches

    mockSb.in
      .mockResolvedValueOnce({ count: 10 }) // totalOrders
      .mockReturnValueOnce(mockSb) // pendingOrders status filter
      .mockResolvedValueOnce({ count: 3 }) // pendingOrders result
      .mockResolvedValueOnce({ count: 2 }) // todayOrders result
      .mockResolvedValueOnce({ count: 7 }) // totalProducts
      .mockReturnValueOnce(mockSb); // recentOrders chain

    mockSb.gte.mockReturnValueOnce(mockSb); // todayOrders date filter

    mockSb.limit.mockResolvedValueOnce({
      data: [
        {
          id: 'o1',
          order_no: 'O-1',
          status: 'CREATED',
          total_amount: 100,
          created_at: '2024-01-01',
        },
      ],
    });

    const result = await service.getStats('token', 'brand-1', true);

    expect(result.totalOrders).toBe(10);
    expect(result.pendingOrders).toBe(3);
    expect(result.todayOrders).toBe(2);
    expect(result.totalProducts).toBe(7);
    expect(result.totalBranches).toBe(1);
    expect(result.recentOrders).toHaveLength(1);
  });
});
