export type PeriodComparison<T> = {
  current: T;
  previous?: T;
  changes?: Record<string, number>;
};

export type MaybePeriodComparison<T> = T | PeriodComparison<T>;

export interface RevenueByDay {
  date: string;
  revenue: number;
  orderCount: number;
}

export interface SalesAnalytics {
  totalRevenue: number;
  orderCount: number;
  avgOrderValue: number;
  revenueByDay: RevenueByDay[];
}

export interface BranchBreakdown {
  branchId: string;
  branchName: string;
  revenue: number;
  orderCount: number;
}

export interface BrandSalesAnalytics extends SalesAnalytics {
  byBranch: BranchBreakdown[];
}

export interface TopProduct {
  productId: string;
  productName: string;
  soldQuantity: number;
  totalRevenue: number;
}

export interface SalesByProduct {
  productId: string;
  productName: string;
  quantity: number;
  revenue: number;
  revenuePercentage: number;
}

export interface InventoryTurnover {
  averageTurnoverRate: number;
  periodDays: number;
}

export interface ProductAnalytics {
  topProducts: TopProduct[];
  salesByProduct: SalesByProduct[];
  inventoryTurnover: InventoryTurnover;
}

export interface OrderStatusDistribution {
  status: string;
  count: number;
  percentage: number;
}

export interface OrdersByDay {
  date: string;
  orderCount: number;
  completedCount: number;
  cancelledCount: number;
}

export interface PeakHours {
  hour: number;
  orderCount: number;
}

export interface OrderAnalytics {
  statusDistribution: OrderStatusDistribution[];
  ordersByDay: OrdersByDay[];
  peakHours: PeakHours[];
}

export interface CustomerAnalytics {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  clv: number;
  repeatCustomerRate: number;
  avgOrdersPerCustomer: number;
}
