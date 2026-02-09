import { CustomerDashboardService } from './customer-dashboard.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';

describe('CustomerDashboardService', () => {
  let service: CustomerDashboardService;
  let mockSb: any;

  const makeSupabase = () => {
    mockSb = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      in: jest.fn(),
      gte: jest.fn(),
      eq: jest.fn(),
      order: jest.fn(),
      limit: jest.fn(),
    };
    return {
      adminClient: jest.fn(() => mockSb),
    };
  };

  beforeEach(() => {
    const supabase = makeSupabase();
    service = new CustomerDashboardService(supabase as SupabaseService);
    jest.clearAllMocks();
  });

  it('should return stats using branch memberships', async () => {
    mockSb.in
      .mockResolvedValueOnce({ count: 5 }) // totalOrders
      .mockReturnValueOnce(mockSb) // todayOrders branch filter
      .mockReturnValueOnce(mockSb) // pendingOrders branch filter
      .mockResolvedValueOnce({ count: 1 }) // pendingOrders status filter
      .mockReturnValueOnce(mockSb) // totalProducts branch filter
      .mockReturnValueOnce(mockSb) // brands in (empty)
      .mockReturnValueOnce(mockSb); // recentOrders branch filter

    mockSb.gte.mockResolvedValueOnce({ count: 2 }); // todayOrders result
    mockSb.eq.mockResolvedValueOnce({ count: 4 }); // totalProducts result
    mockSb.order
      .mockResolvedValueOnce({ data: [] }) // brands
      .mockReturnValueOnce(mockSb); // recentOrders
    mockSb.limit.mockResolvedValueOnce({ data: [] }); // recentOrders

    const result = await service.getDashboardStats(
      'user-1',
      [],
      [{ branch_id: 'b1' } as any],
    );

    expect(result.totalOrders).toBe(5);
    expect(result.todayOrders).toBe(2);
    expect(result.pendingOrders).toBe(1);
    expect(result.totalProducts).toBe(4);
  });

  it('should include branches from brand memberships', async () => {
    mockSb.in
      .mockResolvedValueOnce({ data: [{ id: 'b2' }] }) // branches by brandId
      .mockResolvedValueOnce({ count: 3 }) // totalOrders
      .mockReturnValueOnce(mockSb) // todayOrders branch filter
      .mockReturnValueOnce(mockSb) // pendingOrders branch filter
      .mockResolvedValueOnce({ count: 1 }) // pendingOrders status filter
      .mockReturnValueOnce(mockSb) // totalProducts branch filter
      .mockReturnValueOnce(mockSb) // brands in
      .mockReturnValueOnce(mockSb); // recentOrders branch filter

    mockSb.gte.mockResolvedValueOnce({ count: 1 }); // todayOrders result
    mockSb.eq.mockResolvedValueOnce({ count: 2 }); // totalProducts result
    mockSb.order
      .mockResolvedValueOnce({ data: [{ id: 'brand-1' }] }) // brands
      .mockReturnValueOnce(mockSb); // recentOrders
    mockSb.limit.mockResolvedValueOnce({ data: [] }); // recentOrders

    const result = await service.getDashboardStats(
      'user-1',
      [{ brand_id: 'brand-1' } as any],
      [],
    );

    expect(result.totalOrders).toBe(3);
    expect(result.brands.length).toBe(1);
  });

  it('should handle brand memberships when no branches are returned', async () => {
    mockSb.in
      .mockResolvedValueOnce({ data: null }) // branches by brandId
      .mockResolvedValueOnce({ count: 0 }) // totalOrders
      .mockReturnValueOnce(mockSb) // todayOrders branch filter
      .mockReturnValueOnce(mockSb) // pendingOrders branch filter
      .mockResolvedValueOnce({ count: 0 }) // pendingOrders status filter
      .mockReturnValueOnce(mockSb) // totalProducts branch filter
      .mockReturnValueOnce(mockSb) // brands in
      .mockReturnValueOnce(mockSb); // recentOrders branch filter

    mockSb.gte.mockResolvedValueOnce({ count: 0 }); // todayOrders result
    mockSb.eq.mockResolvedValueOnce({ count: 0 }); // totalProducts result
    mockSb.order
      .mockResolvedValueOnce({ data: [] }) // brands
      .mockReturnValueOnce(mockSb); // recentOrders
    mockSb.limit.mockResolvedValueOnce({ data: [] }); // recentOrders

    const result = await service.getDashboardStats(
      'user-1',
      [{ brand_id: 'brand-1' } as any],
      [{ branch_id: 'b1' } as any],
    );

    expect(result.myBranchesCount).toBe(1);
    expect(result.totalOrders).toBe(0);
  });
});
