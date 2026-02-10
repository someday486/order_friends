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
} from './dto/analytics.dto';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly supabase: SupabaseService) {}

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
          unit_price,
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
        const revenue = (item.qty || 0) * (item.unit_price || 0);

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
}
