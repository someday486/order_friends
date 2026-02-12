import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import {
  SalesAnalyticsResponse,
  RevenueByDayDto,
  ProductAnalyticsResponse,
  TopProductDto,
  SalesByProductDto,
  InventoryTurnoverDto,
  OrderAnalyticsResponse,
  OrderStatusDistributionDto,
  OrdersByDayDto,
  PeakHoursDto,
  CustomerAnalyticsResponse,
  PeriodComparisonDto,
  BrandSalesAnalyticsResponse,
  BranchBreakdownDto,
  AbcAnalysisItemDto,
  AbcAnalysisResponse,
  HourlyProductDto,
  HourlyTopProductDto,
  HourlyProductAnalysisResponse,
  ProductCombinationDto,
  CombinationAnalysisResponse,
  CohortRowDto,
  CohortRetentionDto,
  CohortAnalysisResponse,
  RfmCustomerDto,
  RfmAnalysisResponse,
  RfmSegmentSummaryDto,
} from './dto/analytics.dto';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Resolve latest product names by id.
   * Falls back to snapshot names when product row no longer exists.
   */
  private async getLatestProductNames(
    productIds: string[],
  ): Promise<Map<string, string>> {
    const idMap = new Map<string, string>();
    const ids = Array.from(
      new Set(productIds.filter((id) => Boolean(id) && id !== 'unknown')),
    );

    if (ids.length === 0) return idMap;

    const sb = this.supabase.adminClient();
    const chunkSize = 100;
    const concurrency = 4;
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += chunkSize) {
      chunks.push(ids.slice(i, i + chunkSize));
    }

    for (let i = 0; i < chunks.length; i += concurrency) {
      const chunkGroup = chunks.slice(i, i + concurrency);
      const results = await Promise.all(
        chunkGroup.map((chunk) =>
          sb.from('products').select('id, name').in('id', chunk),
        ),
      );

      results.forEach(({ data, error }) => {
        if (error) {
          this.logger.warn(
            `Failed to resolve product names: ${error.message}`,
            error,
          );
          return;
        }

        (data || []).forEach((row: { id: string; name: string | null }) => {
          if (row.id && row.name) {
            idMap.set(row.id, row.name);
          }
        });
      });
    }

    return idMap;
  }

  /**
   * Parse date range from query parameters
   */
  private getDateRange(startDate?: string, endDate?: string) {
    let start: Date;
    let end: Date;

    if (startDate) {
      start = new Date(startDate);
    } else {
      // Default: 30 days ago
      start = new Date();
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
    }

    if (endDate) {
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    } else {
      // Default: today
      end = new Date();
      end.setHours(23, 59, 59, 999);
    }

    return {
      start: start.toISOString(),
      end: end.toISOString(),
      days: Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      ),
    };
  }

  /**
   * Calculate previous period of equal length
   */
  private getPreviousPeriod(
    startDate?: string,
    endDate?: string,
  ): { start: string; end: string } {
    const current = this.getDateRange(startDate, endDate);
    const durationMs =
      new Date(current.end).getTime() - new Date(current.start).getTime();

    const prevEnd = new Date(new Date(current.start).getTime() - 1);
    prevEnd.setHours(23, 59, 59, 999);
    const prevStart = new Date(prevEnd.getTime() - durationMs);
    prevStart.setHours(0, 0, 0, 0);

    return {
      start: prevStart.toISOString(),
      end: prevEnd.toISOString(),
    };
  }

  /**
   * Calculate percentage change between two values
   */
  private calcChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return parseFloat((((current - previous) / previous) * 100).toFixed(1));
  }

  /**
   * Wrap result in PeriodComparisonDto if compare is enabled
   */
  private async withComparison<T extends Record<string, any>>(
    compare: boolean | undefined,
    currentData: T,
    fetchPrevious: () => Promise<T>,
    changeKeys: string[],
  ): Promise<PeriodComparisonDto<T>> {
    if (!compare) {
      return { current: currentData };
    }

    const previous = await fetchPrevious();
    const changes: Record<string, number> = {};
    for (const key of changeKeys) {
      if (
        typeof currentData[key] === 'number' &&
        typeof previous[key] === 'number'
      ) {
        changes[key] = this.calcChange(currentData[key], previous[key]);
      }
    }

    return { current: currentData, previous, changes };
  }

  /**
   * Get sales analytics
   */
  async getSalesAnalytics(
    accessToken: string,
    branchId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<SalesAnalyticsResponse> {
    this.logger.log(`Fetching sales analytics for branch: ${branchId}`);
    const sb = this.supabase.adminClient();
    const dateRange = this.getDateRange(startDate, endDate);

    try {
      // Get orders within date range
      const { data: orders, error } = await sb
        .from('orders')
        .select('id, total_amount, created_at, status')
        .eq('branch_id', branchId)
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end)
        .in('status', [
          'COMPLETED',
          'READY',
          'PREPARING',
          'CONFIRMED',
          'CREATED',
        ]);

      if (error) {
        this.logger.error(
          `Failed to fetch sales analytics: ${error.message}`,
          error,
        );
        throw new BusinessException(
          'Failed to fetch sales analytics',
          'SALES_ANALYTICS_FAILED',
          500,
          { branchId, error: error.message },
        );
      }

      const orderList = orders || [];
      const orderCount = orderList.length;
      const totalRevenue = orderList.reduce(
        (sum, order) => sum + (order.total_amount || 0),
        0,
      );
      const avgOrderValue =
        orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0;

      // Group by day
      const revenueByDayMap = new Map<
        string,
        { revenue: number; count: number }
      >();
      orderList.forEach((order) => {
        const date = new Date(order.created_at).toISOString().split('T')[0];
        const current = revenueByDayMap.get(date) || { revenue: 0, count: 0 };
        current.revenue += order.total_amount || 0;
        current.count += 1;
        revenueByDayMap.set(date, current);
      });

      const revenueByDay: RevenueByDayDto[] = Array.from(
        revenueByDayMap.entries(),
      )
        .map(([date, data]) => ({
          date,
          revenue: data.revenue,
          orderCount: data.count,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        totalRevenue,
        orderCount,
        avgOrderValue,
        revenueByDay,
      };
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      this.logger.error('Unexpected error in getSalesAnalytics', error);
      throw new BusinessException(
        'Failed to fetch sales analytics',
        'SALES_ANALYTICS_ERROR',
        500,
      );
    }
  }

  /**
   * Get product analytics
   */
  async getProductAnalytics(
    accessToken: string,
    branchId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<ProductAnalyticsResponse> {
    this.logger.log(`Fetching product analytics for branch: ${branchId}`);
    const sb = this.supabase.adminClient();
    const dateRange = this.getDateRange(startDate, endDate);

    try {
      // Get order items with product info
      const { data: orderItems, error } = await sb
        .from('order_items')
        .select(
          `
          id,
          product_id,
          product_name_snapshot,
          qty,
          unit_price_snapshot,
          order:orders!inner(id, status, created_at, branch_id)
        `,
        )
        .eq('order.branch_id', branchId)
        .gte('order.created_at', dateRange.start)
        .lte('order.created_at', dateRange.end)
        .in('order.status', ['COMPLETED', 'READY', 'PREPARING', 'CONFIRMED']);

      if (error) {
        this.logger.error(
          `Failed to fetch product analytics: ${error.message}`,
          error,
        );
        throw new BusinessException(
          'Failed to fetch product analytics',
          'PRODUCT_ANALYTICS_FAILED',
          500,
          { branchId, error: error.message },
        );
      }

      const items = orderItems || [];

      // Aggregate by product
      const productMap = new Map<
        string,
        { name: string; qty: number; revenue: number }
      >();
      items.forEach((item: any) => {
        const productId = item.product_id || 'unknown';
        const productName = item.product_name_snapshot || 'Unknown Product';
        const qty = item.qty || 0;
        const revenue = (item.qty || 0) * (item.unit_price_snapshot || 0);

        const current = productMap.get(productId) || {
          name: productName,
          qty: 0,
          revenue: 0,
        };
        current.qty += qty;
        current.revenue += revenue;
        productMap.set(productId, current);
      });

      const totalRevenue = Array.from(productMap.values()).reduce(
        (sum, p) => sum + p.revenue,
        0,
      );

      // Top products by revenue
      const topProducts: TopProductDto[] = Array.from(productMap.entries())
        .map(([productId, data]) => ({
          productId,
          productName: data.name,
          soldQuantity: data.qty,
          totalRevenue: data.revenue,
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 10);

      // Sales by product with percentage
      const salesByProduct: SalesByProductDto[] = Array.from(
        productMap.entries(),
      )
        .map(([productId, data]) => ({
          productId,
          productName: data.name,
          quantity: data.qty,
          revenue: data.revenue,
          revenuePercentage:
            totalRevenue > 0
              ? parseFloat(((data.revenue / totalRevenue) * 100).toFixed(2))
              : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue);

      // Inventory turnover (simplified calculation)
      const totalQuantitySold = Array.from(productMap.values()).reduce(
        (sum, p) => sum + p.qty,
        0,
      );
      const averageTurnoverRate =
        dateRange.days > 0
          ? parseFloat((totalQuantitySold / dateRange.days).toFixed(2))
          : 0;

      const inventoryTurnover: InventoryTurnoverDto = {
        averageTurnoverRate,
        periodDays: dateRange.days,
      };

      return {
        topProducts,
        salesByProduct,
        inventoryTurnover,
      };
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      this.logger.error('Unexpected error in getProductAnalytics', error);
      throw new BusinessException(
        'Failed to fetch product analytics',
        'PRODUCT_ANALYTICS_ERROR',
        500,
      );
    }
  }

  /**
   * Get order analytics
   */
  async getOrderAnalytics(
    accessToken: string,
    branchId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<OrderAnalyticsResponse> {
    this.logger.log(`Fetching order analytics for branch: ${branchId}`);
    const sb = this.supabase.adminClient();
    const dateRange = this.getDateRange(startDate, endDate);

    try {
      // Get orders within date range
      const { data: orders, error } = await sb
        .from('orders')
        .select('id, status, created_at')
        .eq('branch_id', branchId)
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end);

      if (error) {
        this.logger.error(
          `Failed to fetch order analytics: ${error.message}`,
          error,
        );
        throw new BusinessException(
          'Failed to fetch order analytics',
          'ORDER_ANALYTICS_FAILED',
          500,
          { branchId, error: error.message },
        );
      }

      const orderList = orders || [];
      const totalOrders = orderList.length;

      // Status distribution
      const statusMap = new Map<string, number>();
      orderList.forEach((order) => {
        const status = order.status || 'UNKNOWN';
        statusMap.set(status, (statusMap.get(status) || 0) + 1);
      });

      const statusDistribution: OrderStatusDistributionDto[] = Array.from(
        statusMap.entries(),
      )
        .map(([status, count]) => ({
          status,
          count,
          percentage: parseFloat(((count / totalOrders) * 100).toFixed(2)),
        }))
        .sort((a, b) => b.count - a.count);

      // Orders by day
      const ordersByDayMap = new Map<
        string,
        { total: number; completed: number; cancelled: number }
      >();
      orderList.forEach((order) => {
        const date = new Date(order.created_at).toISOString().split('T')[0];
        const current = ordersByDayMap.get(date) || {
          total: 0,
          completed: 0,
          cancelled: 0,
        };
        current.total += 1;
        if (order.status === 'COMPLETED') current.completed += 1;
        if (order.status === 'CANCELLED') current.cancelled += 1;
        ordersByDayMap.set(date, current);
      });

      const ordersByDay: OrdersByDayDto[] = Array.from(ordersByDayMap.entries())
        .map(([date, data]) => ({
          date,
          orderCount: data.total,
          completedCount: data.completed,
          cancelledCount: data.cancelled,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Peak hours
      const hourMap = new Map<number, number>();
      orderList.forEach((order) => {
        const hour = new Date(order.created_at).getHours();
        hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
      });

      const peakHours: PeakHoursDto[] = Array.from(hourMap.entries())
        .map(([hour, count]) => ({
          hour,
          orderCount: count,
        }))
        .sort((a, b) => a.hour - b.hour);

      return {
        statusDistribution,
        ordersByDay,
        peakHours,
      };
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      this.logger.error('Unexpected error in getOrderAnalytics', error);
      throw new BusinessException(
        'Failed to fetch order analytics',
        'ORDER_ANALYTICS_ERROR',
        500,
      );
    }
  }

  /**
   * Get customer analytics
   */
  async getCustomerAnalytics(
    accessToken: string,
    branchId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<CustomerAnalyticsResponse> {
    this.logger.log(`Fetching customer analytics for branch: ${branchId}`);
    const sb = this.supabase.adminClient();
    const dateRange = this.getDateRange(startDate, endDate);

    try {
      // Get all orders for the branch
      const { data: allOrders, error: allOrdersError } = await sb
        .from('orders')
        .select('id, customer_phone, total_amount, created_at, status')
        .eq('branch_id', branchId)
        .in('status', [
          'COMPLETED',
          'READY',
          'PREPARING',
          'CONFIRMED',
          'CREATED',
        ]);

      if (allOrdersError) {
        this.logger.error(
          `Failed to fetch customer analytics: ${allOrdersError.message}`,
          allOrdersError,
        );
        throw new BusinessException(
          'Failed to fetch customer analytics',
          'CUSTOMER_ANALYTICS_FAILED',
          500,
          { branchId, error: allOrdersError.message },
        );
      }

      const allOrdersList = allOrders || [];

      // Get orders within date range
      const { data: periodOrders, error: periodError } = await sb
        .from('orders')
        .select('id, customer_phone, total_amount, created_at, status')
        .eq('branch_id', branchId)
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end)
        .in('status', [
          'COMPLETED',
          'READY',
          'PREPARING',
          'CONFIRMED',
          'CREATED',
        ]);

      if (periodError) {
        this.logger.error(
          `Failed to fetch period orders: ${periodError.message}`,
          periodError,
        );
        throw new BusinessException(
          'Failed to fetch customer analytics',
          'CUSTOMER_ANALYTICS_FAILED',
          500,
          { branchId, error: periodError.message },
        );
      }

      const periodOrdersList = periodOrders || [];

      // Aggregate by customer (using phone as unique identifier)
      const customerMap = new Map<
        string,
        { orderCount: number; totalSpent: number }
      >();
      allOrdersList.forEach((order) => {
        const phone = order.customer_phone || 'anonymous';
        const current = customerMap.get(phone) || {
          orderCount: 0,
          totalSpent: 0,
        };
        current.orderCount += 1;
        current.totalSpent += order.total_amount || 0;
        customerMap.set(phone, current);
      });

      // New customers in period
      const newCustomerPhones = new Set<string>();
      periodOrdersList.forEach((order) => {
        const phone = order.customer_phone || 'anonymous';
        // Check if this is their first order
        const firstOrder = allOrdersList
          .filter((o) => o.customer_phone === phone)
          .sort(
            (a, b) =>
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime(),
          )[0];

        if (
          firstOrder &&
          new Date(firstOrder.created_at) >= new Date(dateRange.start) &&
          new Date(firstOrder.created_at) <= new Date(dateRange.end)
        ) {
          newCustomerPhones.add(phone);
        }
      });

      // Returning customers (more than 1 order)
      const returningCustomers = Array.from(customerMap.values()).filter(
        (c) => c.orderCount > 1,
      ).length;

      // CLV calculation
      const totalCustomers = customerMap.size;
      const totalRevenue = Array.from(customerMap.values()).reduce(
        (sum, c) => sum + c.totalSpent,
        0,
      );
      const clv =
        totalCustomers > 0 ? Math.round(totalRevenue / totalCustomers) : 0;

      // Repeat customer rate
      const repeatCustomerRate =
        totalCustomers > 0
          ? parseFloat(((returningCustomers / totalCustomers) * 100).toFixed(2))
          : 0;

      // Average orders per customer
      const totalOrders = allOrdersList.length;
      const avgOrdersPerCustomer =
        totalCustomers > 0
          ? parseFloat((totalOrders / totalCustomers).toFixed(2))
          : 0;

      return {
        totalCustomers,
        newCustomers: newCustomerPhones.size,
        returningCustomers,
        clv,
        repeatCustomerRate,
        avgOrdersPerCustomer,
      };
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      this.logger.error('Unexpected error in getCustomerAnalytics', error);
      throw new BusinessException(
        'Failed to fetch customer analytics',
        'CUSTOMER_ANALYTICS_ERROR',
        500,
      );
    }
  }

  // ============================================================
  // Brand-level analytics
  // ============================================================

  /**
   * Get brand-level sales analytics with optional period comparison
   */
  async getBrandSalesAnalytics(
    accessToken: string,
    brandId: string,
    startDate?: string,
    endDate?: string,
    compare?: boolean,
  ): Promise<PeriodComparisonDto<BrandSalesAnalyticsResponse>> {
    this.logger.log(`Fetching brand sales analytics for brand: ${brandId}`);

    const fetchForPeriod = async (
      start: string,
      end: string,
    ): Promise<BrandSalesAnalyticsResponse> => {
      const sb = this.supabase.adminClient();

      // Get orders for the brand
      const { data: orders, error } = await sb
        .from('orders')
        .select('id, total_amount, created_at, status, branch_id')
        .eq('brand_id', brandId)
        .gte('created_at', start)
        .lte('created_at', end)
        .in('status', [
          'COMPLETED',
          'READY',
          'PREPARING',
          'CONFIRMED',
          'CREATED',
        ]);

      if (error) {
        throw new BusinessException(
          'Failed to fetch brand sales analytics',
          'BRAND_SALES_ANALYTICS_FAILED',
          500,
          { brandId, error: error.message },
        );
      }

      // Get branch names
      const { data: branches } = await sb
        .from('branches')
        .select('id, name')
        .eq('brand_id', brandId);

      const branchNameMap = new Map(
        (branches || []).map((b: any) => [b.id, b.name]),
      );

      const orderList = orders || [];
      const orderCount = orderList.length;
      const totalRevenue = orderList.reduce(
        (sum, o) => sum + (o.total_amount || 0),
        0,
      );
      const avgOrderValue =
        orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0;

      // Group by day
      const revenueByDayMap = new Map<
        string,
        { revenue: number; count: number }
      >();
      // Group by branch
      const branchMap = new Map<
        string,
        { revenue: number; orderCount: number }
      >();

      orderList.forEach((order) => {
        const date = new Date(order.created_at).toISOString().split('T')[0];
        const dayData = revenueByDayMap.get(date) || {
          revenue: 0,
          count: 0,
        };
        dayData.revenue += order.total_amount || 0;
        dayData.count += 1;
        revenueByDayMap.set(date, dayData);

        const bid = order.branch_id || 'unknown';
        const bData = branchMap.get(bid) || { revenue: 0, orderCount: 0 };
        bData.revenue += order.total_amount || 0;
        bData.orderCount += 1;
        branchMap.set(bid, bData);
      });

      const revenueByDay: RevenueByDayDto[] = Array.from(
        revenueByDayMap.entries(),
      )
        .map(([date, data]) => ({
          date,
          revenue: data.revenue,
          orderCount: data.count,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const byBranch: BranchBreakdownDto[] = Array.from(branchMap.entries())
        .map(([branchId, data]) => ({
          branchId,
          branchName: branchNameMap.get(branchId) || branchId,
          revenue: data.revenue,
          orderCount: data.orderCount,
        }))
        .sort((a, b) => b.revenue - a.revenue);

      return {
        totalRevenue,
        orderCount,
        avgOrderValue,
        revenueByDay,
        byBranch,
      };
    };

    try {
      const dateRange = this.getDateRange(startDate, endDate);
      const currentData = await fetchForPeriod(dateRange.start, dateRange.end);

      return this.withComparison(
        compare,
        currentData,
        async () => {
          const prev = this.getPreviousPeriod(startDate, endDate);
          return fetchForPeriod(prev.start, prev.end);
        },
        ['totalRevenue', 'orderCount', 'avgOrderValue'],
      );
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      this.logger.error('Unexpected error in getBrandSalesAnalytics', error);
      throw new BusinessException(
        'Failed to fetch brand sales analytics',
        'BRAND_SALES_ANALYTICS_ERROR',
        500,
      );
    }
  }

  /**
   * Get brand-level product analytics with optional period comparison
   */
  async getBrandProductAnalytics(
    accessToken: string,
    brandId: string,
    startDate?: string,
    endDate?: string,
    compare?: boolean,
  ): Promise<PeriodComparisonDto<ProductAnalyticsResponse>> {
    this.logger.log(`Fetching brand product analytics for brand: ${brandId}`);

    const fetchForPeriod = async (
      start: string,
      end: string,
    ): Promise<ProductAnalyticsResponse> => {
      const sb = this.supabase.adminClient();
      const days = Math.ceil(
        (new Date(end).getTime() - new Date(start).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      const targetStatuses = ['COMPLETED', 'READY', 'PREPARING', 'CONFIRMED'];
      // Keep URL/query length safe for PostgREST `.in(...)` calls.
      const batchSize = 100;
      const batchConcurrency = 4;

      // 1) Fetch order ids first (indexed by brand_id + created_at + status)
      const { data: orders, error: ordersError } = await sb
        .from('orders')
        .select('id')
        .eq('brand_id', brandId)
        .gte('created_at', start)
        .lte('created_at', end)
        .in('status', targetStatuses);

      if (ordersError) {
        throw new BusinessException(
          'Failed to fetch brand product analytics',
          'BRAND_PRODUCT_ANALYTICS_FAILED',
          500,
          { brandId, error: ordersError.message },
        );
      }

      const orderIds = (orders || []).map((order) => order.id);
      if (orderIds.length === 0) {
        return {
          topProducts: [],
          salesByProduct: [],
          inventoryTurnover: {
            averageTurnoverRate: 0,
            periodDays: days,
          },
        };
      }

      // 2) Fetch order_items in batches by order_id (uses order_items.order_id index)
      const items: Array<{
        product_id: string | null;
        product_name_snapshot: string | null;
        qty: number | null;
        unit_price_snapshot: number | null;
      }> = [];

      const orderIdBatches: string[][] = [];
      for (let i = 0; i < orderIds.length; i += batchSize) {
        orderIdBatches.push(orderIds.slice(i, i + batchSize));
      }

      for (let i = 0; i < orderIdBatches.length; i += batchConcurrency) {
        const batchGroup = orderIdBatches.slice(i, i + batchConcurrency);
        const batchResults = await Promise.all(
          batchGroup.map((batchIds) =>
            sb
              .from('order_items')
              .select(
                'product_id, product_name_snapshot, qty, unit_price_snapshot',
              )
              .in('order_id', batchIds),
          ),
        );

        batchResults.forEach(({ data: batchItems, error: batchError }) => {
          if (batchError) {
            throw new BusinessException(
              'Failed to fetch brand product analytics',
              'BRAND_PRODUCT_ANALYTICS_FAILED',
              500,
              { brandId, error: batchError.message },
            );
          }

          if (batchItems?.length) {
            items.push(...batchItems);
          }
        });
      }

      const productMap = new Map<
        string,
        { name: string; qty: number; revenue: number }
      >();

      items.forEach((item) => {
        const productId = item.product_id || 'unknown';
        const productName = item.product_name_snapshot || 'Unknown Product';
        const qty = item.qty || 0;
        const revenue = qty * (item.unit_price_snapshot || 0);
        const current = productMap.get(productId) || {
          name: productName,
          qty: 0,
          revenue: 0,
        };
        current.qty += qty;
        current.revenue += revenue;
        productMap.set(productId, current);
      });

      const totalRevenue = Array.from(productMap.values()).reduce(
        (sum, p) => sum + p.revenue,
        0,
      );
      const latestNames = await this.getLatestProductNames(
        Array.from(productMap.keys()),
      );

      const topProducts: TopProductDto[] = Array.from(productMap.entries())
        .map(([productId, data]) => ({
          productId,
          productName: latestNames.get(productId) || data.name,
          soldQuantity: data.qty,
          totalRevenue: data.revenue,
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 10);

      const salesByProduct: SalesByProductDto[] = Array.from(
        productMap.entries(),
      )
        .map(([productId, data]) => ({
          productId,
          productName: latestNames.get(productId) || data.name,
          quantity: data.qty,
          revenue: data.revenue,
          revenuePercentage:
            totalRevenue > 0
              ? parseFloat(((data.revenue / totalRevenue) * 100).toFixed(2))
              : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue);

      const totalQuantitySold = Array.from(productMap.values()).reduce(
        (sum, p) => sum + p.qty,
        0,
      );

      return {
        topProducts,
        salesByProduct,
        inventoryTurnover: {
          averageTurnoverRate:
            days > 0 ? parseFloat((totalQuantitySold / days).toFixed(2)) : 0,
          periodDays: days,
        },
      };
    };

    try {
      const dateRange = this.getDateRange(startDate, endDate);
      if (!compare) {
        const currentData = await fetchForPeriod(
          dateRange.start,
          dateRange.end,
        );
        return { current: currentData };
      }

      const prev = this.getPreviousPeriod(startDate, endDate);
      const [currentData, previousData] = await Promise.all([
        fetchForPeriod(dateRange.start, dateRange.end),
        fetchForPeriod(prev.start, prev.end),
      ]);

      return {
        current: currentData,
        previous: previousData,
        changes: {},
      };
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      this.logger.error('Unexpected error in getBrandProductAnalytics', error);
      throw new BusinessException(
        'Failed to fetch brand product analytics',
        'BRAND_PRODUCT_ANALYTICS_ERROR',
        500,
      );
    }
  }

  /**
   * Get brand-level order analytics with optional period comparison
   */
  async getBrandOrderAnalytics(
    accessToken: string,
    brandId: string,
    startDate?: string,
    endDate?: string,
    compare?: boolean,
  ): Promise<PeriodComparisonDto<OrderAnalyticsResponse>> {
    this.logger.log(`Fetching brand order analytics for brand: ${brandId}`);

    const fetchForPeriod = async (
      start: string,
      end: string,
    ): Promise<OrderAnalyticsResponse> => {
      const sb = this.supabase.adminClient();

      const { data: orders, error } = await sb
        .from('orders')
        .select('id, status, created_at')
        .eq('brand_id', brandId)
        .gte('created_at', start)
        .lte('created_at', end);

      if (error) {
        throw new BusinessException(
          'Failed to fetch brand order analytics',
          'BRAND_ORDER_ANALYTICS_FAILED',
          500,
          { brandId, error: error.message },
        );
      }

      const orderList = orders || [];
      const totalOrders = orderList.length;

      const statusMap = new Map<string, number>();
      const ordersByDayMap = new Map<
        string,
        { total: number; completed: number; cancelled: number }
      >();
      const hourMap = new Map<number, number>();

      orderList.forEach((order) => {
        const status = order.status || 'UNKNOWN';
        statusMap.set(status, (statusMap.get(status) || 0) + 1);

        const date = new Date(order.created_at).toISOString().split('T')[0];
        const dayData = ordersByDayMap.get(date) || {
          total: 0,
          completed: 0,
          cancelled: 0,
        };
        dayData.total += 1;
        if (status === 'COMPLETED') dayData.completed += 1;
        if (status === 'CANCELLED') dayData.cancelled += 1;
        ordersByDayMap.set(date, dayData);

        const hour = new Date(order.created_at).getHours();
        hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
      });

      return {
        statusDistribution: Array.from(statusMap.entries())
          .map(([status, count]) => ({
            status,
            count,
            percentage:
              totalOrders > 0
                ? parseFloat(((count / totalOrders) * 100).toFixed(2))
                : 0,
          }))
          .sort((a, b) => b.count - a.count),
        ordersByDay: Array.from(ordersByDayMap.entries())
          .map(([date, data]) => ({
            date,
            orderCount: data.total,
            completedCount: data.completed,
            cancelledCount: data.cancelled,
          }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        peakHours: Array.from(hourMap.entries())
          .map(([hour, count]) => ({ hour, orderCount: count }))
          .sort((a, b) => a.hour - b.hour),
      };
    };

    try {
      const dateRange = this.getDateRange(startDate, endDate);
      const currentData = await fetchForPeriod(dateRange.start, dateRange.end);

      return this.withComparison(
        compare,
        currentData,
        async () => {
          const prev = this.getPreviousPeriod(startDate, endDate);
          return fetchForPeriod(prev.start, prev.end);
        },
        [],
      );
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      this.logger.error('Unexpected error in getBrandOrderAnalytics', error);
      throw new BusinessException(
        'Failed to fetch brand order analytics',
        'BRAND_ORDER_ANALYTICS_ERROR',
        500,
      );
    }
  }

  /**
   * Get brand-level customer analytics with optional period comparison
   */
  async getBrandCustomerAnalytics(
    accessToken: string,
    brandId: string,
    startDate?: string,
    endDate?: string,
    compare?: boolean,
  ): Promise<PeriodComparisonDto<CustomerAnalyticsResponse>> {
    this.logger.log(`Fetching brand customer analytics for brand: ${brandId}`);

    const fetchForPeriod = async (
      periodStart: string,
      periodEnd: string,
    ): Promise<CustomerAnalyticsResponse> => {
      const sb = this.supabase.adminClient();
      const validStatuses = [
        'COMPLETED',
        'READY',
        'PREPARING',
        'CONFIRMED',
        'CREATED',
      ];

      const { data: allOrders, error: allErr } = await sb
        .from('orders')
        .select('id, customer_phone, total_amount, created_at, status')
        .eq('brand_id', brandId)
        .in('status', validStatuses);

      if (allErr) {
        throw new BusinessException(
          'Failed to fetch brand customer analytics',
          'BRAND_CUSTOMER_ANALYTICS_FAILED',
          500,
          { brandId, error: allErr.message },
        );
      }

      const { data: periodOrders, error: periodErr } = await sb
        .from('orders')
        .select('id, customer_phone, total_amount, created_at, status')
        .eq('brand_id', brandId)
        .gte('created_at', periodStart)
        .lte('created_at', periodEnd)
        .in('status', validStatuses);

      if (periodErr) {
        throw new BusinessException(
          'Failed to fetch brand customer analytics',
          'BRAND_CUSTOMER_ANALYTICS_FAILED',
          500,
          { brandId, error: periodErr.message },
        );
      }

      const allOrdersList = allOrders || [];
      const periodOrdersList = periodOrders || [];

      const customerMap = new Map<
        string,
        { orderCount: number; totalSpent: number }
      >();
      allOrdersList.forEach((order) => {
        const phone = order.customer_phone || 'anonymous';
        const c = customerMap.get(phone) || { orderCount: 0, totalSpent: 0 };
        c.orderCount += 1;
        c.totalSpent += order.total_amount || 0;
        customerMap.set(phone, c);
      });

      const newCustomerPhones = new Set<string>();
      periodOrdersList.forEach((order) => {
        const phone = order.customer_phone || 'anonymous';
        const firstOrder = allOrdersList
          .filter((o) => o.customer_phone === phone)
          .sort(
            (a, b) =>
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime(),
          )[0];

        if (
          firstOrder &&
          new Date(firstOrder.created_at) >= new Date(periodStart) &&
          new Date(firstOrder.created_at) <= new Date(periodEnd)
        ) {
          newCustomerPhones.add(phone);
        }
      });

      const returningCustomers = Array.from(customerMap.values()).filter(
        (c) => c.orderCount > 1,
      ).length;

      const totalCustomers = customerMap.size;
      const totalRevenue = Array.from(customerMap.values()).reduce(
        (sum, c) => sum + c.totalSpent,
        0,
      );
      const clv =
        totalCustomers > 0 ? Math.round(totalRevenue / totalCustomers) : 0;
      const repeatCustomerRate =
        totalCustomers > 0
          ? parseFloat(((returningCustomers / totalCustomers) * 100).toFixed(2))
          : 0;
      const avgOrdersPerCustomer =
        totalCustomers > 0
          ? parseFloat((allOrdersList.length / totalCustomers).toFixed(2))
          : 0;

      return {
        totalCustomers,
        newCustomers: newCustomerPhones.size,
        returningCustomers,
        clv,
        repeatCustomerRate,
        avgOrdersPerCustomer,
      };
    };

    try {
      const dateRange = this.getDateRange(startDate, endDate);
      const currentData = await fetchForPeriod(dateRange.start, dateRange.end);

      return this.withComparison(
        compare,
        currentData,
        async () => {
          const prev = this.getPreviousPeriod(startDate, endDate);
          return fetchForPeriod(prev.start, prev.end);
        },
        [
          'totalCustomers',
          'newCustomers',
          'returningCustomers',
          'clv',
          'repeatCustomerRate',
        ],
      );
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      this.logger.error('Unexpected error in getBrandCustomerAnalytics', error);
      throw new BusinessException(
        'Failed to fetch brand customer analytics',
        'BRAND_CUSTOMER_ANALYTICS_ERROR',
        500,
      );
    }
  }

  // ============================================================
  // 심화 분석: 상품
  // ============================================================

  /**
   * ABC 분석 (매출 기여도 상위/중위/하위 분류)
   */
  async getAbcAnalysis(
    branchId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<AbcAnalysisResponse> {
    this.logger.log(`Fetching ABC analysis for branch: ${branchId}`);
    const sb = this.supabase.adminClient();
    const dateRange = this.getDateRange(startDate, endDate);

    try {
      const { data: orderItems, error } = await sb
        .from('order_items')
        .select(
          `product_id, product_name_snapshot, qty, unit_price_snapshot,
           order:orders!inner(id, status, created_at, branch_id)`,
        )
        .eq('order.branch_id', branchId)
        .gte('order.created_at', dateRange.start)
        .lte('order.created_at', dateRange.end)
        .in('order.status', ['COMPLETED', 'READY', 'PREPARING', 'CONFIRMED']);

      if (error) {
        throw new BusinessException(
          'Failed to fetch ABC analysis',
          'ABC_ANALYSIS_FAILED',
          500,
          { branchId, error: error.message },
        );
      }

      const items = orderItems || [];
      const productMap = new Map<string, { name: string; revenue: number }>();

      items.forEach((item: any) => {
        const pid = item.product_id || 'unknown';
        const cur = productMap.get(pid) || {
          name: item.product_name_snapshot || 'Unknown',
          revenue: 0,
        };
        cur.revenue += (item.qty || 0) * (item.unit_price_snapshot || 0);
        productMap.set(pid, cur);
      });

      const totalRevenue = Array.from(productMap.values()).reduce(
        (s, p) => s + p.revenue,
        0,
      );
      const latestNames = await this.getLatestProductNames(
        Array.from(productMap.keys()),
      );

      const sorted = Array.from(productMap.entries())
        .map(([productId, data]) => ({
          productId,
          productName: latestNames.get(productId) || data.name,
          revenue: data.revenue,
          revenuePercentage:
            totalRevenue > 0
              ? parseFloat(((data.revenue / totalRevenue) * 100).toFixed(2))
              : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue);

      let cumulative = 0;
      const abcItems: AbcAnalysisItemDto[] = sorted.map((item) => {
        cumulative += item.revenuePercentage;
        const grade: 'A' | 'B' | 'C' =
          cumulative <= 70 ? 'A' : cumulative <= 90 ? 'B' : 'C';
        return {
          ...item,
          cumulativePercentage: parseFloat(cumulative.toFixed(2)),
          grade,
        };
      });

      const gradeA = abcItems.filter((i) => i.grade === 'A');
      const gradeB = abcItems.filter((i) => i.grade === 'B');
      const gradeC = abcItems.filter((i) => i.grade === 'C');

      return {
        items: abcItems,
        summary: {
          gradeA: {
            count: gradeA.length,
            revenuePercentage: parseFloat(
              gradeA.reduce((s, i) => s + i.revenuePercentage, 0).toFixed(2),
            ),
          },
          gradeB: {
            count: gradeB.length,
            revenuePercentage: parseFloat(
              gradeB.reduce((s, i) => s + i.revenuePercentage, 0).toFixed(2),
            ),
          },
          gradeC: {
            count: gradeC.length,
            revenuePercentage: parseFloat(
              gradeC.reduce((s, i) => s + i.revenuePercentage, 0).toFixed(2),
            ),
          },
        },
      };
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      this.logger.error('Unexpected error in getAbcAnalysis', error);
      throw new BusinessException(
        'Failed to fetch ABC analysis',
        'ABC_ANALYSIS_ERROR',
        500,
      );
    }
  }

  /**
   * 시간대별 인기 상품
   */
  async getHourlyProductAnalysis(
    branchId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<HourlyProductAnalysisResponse> {
    this.logger.log(`Fetching hourly product analysis for branch: ${branchId}`);
    const sb = this.supabase.adminClient();
    const dateRange = this.getDateRange(startDate, endDate);

    try {
      const { data: orderItems, error } = await sb
        .from('order_items')
        .select(
          `product_id, product_name_snapshot, qty, unit_price_snapshot,
           order:orders!inner(id, status, created_at, branch_id)`,
        )
        .eq('order.branch_id', branchId)
        .gte('order.created_at', dateRange.start)
        .lte('order.created_at', dateRange.end)
        .in('order.status', ['COMPLETED', 'READY', 'PREPARING', 'CONFIRMED']);

      if (error) {
        throw new BusinessException(
          'Failed to fetch hourly analysis',
          'HOURLY_ANALYSIS_FAILED',
          500,
          { branchId, error: error.message },
        );
      }

      const items = orderItems || [];

      // hour -> { orderId set, product -> { qty, revenue } }
      const hourMap = new Map<
        number,
        {
          orderIds: Set<string>;
          products: Map<string, { name: string; qty: number; revenue: number }>;
        }
      >();

      items.forEach((item: any) => {
        const hour = new Date(item.order.created_at).getHours();
        const orderId = item.order.id;

        if (!hourMap.has(hour)) {
          hourMap.set(hour, { orderIds: new Set(), products: new Map() });
        }
        const hd = hourMap.get(hour)!;
        hd.orderIds.add(orderId);

        const pid = item.product_id || 'unknown';
        const cur = hd.products.get(pid) || {
          name: item.product_name_snapshot || 'Unknown',
          qty: 0,
          revenue: 0,
        };
        cur.qty += item.qty || 0;
        cur.revenue += (item.qty || 0) * (item.unit_price_snapshot || 0);
        hd.products.set(pid, cur);
      });

      const hourlyData: HourlyProductDto[] = Array.from(hourMap.entries())
        .map(([hour, data]) => {
          const topProducts: HourlyTopProductDto[] = Array.from(
            data.products.entries(),
          )
            .map(([productId, p]) => ({
              productId,
              productName: p.name,
              quantity: p.qty,
              revenue: p.revenue,
            }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 5);

          return { hour, topProducts, totalOrders: data.orderIds.size };
        })
        .sort((a, b) => a.hour - b.hour);

      return { hourlyData };
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      this.logger.error('Unexpected error in getHourlyProductAnalysis', error);
      throw new BusinessException(
        'Failed to fetch hourly product analysis',
        'HOURLY_ANALYSIS_ERROR',
        500,
      );
    }
  }

  /**
   * 조합 분석 (함께 주문되는 상품)
   */
  async getCombinationAnalysis(
    branchId: string,
    startDate?: string,
    endDate?: string,
    minCount: number = 2,
  ): Promise<CombinationAnalysisResponse> {
    this.logger.log(`Fetching combination analysis for branch: ${branchId}`);
    const sb = this.supabase.adminClient();
    const dateRange = this.getDateRange(startDate, endDate);

    try {
      const { data: orderItems, error } = await sb
        .from('order_items')
        .select(
          `product_id, product_name_snapshot,
           order:orders!inner(id, status, created_at, branch_id)`,
        )
        .eq('order.branch_id', branchId)
        .gte('order.created_at', dateRange.start)
        .lte('order.created_at', dateRange.end)
        .in('order.status', ['COMPLETED', 'READY', 'PREPARING', 'CONFIRMED']);

      if (error) {
        throw new BusinessException(
          'Failed to fetch combination analysis',
          'COMBINATION_ANALYSIS_FAILED',
          500,
          { branchId, error: error.message },
        );
      }

      const items = orderItems || [];

      // Group items by order
      const orderProducts = new Map<string, Map<string, string>>();
      items.forEach((item: any) => {
        const orderId = item.order.id;
        if (!orderProducts.has(orderId)) {
          orderProducts.set(orderId, new Map());
        }
        orderProducts
          .get(orderId)!
          .set(item.product_id, item.product_name_snapshot || 'Unknown');
      });

      const totalOrdersAnalyzed = orderProducts.size;

      // Generate pairs
      const pairMap = new Map<
        string,
        {
          products: { productId: string; productName: string }[];
          count: number;
        }
      >();

      orderProducts.forEach((products) => {
        const productIds = Array.from(products.keys()).sort();
        for (let i = 0; i < productIds.length; i++) {
          for (let j = i + 1; j < productIds.length; j++) {
            const key = `${productIds[i]}::${productIds[j]}`;
            if (!pairMap.has(key)) {
              pairMap.set(key, {
                products: [
                  {
                    productId: productIds[i],
                    productName: products.get(productIds[i])!,
                  },
                  {
                    productId: productIds[j],
                    productName: products.get(productIds[j])!,
                  },
                ],
                count: 0,
              });
            }
            pairMap.get(key)!.count += 1;
          }
        }
      });

      const combinations: ProductCombinationDto[] = Array.from(pairMap.values())
        .filter((p) => p.count >= minCount)
        .map((p) => ({
          products: p.products,
          coOrderCount: p.count,
          supportRate:
            totalOrdersAnalyzed > 0
              ? parseFloat(((p.count / totalOrdersAnalyzed) * 100).toFixed(2))
              : 0,
        }))
        .sort((a, b) => b.coOrderCount - a.coOrderCount)
        .slice(0, 20);

      return { combinations, totalOrdersAnalyzed };
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      this.logger.error('Unexpected error in getCombinationAnalysis', error);
      throw new BusinessException(
        'Failed to fetch combination analysis',
        'COMBINATION_ANALYSIS_ERROR',
        500,
      );
    }
  }

  // ============================================================
  // 심화 분석: 고객
  // ============================================================

  /**
   * 코호트 분석
   */
  async getCohortAnalysis(
    branchId: string,
    startDate?: string,
    endDate?: string,
    granularity: 'WEEK' | 'MONTH' = 'MONTH',
  ): Promise<CohortAnalysisResponse> {
    this.logger.log(`Fetching cohort analysis for branch: ${branchId}`);
    const sb = this.supabase.adminClient();
    const dateRange = this.getDateRange(startDate, endDate);

    try {
      const { data: orders, error } = await sb
        .from('orders')
        .select('id, customer_phone, created_at, status')
        .eq('branch_id', branchId)
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end)
        .in('status', [
          'COMPLETED',
          'READY',
          'PREPARING',
          'CONFIRMED',
          'CREATED',
        ]);

      if (error) {
        throw new BusinessException(
          'Failed to fetch cohort analysis',
          'COHORT_ANALYSIS_FAILED',
          500,
          { branchId, error: error.message },
        );
      }

      const orderList = orders || [];

      // Group orders by customer
      const customerOrders = new Map<string, Date[]>();
      orderList.forEach((order) => {
        const phone = order.customer_phone || 'anonymous';
        if (!customerOrders.has(phone)) {
          customerOrders.set(phone, []);
        }
        customerOrders.get(phone)!.push(new Date(order.created_at));
      });

      // Get period key for a date
      const getPeriodKey = (date: Date): string => {
        if (granularity === 'WEEK') {
          const d = new Date(date);
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1);
          d.setDate(diff);
          return d.toISOString().split('T')[0];
        }
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      };

      // Calculate period difference
      const getPeriodDiff = (cohortKey: string, periodKey: string): number => {
        if (granularity === 'WEEK') {
          const diff =
            new Date(periodKey).getTime() - new Date(cohortKey).getTime();
          return Math.round(diff / (7 * 24 * 60 * 60 * 1000));
        }
        const [cy, cm] = cohortKey.split('-').map(Number);
        const [py, pm] = periodKey.split('-').map(Number);
        return (py - cy) * 12 + (pm - cm);
      };

      // Assign customers to cohorts
      const cohortMap = new Map<
        string,
        { customers: Set<string>; periodActivity: Map<number, Set<string>> }
      >();

      customerOrders.forEach((dates, phone) => {
        dates.sort((a, b) => a.getTime() - b.getTime());
        const firstOrder = dates[0];
        const cohortKey = getPeriodKey(firstOrder);

        if (!cohortMap.has(cohortKey)) {
          cohortMap.set(cohortKey, {
            customers: new Set(),
            periodActivity: new Map(),
          });
        }
        const cohort = cohortMap.get(cohortKey)!;
        cohort.customers.add(phone);

        dates.forEach((date) => {
          const periodKey = getPeriodKey(date);
          const diff = getPeriodDiff(cohortKey, periodKey);
          if (!cohort.periodActivity.has(diff)) {
            cohort.periodActivity.set(diff, new Set());
          }
          cohort.periodActivity.get(diff)!.add(phone);
        });
      });

      const cohorts: CohortRowDto[] = Array.from(cohortMap.entries())
        .map(([cohort, data]) => {
          const cohortSize = data.customers.size;
          const maxPeriod = Math.max(
            0,
            ...Array.from(data.periodActivity.keys()),
          );

          const retention: CohortRetentionDto[] = [];
          for (let p = 0; p <= maxPeriod; p++) {
            const active = data.periodActivity.get(p)?.size || 0;
            retention.push({
              period: p,
              activeCustomers: active,
              retentionRate:
                cohortSize > 0
                  ? parseFloat(((active / cohortSize) * 100).toFixed(2))
                  : 0,
            });
          }

          return { cohort, cohortSize, retention };
        })
        .sort((a, b) => a.cohort.localeCompare(b.cohort));

      return { cohorts, granularity };
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      this.logger.error('Unexpected error in getCohortAnalysis', error);
      throw new BusinessException(
        'Failed to fetch cohort analysis',
        'COHORT_ANALYSIS_ERROR',
        500,
      );
    }
  }

  /**
   * RFM 분석
   */
  async getRfmAnalysis(
    branchId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<RfmAnalysisResponse> {
    this.logger.log(`Fetching RFM analysis for branch: ${branchId}`);
    const sb = this.supabase.adminClient();
    const dateRange = this.getDateRange(startDate, endDate);

    try {
      const { data: orders, error } = await sb
        .from('orders')
        .select('id, customer_phone, total_amount, created_at, status')
        .eq('branch_id', branchId)
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end)
        .in('status', [
          'COMPLETED',
          'READY',
          'PREPARING',
          'CONFIRMED',
          'CREATED',
        ]);

      if (error) {
        throw new BusinessException(
          'Failed to fetch RFM analysis',
          'RFM_ANALYSIS_FAILED',
          500,
          { branchId, error: error.message },
        );
      }

      const orderList = orders || [];
      const now = new Date();

      // Aggregate per customer
      const customerData = new Map<
        string,
        { lastOrder: Date; orderCount: number; totalSpent: number }
      >();
      orderList.forEach((order) => {
        const phone = order.customer_phone || 'anonymous';
        const date = new Date(order.created_at);
        const cur = customerData.get(phone) || {
          lastOrder: date,
          orderCount: 0,
          totalSpent: 0,
        };
        if (date > cur.lastOrder) cur.lastOrder = date;
        cur.orderCount += 1;
        cur.totalSpent += order.total_amount || 0;
        customerData.set(phone, cur);
      });

      const customers = Array.from(customerData.entries()).map(
        ([phone, data]) => ({
          phone,
          recency: Math.floor(
            (now.getTime() - data.lastOrder.getTime()) / (1000 * 60 * 60 * 24),
          ),
          frequency: data.orderCount,
          monetary: data.totalSpent,
        }),
      );

      if (customers.length === 0) {
        return { customers: [], summary: [] };
      }

      // Calculate quintile scores (1-5)
      const recencies = customers.map((c) => c.recency).sort((a, b) => a - b);
      const frequencies = customers
        .map((c) => c.frequency)
        .sort((a, b) => a - b);
      const monetaries = customers.map((c) => c.monetary).sort((a, b) => a - b);

      const getQuintile = (
        value: number,
        sorted: number[],
        inverse: boolean = false,
      ): number => {
        const idx = sorted.indexOf(value);
        const pct = idx / sorted.length;
        const score = Math.min(5, Math.floor(pct * 5) + 1);
        return inverse ? 6 - score : score;
      };

      const rfmCustomers: RfmCustomerDto[] = customers.map((c) => {
        const rScore = getQuintile(c.recency, recencies, true); // lower recency = higher score
        const fScore = getQuintile(c.frequency, frequencies);
        const mScore = getQuintile(c.monetary, monetaries);
        const rfmScore = `${rScore}-${fScore}-${mScore}`;
        const segment = this.getRfmSegment(rScore, fScore, mScore);

        return {
          customerPhone: c.phone,
          recency: c.recency,
          frequency: c.frequency,
          monetary: c.monetary,
          rfmScore,
          segment,
        };
      });

      // Summary by segment
      const segmentMap = new Map<
        string,
        { count: number; totalR: number; totalF: number; totalM: number }
      >();
      rfmCustomers.forEach((c) => {
        const cur = segmentMap.get(c.segment) || {
          count: 0,
          totalR: 0,
          totalF: 0,
          totalM: 0,
        };
        cur.count += 1;
        cur.totalR += c.recency;
        cur.totalF += c.frequency;
        cur.totalM += c.monetary;
        segmentMap.set(c.segment, cur);
      });

      const summary: RfmSegmentSummaryDto[] = Array.from(segmentMap.entries())
        .map(([segment, data]) => ({
          segment,
          customerCount: data.count,
          avgRecency: Math.round(data.totalR / data.count),
          avgFrequency: parseFloat((data.totalF / data.count).toFixed(2)),
          avgMonetary: Math.round(data.totalM / data.count),
        }))
        .sort((a, b) => b.customerCount - a.customerCount);

      return { customers: rfmCustomers, summary };
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      this.logger.error('Unexpected error in getRfmAnalysis', error);
      throw new BusinessException(
        'Failed to fetch RFM analysis',
        'RFM_ANALYSIS_ERROR',
        500,
      );
    }
  }

  private getRfmSegment(r: number, f: number, m: number): string {
    const avg = (r + f + m) / 3;
    if (r >= 4 && f >= 4 && m >= 4) return 'Champions';
    if (r >= 3 && f >= 3) return 'Loyal';
    if (r >= 4 && f <= 2) return 'New';
    if (r >= 3 && f >= 2) return 'Potential';
    if (r <= 2 && f >= 3) return 'At Risk';
    if (avg <= 2) return 'Lost';
    return 'Potential';
  }

  // ============================================================
  // 브랜드 레벨 심화 분석
  // ============================================================

  /**
   * 브랜드 ABC 분석
   */
  async getBrandAbcAnalysis(
    brandId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<AbcAnalysisResponse> {
    this.logger.log(`Fetching brand ABC analysis for brand: ${brandId}`);
    const sb = this.supabase.adminClient();
    const dateRange = this.getDateRange(startDate, endDate);

    try {
      const { data: orderItems, error } = await sb
        .from('order_items')
        .select(
          `product_id, product_name_snapshot, qty, unit_price_snapshot,
           order:orders!inner(id, status, created_at, brand_id)`,
        )
        .eq('order.brand_id', brandId)
        .gte('order.created_at', dateRange.start)
        .lte('order.created_at', dateRange.end)
        .in('order.status', ['COMPLETED', 'READY', 'PREPARING', 'CONFIRMED']);

      if (error) {
        throw new BusinessException(
          'Failed to fetch brand ABC analysis',
          'BRAND_ABC_FAILED',
          500,
          { brandId, error: error.message },
        );
      }

      const items = orderItems || [];
      const productMap = new Map<string, { name: string; revenue: number }>();

      items.forEach((item: any) => {
        const pid = item.product_id || 'unknown';
        const cur = productMap.get(pid) || {
          name: item.product_name_snapshot || 'Unknown',
          revenue: 0,
        };
        cur.revenue += (item.qty || 0) * (item.unit_price_snapshot || 0);
        productMap.set(pid, cur);
      });

      const totalRevenue = Array.from(productMap.values()).reduce(
        (s, p) => s + p.revenue,
        0,
      );

      const sorted = Array.from(productMap.entries())
        .map(([productId, data]) => ({
          productId,
          productName: data.name,
          revenue: data.revenue,
          revenuePercentage:
            totalRevenue > 0
              ? parseFloat(((data.revenue / totalRevenue) * 100).toFixed(2))
              : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue);

      let cumulative = 0;
      const abcItems: AbcAnalysisItemDto[] = sorted.map((item) => {
        cumulative += item.revenuePercentage;
        const grade: 'A' | 'B' | 'C' =
          cumulative <= 70 ? 'A' : cumulative <= 90 ? 'B' : 'C';
        return {
          ...item,
          cumulativePercentage: parseFloat(cumulative.toFixed(2)),
          grade,
        };
      });

      const gradeA = abcItems.filter((i) => i.grade === 'A');
      const gradeB = abcItems.filter((i) => i.grade === 'B');
      const gradeC = abcItems.filter((i) => i.grade === 'C');

      return {
        items: abcItems,
        summary: {
          gradeA: {
            count: gradeA.length,
            revenuePercentage: parseFloat(
              gradeA.reduce((s, i) => s + i.revenuePercentage, 0).toFixed(2),
            ),
          },
          gradeB: {
            count: gradeB.length,
            revenuePercentage: parseFloat(
              gradeB.reduce((s, i) => s + i.revenuePercentage, 0).toFixed(2),
            ),
          },
          gradeC: {
            count: gradeC.length,
            revenuePercentage: parseFloat(
              gradeC.reduce((s, i) => s + i.revenuePercentage, 0).toFixed(2),
            ),
          },
        },
      };
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      this.logger.error('Unexpected error in getBrandAbcAnalysis', error);
      throw new BusinessException(
        'Failed to fetch brand ABC analysis',
        'BRAND_ABC_ERROR',
        500,
      );
    }
  }

  /**
   * 브랜드 코호트 분석
   */
  async getBrandCohortAnalysis(
    brandId: string,
    startDate?: string,
    endDate?: string,
    granularity: 'WEEK' | 'MONTH' = 'MONTH',
  ): Promise<CohortAnalysisResponse> {
    this.logger.log(`Fetching brand cohort analysis for brand: ${brandId}`);
    const sb = this.supabase.adminClient();
    const dateRange = this.getDateRange(startDate, endDate);

    try {
      const { data: orders, error } = await sb
        .from('orders')
        .select('id, customer_phone, created_at, status')
        .eq('brand_id', brandId)
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end)
        .in('status', [
          'COMPLETED',
          'READY',
          'PREPARING',
          'CONFIRMED',
          'CREATED',
        ]);

      if (error) {
        throw new BusinessException(
          'Failed to fetch brand cohort analysis',
          'BRAND_COHORT_FAILED',
          500,
          { brandId, error: error.message },
        );
      }

      const orderList = orders || [];
      const customerOrders = new Map<string, Date[]>();
      orderList.forEach((order) => {
        const phone = order.customer_phone || 'anonymous';
        if (!customerOrders.has(phone)) customerOrders.set(phone, []);
        customerOrders.get(phone)!.push(new Date(order.created_at));
      });

      const getPeriodKey = (date: Date): string => {
        if (granularity === 'WEEK') {
          const d = new Date(date);
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1);
          d.setDate(diff);
          return d.toISOString().split('T')[0];
        }
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      };

      const getPeriodDiff = (cohortKey: string, periodKey: string): number => {
        if (granularity === 'WEEK') {
          return Math.round(
            (new Date(periodKey).getTime() - new Date(cohortKey).getTime()) /
              (7 * 24 * 60 * 60 * 1000),
          );
        }
        const [cy, cm] = cohortKey.split('-').map(Number);
        const [py, pm] = periodKey.split('-').map(Number);
        return (py - cy) * 12 + (pm - cm);
      };

      const cohortMap = new Map<
        string,
        { customers: Set<string>; periodActivity: Map<number, Set<string>> }
      >();

      customerOrders.forEach((dates, phone) => {
        dates.sort((a, b) => a.getTime() - b.getTime());
        const cohortKey = getPeriodKey(dates[0]);
        if (!cohortMap.has(cohortKey))
          cohortMap.set(cohortKey, {
            customers: new Set(),
            periodActivity: new Map(),
          });
        const cohort = cohortMap.get(cohortKey)!;
        cohort.customers.add(phone);
        dates.forEach((date) => {
          const diff = getPeriodDiff(cohortKey, getPeriodKey(date));
          if (!cohort.periodActivity.has(diff))
            cohort.periodActivity.set(diff, new Set());
          cohort.periodActivity.get(diff)!.add(phone);
        });
      });

      const cohorts: CohortRowDto[] = Array.from(cohortMap.entries())
        .map(([cohort, data]) => {
          const cohortSize = data.customers.size;
          const maxPeriod = Math.max(
            0,
            ...Array.from(data.periodActivity.keys()),
          );
          const retention: CohortRetentionDto[] = [];
          for (let p = 0; p <= maxPeriod; p++) {
            const active = data.periodActivity.get(p)?.size || 0;
            retention.push({
              period: p,
              activeCustomers: active,
              retentionRate:
                cohortSize > 0
                  ? parseFloat(((active / cohortSize) * 100).toFixed(2))
                  : 0,
            });
          }
          return { cohort, cohortSize, retention };
        })
        .sort((a, b) => a.cohort.localeCompare(b.cohort));

      return { cohorts, granularity };
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      this.logger.error('Unexpected error in getBrandCohortAnalysis', error);
      throw new BusinessException(
        'Failed to fetch brand cohort analysis',
        'BRAND_COHORT_ERROR',
        500,
      );
    }
  }

  /**
   * 브랜드 RFM 분석
   */
  async getBrandRfmAnalysis(
    brandId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<RfmAnalysisResponse> {
    this.logger.log(`Fetching brand RFM analysis for brand: ${brandId}`);
    const sb = this.supabase.adminClient();
    const dateRange = this.getDateRange(startDate, endDate);

    try {
      const { data: orders, error } = await sb
        .from('orders')
        .select('id, customer_phone, total_amount, created_at, status')
        .eq('brand_id', brandId)
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end)
        .in('status', [
          'COMPLETED',
          'READY',
          'PREPARING',
          'CONFIRMED',
          'CREATED',
        ]);

      if (error) {
        throw new BusinessException(
          'Failed to fetch brand RFM analysis',
          'BRAND_RFM_FAILED',
          500,
          { brandId, error: error.message },
        );
      }

      const orderList = orders || [];
      const now = new Date();

      const customerData = new Map<
        string,
        { lastOrder: Date; orderCount: number; totalSpent: number }
      >();
      orderList.forEach((order) => {
        const phone = order.customer_phone || 'anonymous';
        const date = new Date(order.created_at);
        const cur = customerData.get(phone) || {
          lastOrder: date,
          orderCount: 0,
          totalSpent: 0,
        };
        if (date > cur.lastOrder) cur.lastOrder = date;
        cur.orderCount += 1;
        cur.totalSpent += order.total_amount || 0;
        customerData.set(phone, cur);
      });

      const customers = Array.from(customerData.entries()).map(
        ([phone, data]) => ({
          phone,
          recency: Math.floor(
            (now.getTime() - data.lastOrder.getTime()) / (1000 * 60 * 60 * 24),
          ),
          frequency: data.orderCount,
          monetary: data.totalSpent,
        }),
      );

      if (customers.length === 0) {
        return { customers: [], summary: [] };
      }

      const recencies = customers.map((c) => c.recency).sort((a, b) => a - b);
      const frequencies = customers
        .map((c) => c.frequency)
        .sort((a, b) => a - b);
      const monetaries = customers.map((c) => c.monetary).sort((a, b) => a - b);

      const getQuintile = (
        value: number,
        sorted: number[],
        inverse: boolean = false,
      ): number => {
        const idx = sorted.indexOf(value);
        const pct = idx / sorted.length;
        const score = Math.min(5, Math.floor(pct * 5) + 1);
        return inverse ? 6 - score : score;
      };

      const rfmCustomers: RfmCustomerDto[] = customers.map((c) => {
        const rScore = getQuintile(c.recency, recencies, true);
        const fScore = getQuintile(c.frequency, frequencies);
        const mScore = getQuintile(c.monetary, monetaries);
        const segment = this.getRfmSegment(rScore, fScore, mScore);
        return {
          customerPhone: c.phone,
          recency: c.recency,
          frequency: c.frequency,
          monetary: c.monetary,
          rfmScore: `${rScore}-${fScore}-${mScore}`,
          segment,
        };
      });

      const segmentMap = new Map<
        string,
        { count: number; totalR: number; totalF: number; totalM: number }
      >();
      rfmCustomers.forEach((c) => {
        const cur = segmentMap.get(c.segment) || {
          count: 0,
          totalR: 0,
          totalF: 0,
          totalM: 0,
        };
        cur.count += 1;
        cur.totalR += c.recency;
        cur.totalF += c.frequency;
        cur.totalM += c.monetary;
        segmentMap.set(c.segment, cur);
      });

      const summary: RfmSegmentSummaryDto[] = Array.from(segmentMap.entries())
        .map(([segment, data]) => ({
          segment,
          customerCount: data.count,
          avgRecency: Math.round(data.totalR / data.count),
          avgFrequency: parseFloat((data.totalF / data.count).toFixed(2)),
          avgMonetary: Math.round(data.totalM / data.count),
        }))
        .sort((a, b) => b.customerCount - a.customerCount);

      return { customers: rfmCustomers, summary };
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      this.logger.error('Unexpected error in getBrandRfmAnalysis', error);
      throw new BusinessException(
        'Failed to fetch brand RFM analysis',
        'BRAND_RFM_ERROR',
        500,
      );
    }
  }
}
