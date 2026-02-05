export declare class AnalyticsQueryDto {
    branchId: string;
    startDate?: string;
    endDate?: string;
}
export declare class RevenueByDayDto {
    date: string;
    revenue: number;
    orderCount: number;
}
export declare class SalesAnalyticsResponse {
    totalRevenue: number;
    orderCount: number;
    avgOrderValue: number;
    revenueByDay: RevenueByDayDto[];
}
export declare class TopProductDto {
    productId: string;
    productName: string;
    soldQuantity: number;
    totalRevenue: number;
}
export declare class SalesByProductDto {
    productId: string;
    productName: string;
    quantity: number;
    revenue: number;
    revenuePercentage: number;
}
export declare class InventoryTurnoverDto {
    averageTurnoverRate: number;
    periodDays: number;
}
export declare class ProductAnalyticsResponse {
    topProducts: TopProductDto[];
    salesByProduct: SalesByProductDto[];
    inventoryTurnover: InventoryTurnoverDto;
}
export declare class OrderStatusDistributionDto {
    status: string;
    count: number;
    percentage: number;
}
export declare class OrdersByDayDto {
    date: string;
    orderCount: number;
    completedCount: number;
    cancelledCount: number;
}
export declare class PeakHoursDto {
    hour: number;
    orderCount: number;
}
export declare class OrderAnalyticsResponse {
    statusDistribution: OrderStatusDistributionDto[];
    ordersByDay: OrdersByDayDto[];
    peakHours: PeakHoursDto[];
}
export declare class CustomerAnalyticsResponse {
    totalCustomers: number;
    newCustomers: number;
    returningCustomers: number;
    clv: number;
    repeatCustomerRate: number;
    avgOrdersPerCustomer: number;
}
