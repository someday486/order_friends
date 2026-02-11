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

export interface AbcAnalysisItem {
  productId: string;
  productName: string;
  revenue: number;
  revenuePercentage: number;
  cumulativePercentage: number;
  grade: 'A' | 'B' | 'C';
}

export interface AbcGradeSummary {
  count: number;
  revenuePercentage: number;
}

export interface AbcAnalysis {
  items: AbcAnalysisItem[];
  summary: {
    gradeA: AbcGradeSummary;
    gradeB: AbcGradeSummary;
    gradeC: AbcGradeSummary;
  };
}

export interface HourlyTopProduct {
  productId: string;
  productName: string;
  quantity: number;
  revenue: number;
}

export interface HourlyProduct {
  hour: number;
  topProducts: HourlyTopProduct[];
  totalOrders: number;
}

export interface HourlyProductAnalysis {
  hourlyData: HourlyProduct[];
}

export interface CombinationProduct {
  productId: string;
  productName: string;
}

export interface ProductCombination {
  products: CombinationProduct[];
  coOrderCount: number;
  supportRate: number;
}

export interface CombinationAnalysis {
  combinations: ProductCombination[];
  totalOrdersAnalyzed: number;
}

export interface CohortRetention {
  period: number;
  activeCustomers: number;
  retentionRate: number;
}

export interface CohortRow {
  cohort: string;
  cohortSize: number;
  retention: CohortRetention[];
}

export interface CohortAnalysis {
  cohorts: CohortRow[];
  granularity: 'WEEK' | 'MONTH';
}

export interface RfmCustomer {
  customerPhone: string;
  recency: number;
  frequency: number;
  monetary: number;
  rfmScore: string;
  segment: string;
}

export interface RfmSegmentSummary {
  segment: string;
  customerCount: number;
  avgRecency: number;
  avgFrequency: number;
  avgMonetary: number;
}

export interface RfmAnalysis {
  customers: RfmCustomer[];
  summary: RfmSegmentSummary[];
}
