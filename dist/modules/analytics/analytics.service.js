"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AnalyticsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../../infra/supabase/supabase.service");
const business_exception_1 = require("../../common/exceptions/business.exception");
let AnalyticsService = AnalyticsService_1 = class AnalyticsService {
    supabase;
    logger = new common_1.Logger(AnalyticsService_1.name);
    constructor(supabase) {
        this.supabase = supabase;
    }
    getDateRange(startDate, endDate) {
        let start;
        let end;
        if (startDate) {
            start = new Date(startDate);
        }
        else {
            start = new Date();
            start.setDate(start.getDate() - 30);
            start.setHours(0, 0, 0, 0);
        }
        if (endDate) {
            end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
        }
        else {
            end = new Date();
            end.setHours(23, 59, 59, 999);
        }
        return {
            start: start.toISOString(),
            end: end.toISOString(),
            days: Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
        };
    }
    getPreviousPeriod(startDate, endDate) {
        const current = this.getDateRange(startDate, endDate);
        const durationMs = new Date(current.end).getTime() - new Date(current.start).getTime();
        const prevEnd = new Date(new Date(current.start).getTime() - 1);
        prevEnd.setHours(23, 59, 59, 999);
        const prevStart = new Date(prevEnd.getTime() - durationMs);
        prevStart.setHours(0, 0, 0, 0);
        return {
            start: prevStart.toISOString(),
            end: prevEnd.toISOString(),
        };
    }
    calcChange(current, previous) {
        if (previous === 0)
            return current > 0 ? 100 : 0;
        return parseFloat((((current - previous) / previous) * 100).toFixed(1));
    }
    async withComparison(compare, currentData, fetchPrevious, changeKeys) {
        if (!compare) {
            return { current: currentData };
        }
        const previous = await fetchPrevious();
        const changes = {};
        for (const key of changeKeys) {
            if (typeof currentData[key] === 'number' &&
                typeof previous[key] === 'number') {
                changes[key] = this.calcChange(currentData[key], previous[key]);
            }
        }
        return { current: currentData, previous, changes };
    }
    async getSalesAnalytics(accessToken, branchId, startDate, endDate) {
        this.logger.log(`Fetching sales analytics for branch: ${branchId}`);
        const sb = this.supabase.adminClient();
        const dateRange = this.getDateRange(startDate, endDate);
        try {
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
                this.logger.error(`Failed to fetch sales analytics: ${error.message}`, error);
                throw new business_exception_1.BusinessException('Failed to fetch sales analytics', 'SALES_ANALYTICS_FAILED', 500, { branchId, error: error.message });
            }
            const orderList = orders || [];
            const orderCount = orderList.length;
            const totalRevenue = orderList.reduce((sum, order) => sum + (order.total_amount || 0), 0);
            const avgOrderValue = orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0;
            const revenueByDayMap = new Map();
            orderList.forEach((order) => {
                const date = new Date(order.created_at).toISOString().split('T')[0];
                const current = revenueByDayMap.get(date) || { revenue: 0, count: 0 };
                current.revenue += order.total_amount || 0;
                current.count += 1;
                revenueByDayMap.set(date, current);
            });
            const revenueByDay = Array.from(revenueByDayMap.entries())
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
        }
        catch (error) {
            if (error instanceof business_exception_1.BusinessException)
                throw error;
            this.logger.error('Unexpected error in getSalesAnalytics', error);
            throw new business_exception_1.BusinessException('Failed to fetch sales analytics', 'SALES_ANALYTICS_ERROR', 500);
        }
    }
    async getProductAnalytics(accessToken, branchId, startDate, endDate) {
        this.logger.log(`Fetching product analytics for branch: ${branchId}`);
        const sb = this.supabase.adminClient();
        const dateRange = this.getDateRange(startDate, endDate);
        try {
            const { data: orderItems, error } = await sb
                .from('order_items')
                .select(`
          id,
          product_id,
          product_name_snapshot,
          qty,
          unit_price_snapshot,
          order:orders!inner(id, status, created_at, branch_id)
        `)
                .eq('order.branch_id', branchId)
                .gte('order.created_at', dateRange.start)
                .lte('order.created_at', dateRange.end)
                .in('order.status', ['COMPLETED', 'READY', 'PREPARING', 'CONFIRMED']);
            if (error) {
                this.logger.error(`Failed to fetch product analytics: ${error.message}`, error);
                throw new business_exception_1.BusinessException('Failed to fetch product analytics', 'PRODUCT_ANALYTICS_FAILED', 500, { branchId, error: error.message });
            }
            const items = orderItems || [];
            const productMap = new Map();
            items.forEach((item) => {
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
            const totalRevenue = Array.from(productMap.values()).reduce((sum, p) => sum + p.revenue, 0);
            const topProducts = Array.from(productMap.entries())
                .map(([productId, data]) => ({
                productId,
                productName: data.name,
                soldQuantity: data.qty,
                totalRevenue: data.revenue,
            }))
                .sort((a, b) => b.totalRevenue - a.totalRevenue)
                .slice(0, 10);
            const salesByProduct = Array.from(productMap.entries())
                .map(([productId, data]) => ({
                productId,
                productName: data.name,
                quantity: data.qty,
                revenue: data.revenue,
                revenuePercentage: totalRevenue > 0
                    ? parseFloat(((data.revenue / totalRevenue) * 100).toFixed(2))
                    : 0,
            }))
                .sort((a, b) => b.revenue - a.revenue);
            const totalQuantitySold = Array.from(productMap.values()).reduce((sum, p) => sum + p.qty, 0);
            const averageTurnoverRate = dateRange.days > 0
                ? parseFloat((totalQuantitySold / dateRange.days).toFixed(2))
                : 0;
            const inventoryTurnover = {
                averageTurnoverRate,
                periodDays: dateRange.days,
            };
            return {
                topProducts,
                salesByProduct,
                inventoryTurnover,
            };
        }
        catch (error) {
            if (error instanceof business_exception_1.BusinessException)
                throw error;
            this.logger.error('Unexpected error in getProductAnalytics', error);
            throw new business_exception_1.BusinessException('Failed to fetch product analytics', 'PRODUCT_ANALYTICS_ERROR', 500);
        }
    }
    async getOrderAnalytics(accessToken, branchId, startDate, endDate) {
        this.logger.log(`Fetching order analytics for branch: ${branchId}`);
        const sb = this.supabase.adminClient();
        const dateRange = this.getDateRange(startDate, endDate);
        try {
            const { data: orders, error } = await sb
                .from('orders')
                .select('id, status, created_at')
                .eq('branch_id', branchId)
                .gte('created_at', dateRange.start)
                .lte('created_at', dateRange.end);
            if (error) {
                this.logger.error(`Failed to fetch order analytics: ${error.message}`, error);
                throw new business_exception_1.BusinessException('Failed to fetch order analytics', 'ORDER_ANALYTICS_FAILED', 500, { branchId, error: error.message });
            }
            const orderList = orders || [];
            const totalOrders = orderList.length;
            const statusMap = new Map();
            orderList.forEach((order) => {
                const status = order.status || 'UNKNOWN';
                statusMap.set(status, (statusMap.get(status) || 0) + 1);
            });
            const statusDistribution = Array.from(statusMap.entries())
                .map(([status, count]) => ({
                status,
                count,
                percentage: parseFloat(((count / totalOrders) * 100).toFixed(2)),
            }))
                .sort((a, b) => b.count - a.count);
            const ordersByDayMap = new Map();
            orderList.forEach((order) => {
                const date = new Date(order.created_at).toISOString().split('T')[0];
                const current = ordersByDayMap.get(date) || {
                    total: 0,
                    completed: 0,
                    cancelled: 0,
                };
                current.total += 1;
                if (order.status === 'COMPLETED')
                    current.completed += 1;
                if (order.status === 'CANCELLED')
                    current.cancelled += 1;
                ordersByDayMap.set(date, current);
            });
            const ordersByDay = Array.from(ordersByDayMap.entries())
                .map(([date, data]) => ({
                date,
                orderCount: data.total,
                completedCount: data.completed,
                cancelledCount: data.cancelled,
            }))
                .sort((a, b) => a.date.localeCompare(b.date));
            const hourMap = new Map();
            orderList.forEach((order) => {
                const hour = new Date(order.created_at).getHours();
                hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
            });
            const peakHours = Array.from(hourMap.entries())
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
        }
        catch (error) {
            if (error instanceof business_exception_1.BusinessException)
                throw error;
            this.logger.error('Unexpected error in getOrderAnalytics', error);
            throw new business_exception_1.BusinessException('Failed to fetch order analytics', 'ORDER_ANALYTICS_ERROR', 500);
        }
    }
    async getCustomerAnalytics(accessToken, branchId, startDate, endDate) {
        this.logger.log(`Fetching customer analytics for branch: ${branchId}`);
        const sb = this.supabase.adminClient();
        const dateRange = this.getDateRange(startDate, endDate);
        try {
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
                this.logger.error(`Failed to fetch customer analytics: ${allOrdersError.message}`, allOrdersError);
                throw new business_exception_1.BusinessException('Failed to fetch customer analytics', 'CUSTOMER_ANALYTICS_FAILED', 500, { branchId, error: allOrdersError.message });
            }
            const allOrdersList = allOrders || [];
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
                this.logger.error(`Failed to fetch period orders: ${periodError.message}`, periodError);
                throw new business_exception_1.BusinessException('Failed to fetch customer analytics', 'CUSTOMER_ANALYTICS_FAILED', 500, { branchId, error: periodError.message });
            }
            const periodOrdersList = periodOrders || [];
            const customerMap = new Map();
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
            const newCustomerPhones = new Set();
            periodOrdersList.forEach((order) => {
                const phone = order.customer_phone || 'anonymous';
                const firstOrder = allOrdersList
                    .filter((o) => o.customer_phone === phone)
                    .sort((a, b) => new Date(a.created_at).getTime() -
                    new Date(b.created_at).getTime())[0];
                if (firstOrder &&
                    new Date(firstOrder.created_at) >= new Date(dateRange.start) &&
                    new Date(firstOrder.created_at) <= new Date(dateRange.end)) {
                    newCustomerPhones.add(phone);
                }
            });
            const returningCustomers = Array.from(customerMap.values()).filter((c) => c.orderCount > 1).length;
            const totalCustomers = customerMap.size;
            const totalRevenue = Array.from(customerMap.values()).reduce((sum, c) => sum + c.totalSpent, 0);
            const clv = totalCustomers > 0 ? Math.round(totalRevenue / totalCustomers) : 0;
            const repeatCustomerRate = totalCustomers > 0
                ? parseFloat(((returningCustomers / totalCustomers) * 100).toFixed(2))
                : 0;
            const totalOrders = allOrdersList.length;
            const avgOrdersPerCustomer = totalCustomers > 0
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
        }
        catch (error) {
            if (error instanceof business_exception_1.BusinessException)
                throw error;
            this.logger.error('Unexpected error in getCustomerAnalytics', error);
            throw new business_exception_1.BusinessException('Failed to fetch customer analytics', 'CUSTOMER_ANALYTICS_ERROR', 500);
        }
    }
    async getBrandSalesAnalytics(accessToken, brandId, startDate, endDate, compare) {
        this.logger.log(`Fetching brand sales analytics for brand: ${brandId}`);
        const fetchForPeriod = async (start, end) => {
            const sb = this.supabase.adminClient();
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
                throw new business_exception_1.BusinessException('Failed to fetch brand sales analytics', 'BRAND_SALES_ANALYTICS_FAILED', 500, { brandId, error: error.message });
            }
            const { data: branches } = await sb
                .from('branches')
                .select('id, name')
                .eq('brand_id', brandId);
            const branchNameMap = new Map((branches || []).map((b) => [b.id, b.name]));
            const orderList = orders || [];
            const orderCount = orderList.length;
            const totalRevenue = orderList.reduce((sum, o) => sum + (o.total_amount || 0), 0);
            const avgOrderValue = orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0;
            const revenueByDayMap = new Map();
            const branchMap = new Map();
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
            const revenueByDay = Array.from(revenueByDayMap.entries())
                .map(([date, data]) => ({
                date,
                revenue: data.revenue,
                orderCount: data.count,
            }))
                .sort((a, b) => a.date.localeCompare(b.date));
            const byBranch = Array.from(branchMap.entries())
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
            return this.withComparison(compare, currentData, async () => {
                const prev = this.getPreviousPeriod(startDate, endDate);
                return fetchForPeriod(prev.start, prev.end);
            }, ['totalRevenue', 'orderCount', 'avgOrderValue']);
        }
        catch (error) {
            if (error instanceof business_exception_1.BusinessException)
                throw error;
            this.logger.error('Unexpected error in getBrandSalesAnalytics', error);
            throw new business_exception_1.BusinessException('Failed to fetch brand sales analytics', 'BRAND_SALES_ANALYTICS_ERROR', 500);
        }
    }
    async getBrandProductAnalytics(accessToken, brandId, startDate, endDate, compare) {
        this.logger.log(`Fetching brand product analytics for brand: ${brandId}`);
        const fetchForPeriod = async (start, end) => {
            const sb = this.supabase.adminClient();
            const days = Math.ceil((new Date(end).getTime() - new Date(start).getTime()) /
                (1000 * 60 * 60 * 24));
            const { data: orderItems, error } = await sb
                .from('order_items')
                .select(`
          id,
          product_id,
          product_name_snapshot,
          qty,
          unit_price_snapshot,
          order:orders!inner(id, status, created_at, brand_id)
        `)
                .eq('order.brand_id', brandId)
                .gte('order.created_at', start)
                .lte('order.created_at', end)
                .in('order.status', ['COMPLETED', 'READY', 'PREPARING', 'CONFIRMED']);
            if (error) {
                throw new business_exception_1.BusinessException('Failed to fetch brand product analytics', 'BRAND_PRODUCT_ANALYTICS_FAILED', 500, { brandId, error: error.message });
            }
            const items = orderItems || [];
            const productMap = new Map();
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
            const totalRevenue = Array.from(productMap.values()).reduce((sum, p) => sum + p.revenue, 0);
            const topProducts = Array.from(productMap.entries())
                .map(([productId, data]) => ({
                productId,
                productName: data.name,
                soldQuantity: data.qty,
                totalRevenue: data.revenue,
            }))
                .sort((a, b) => b.totalRevenue - a.totalRevenue)
                .slice(0, 10);
            const salesByProduct = Array.from(productMap.entries())
                .map(([productId, data]) => ({
                productId,
                productName: data.name,
                quantity: data.qty,
                revenue: data.revenue,
                revenuePercentage: totalRevenue > 0
                    ? parseFloat(((data.revenue / totalRevenue) * 100).toFixed(2))
                    : 0,
            }))
                .sort((a, b) => b.revenue - a.revenue);
            const totalQuantitySold = Array.from(productMap.values()).reduce((sum, p) => sum + p.qty, 0);
            return {
                topProducts,
                salesByProduct,
                inventoryTurnover: {
                    averageTurnoverRate: days > 0 ? parseFloat((totalQuantitySold / days).toFixed(2)) : 0,
                    periodDays: days,
                },
            };
        };
        try {
            const dateRange = this.getDateRange(startDate, endDate);
            const currentData = await fetchForPeriod(dateRange.start, dateRange.end);
            return this.withComparison(compare, currentData, async () => {
                const prev = this.getPreviousPeriod(startDate, endDate);
                return fetchForPeriod(prev.start, prev.end);
            }, []);
        }
        catch (error) {
            if (error instanceof business_exception_1.BusinessException)
                throw error;
            this.logger.error('Unexpected error in getBrandProductAnalytics', error);
            throw new business_exception_1.BusinessException('Failed to fetch brand product analytics', 'BRAND_PRODUCT_ANALYTICS_ERROR', 500);
        }
    }
    async getBrandOrderAnalytics(accessToken, brandId, startDate, endDate, compare) {
        this.logger.log(`Fetching brand order analytics for brand: ${brandId}`);
        const fetchForPeriod = async (start, end) => {
            const sb = this.supabase.adminClient();
            const { data: orders, error } = await sb
                .from('orders')
                .select('id, status, created_at')
                .eq('brand_id', brandId)
                .gte('created_at', start)
                .lte('created_at', end);
            if (error) {
                throw new business_exception_1.BusinessException('Failed to fetch brand order analytics', 'BRAND_ORDER_ANALYTICS_FAILED', 500, { brandId, error: error.message });
            }
            const orderList = orders || [];
            const totalOrders = orderList.length;
            const statusMap = new Map();
            const ordersByDayMap = new Map();
            const hourMap = new Map();
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
                if (status === 'COMPLETED')
                    dayData.completed += 1;
                if (status === 'CANCELLED')
                    dayData.cancelled += 1;
                ordersByDayMap.set(date, dayData);
                const hour = new Date(order.created_at).getHours();
                hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
            });
            return {
                statusDistribution: Array.from(statusMap.entries())
                    .map(([status, count]) => ({
                    status,
                    count,
                    percentage: totalOrders > 0
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
            return this.withComparison(compare, currentData, async () => {
                const prev = this.getPreviousPeriod(startDate, endDate);
                return fetchForPeriod(prev.start, prev.end);
            }, []);
        }
        catch (error) {
            if (error instanceof business_exception_1.BusinessException)
                throw error;
            this.logger.error('Unexpected error in getBrandOrderAnalytics', error);
            throw new business_exception_1.BusinessException('Failed to fetch brand order analytics', 'BRAND_ORDER_ANALYTICS_ERROR', 500);
        }
    }
    async getBrandCustomerAnalytics(accessToken, brandId, startDate, endDate, compare) {
        this.logger.log(`Fetching brand customer analytics for brand: ${brandId}`);
        const fetchForPeriod = async (periodStart, periodEnd) => {
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
                throw new business_exception_1.BusinessException('Failed to fetch brand customer analytics', 'BRAND_CUSTOMER_ANALYTICS_FAILED', 500, { brandId, error: allErr.message });
            }
            const { data: periodOrders, error: periodErr } = await sb
                .from('orders')
                .select('id, customer_phone, total_amount, created_at, status')
                .eq('brand_id', brandId)
                .gte('created_at', periodStart)
                .lte('created_at', periodEnd)
                .in('status', validStatuses);
            if (periodErr) {
                throw new business_exception_1.BusinessException('Failed to fetch brand customer analytics', 'BRAND_CUSTOMER_ANALYTICS_FAILED', 500, { brandId, error: periodErr.message });
            }
            const allOrdersList = allOrders || [];
            const periodOrdersList = periodOrders || [];
            const customerMap = new Map();
            allOrdersList.forEach((order) => {
                const phone = order.customer_phone || 'anonymous';
                const c = customerMap.get(phone) || { orderCount: 0, totalSpent: 0 };
                c.orderCount += 1;
                c.totalSpent += order.total_amount || 0;
                customerMap.set(phone, c);
            });
            const newCustomerPhones = new Set();
            periodOrdersList.forEach((order) => {
                const phone = order.customer_phone || 'anonymous';
                const firstOrder = allOrdersList
                    .filter((o) => o.customer_phone === phone)
                    .sort((a, b) => new Date(a.created_at).getTime() -
                    new Date(b.created_at).getTime())[0];
                if (firstOrder &&
                    new Date(firstOrder.created_at) >= new Date(periodStart) &&
                    new Date(firstOrder.created_at) <= new Date(periodEnd)) {
                    newCustomerPhones.add(phone);
                }
            });
            const returningCustomers = Array.from(customerMap.values()).filter((c) => c.orderCount > 1).length;
            const totalCustomers = customerMap.size;
            const totalRevenue = Array.from(customerMap.values()).reduce((sum, c) => sum + c.totalSpent, 0);
            const clv = totalCustomers > 0 ? Math.round(totalRevenue / totalCustomers) : 0;
            const repeatCustomerRate = totalCustomers > 0
                ? parseFloat(((returningCustomers / totalCustomers) * 100).toFixed(2))
                : 0;
            const avgOrdersPerCustomer = totalCustomers > 0
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
            return this.withComparison(compare, currentData, async () => {
                const prev = this.getPreviousPeriod(startDate, endDate);
                return fetchForPeriod(prev.start, prev.end);
            }, [
                'totalCustomers',
                'newCustomers',
                'returningCustomers',
                'clv',
                'repeatCustomerRate',
            ]);
        }
        catch (error) {
            if (error instanceof business_exception_1.BusinessException)
                throw error;
            this.logger.error('Unexpected error in getBrandCustomerAnalytics', error);
            throw new business_exception_1.BusinessException('Failed to fetch brand customer analytics', 'BRAND_CUSTOMER_ANALYTICS_ERROR', 500);
        }
    }
    async getAbcAnalysis(branchId, startDate, endDate) {
        this.logger.log(`Fetching ABC analysis for branch: ${branchId}`);
        const sb = this.supabase.adminClient();
        const dateRange = this.getDateRange(startDate, endDate);
        try {
            const { data: orderItems, error } = await sb
                .from('order_items')
                .select(`product_id, product_name_snapshot, qty, unit_price_snapshot,
           order:orders!inner(id, status, created_at, branch_id)`)
                .eq('order.branch_id', branchId)
                .gte('order.created_at', dateRange.start)
                .lte('order.created_at', dateRange.end)
                .in('order.status', ['COMPLETED', 'READY', 'PREPARING', 'CONFIRMED']);
            if (error) {
                throw new business_exception_1.BusinessException('Failed to fetch ABC analysis', 'ABC_ANALYSIS_FAILED', 500, { branchId, error: error.message });
            }
            const items = orderItems || [];
            const productMap = new Map();
            items.forEach((item) => {
                const pid = item.product_id || 'unknown';
                const cur = productMap.get(pid) || {
                    name: item.product_name_snapshot || 'Unknown',
                    revenue: 0,
                };
                cur.revenue += (item.qty || 0) * (item.unit_price_snapshot || 0);
                productMap.set(pid, cur);
            });
            const totalRevenue = Array.from(productMap.values()).reduce((s, p) => s + p.revenue, 0);
            const sorted = Array.from(productMap.entries())
                .map(([productId, data]) => ({
                productId,
                productName: data.name,
                revenue: data.revenue,
                revenuePercentage: totalRevenue > 0
                    ? parseFloat(((data.revenue / totalRevenue) * 100).toFixed(2))
                    : 0,
            }))
                .sort((a, b) => b.revenue - a.revenue);
            let cumulative = 0;
            const abcItems = sorted.map((item) => {
                cumulative += item.revenuePercentage;
                const grade = cumulative <= 70 ? 'A' : cumulative <= 90 ? 'B' : 'C';
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
                        revenuePercentage: parseFloat(gradeA.reduce((s, i) => s + i.revenuePercentage, 0).toFixed(2)),
                    },
                    gradeB: {
                        count: gradeB.length,
                        revenuePercentage: parseFloat(gradeB.reduce((s, i) => s + i.revenuePercentage, 0).toFixed(2)),
                    },
                    gradeC: {
                        count: gradeC.length,
                        revenuePercentage: parseFloat(gradeC.reduce((s, i) => s + i.revenuePercentage, 0).toFixed(2)),
                    },
                },
            };
        }
        catch (error) {
            if (error instanceof business_exception_1.BusinessException)
                throw error;
            this.logger.error('Unexpected error in getAbcAnalysis', error);
            throw new business_exception_1.BusinessException('Failed to fetch ABC analysis', 'ABC_ANALYSIS_ERROR', 500);
        }
    }
    async getHourlyProductAnalysis(branchId, startDate, endDate) {
        this.logger.log(`Fetching hourly product analysis for branch: ${branchId}`);
        const sb = this.supabase.adminClient();
        const dateRange = this.getDateRange(startDate, endDate);
        try {
            const { data: orderItems, error } = await sb
                .from('order_items')
                .select(`product_id, product_name_snapshot, qty, unit_price_snapshot,
           order:orders!inner(id, status, created_at, branch_id)`)
                .eq('order.branch_id', branchId)
                .gte('order.created_at', dateRange.start)
                .lte('order.created_at', dateRange.end)
                .in('order.status', ['COMPLETED', 'READY', 'PREPARING', 'CONFIRMED']);
            if (error) {
                throw new business_exception_1.BusinessException('Failed to fetch hourly analysis', 'HOURLY_ANALYSIS_FAILED', 500, { branchId, error: error.message });
            }
            const items = orderItems || [];
            const hourMap = new Map();
            items.forEach((item) => {
                const hour = new Date(item.order.created_at).getHours();
                const orderId = item.order.id;
                if (!hourMap.has(hour)) {
                    hourMap.set(hour, { orderIds: new Set(), products: new Map() });
                }
                const hd = hourMap.get(hour);
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
            const hourlyData = Array.from(hourMap.entries())
                .map(([hour, data]) => {
                const topProducts = Array.from(data.products.entries())
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
        }
        catch (error) {
            if (error instanceof business_exception_1.BusinessException)
                throw error;
            this.logger.error('Unexpected error in getHourlyProductAnalysis', error);
            throw new business_exception_1.BusinessException('Failed to fetch hourly product analysis', 'HOURLY_ANALYSIS_ERROR', 500);
        }
    }
    async getCombinationAnalysis(branchId, startDate, endDate, minCount = 2) {
        this.logger.log(`Fetching combination analysis for branch: ${branchId}`);
        const sb = this.supabase.adminClient();
        const dateRange = this.getDateRange(startDate, endDate);
        try {
            const { data: orderItems, error } = await sb
                .from('order_items')
                .select(`product_id, product_name_snapshot,
           order:orders!inner(id, status, created_at, branch_id)`)
                .eq('order.branch_id', branchId)
                .gte('order.created_at', dateRange.start)
                .lte('order.created_at', dateRange.end)
                .in('order.status', ['COMPLETED', 'READY', 'PREPARING', 'CONFIRMED']);
            if (error) {
                throw new business_exception_1.BusinessException('Failed to fetch combination analysis', 'COMBINATION_ANALYSIS_FAILED', 500, { branchId, error: error.message });
            }
            const items = orderItems || [];
            const orderProducts = new Map();
            items.forEach((item) => {
                const orderId = item.order.id;
                if (!orderProducts.has(orderId)) {
                    orderProducts.set(orderId, new Map());
                }
                orderProducts
                    .get(orderId)
                    .set(item.product_id, item.product_name_snapshot || 'Unknown');
            });
            const totalOrdersAnalyzed = orderProducts.size;
            const pairMap = new Map();
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
                                        productName: products.get(productIds[i]),
                                    },
                                    {
                                        productId: productIds[j],
                                        productName: products.get(productIds[j]),
                                    },
                                ],
                                count: 0,
                            });
                        }
                        pairMap.get(key).count += 1;
                    }
                }
            });
            const combinations = Array.from(pairMap.values())
                .filter((p) => p.count >= minCount)
                .map((p) => ({
                products: p.products,
                coOrderCount: p.count,
                supportRate: totalOrdersAnalyzed > 0
                    ? parseFloat(((p.count / totalOrdersAnalyzed) * 100).toFixed(2))
                    : 0,
            }))
                .sort((a, b) => b.coOrderCount - a.coOrderCount)
                .slice(0, 20);
            return { combinations, totalOrdersAnalyzed };
        }
        catch (error) {
            if (error instanceof business_exception_1.BusinessException)
                throw error;
            this.logger.error('Unexpected error in getCombinationAnalysis', error);
            throw new business_exception_1.BusinessException('Failed to fetch combination analysis', 'COMBINATION_ANALYSIS_ERROR', 500);
        }
    }
    async getCohortAnalysis(branchId, startDate, endDate, granularity = 'MONTH') {
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
                throw new business_exception_1.BusinessException('Failed to fetch cohort analysis', 'COHORT_ANALYSIS_FAILED', 500, { branchId, error: error.message });
            }
            const orderList = orders || [];
            const customerOrders = new Map();
            orderList.forEach((order) => {
                const phone = order.customer_phone || 'anonymous';
                if (!customerOrders.has(phone)) {
                    customerOrders.set(phone, []);
                }
                customerOrders.get(phone).push(new Date(order.created_at));
            });
            const getPeriodKey = (date) => {
                if (granularity === 'WEEK') {
                    const d = new Date(date);
                    const day = d.getDay();
                    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                    d.setDate(diff);
                    return d.toISOString().split('T')[0];
                }
                return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            };
            const getPeriodDiff = (cohortKey, periodKey) => {
                if (granularity === 'WEEK') {
                    const diff = new Date(periodKey).getTime() - new Date(cohortKey).getTime();
                    return Math.round(diff / (7 * 24 * 60 * 60 * 1000));
                }
                const [cy, cm] = cohortKey.split('-').map(Number);
                const [py, pm] = periodKey.split('-').map(Number);
                return (py - cy) * 12 + (pm - cm);
            };
            const cohortMap = new Map();
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
                const cohort = cohortMap.get(cohortKey);
                cohort.customers.add(phone);
                dates.forEach((date) => {
                    const periodKey = getPeriodKey(date);
                    const diff = getPeriodDiff(cohortKey, periodKey);
                    if (!cohort.periodActivity.has(diff)) {
                        cohort.periodActivity.set(diff, new Set());
                    }
                    cohort.periodActivity.get(diff).add(phone);
                });
            });
            const cohorts = Array.from(cohortMap.entries())
                .map(([cohort, data]) => {
                const cohortSize = data.customers.size;
                const maxPeriod = Math.max(0, ...Array.from(data.periodActivity.keys()));
                const retention = [];
                for (let p = 0; p <= maxPeriod; p++) {
                    const active = data.periodActivity.get(p)?.size || 0;
                    retention.push({
                        period: p,
                        activeCustomers: active,
                        retentionRate: cohortSize > 0
                            ? parseFloat(((active / cohortSize) * 100).toFixed(2))
                            : 0,
                    });
                }
                return { cohort, cohortSize, retention };
            })
                .sort((a, b) => a.cohort.localeCompare(b.cohort));
            return { cohorts, granularity };
        }
        catch (error) {
            if (error instanceof business_exception_1.BusinessException)
                throw error;
            this.logger.error('Unexpected error in getCohortAnalysis', error);
            throw new business_exception_1.BusinessException('Failed to fetch cohort analysis', 'COHORT_ANALYSIS_ERROR', 500);
        }
    }
    async getRfmAnalysis(branchId, startDate, endDate) {
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
                throw new business_exception_1.BusinessException('Failed to fetch RFM analysis', 'RFM_ANALYSIS_FAILED', 500, { branchId, error: error.message });
            }
            const orderList = orders || [];
            const now = new Date();
            const customerData = new Map();
            orderList.forEach((order) => {
                const phone = order.customer_phone || 'anonymous';
                const date = new Date(order.created_at);
                const cur = customerData.get(phone) || {
                    lastOrder: date,
                    orderCount: 0,
                    totalSpent: 0,
                };
                if (date > cur.lastOrder)
                    cur.lastOrder = date;
                cur.orderCount += 1;
                cur.totalSpent += order.total_amount || 0;
                customerData.set(phone, cur);
            });
            const customers = Array.from(customerData.entries()).map(([phone, data]) => ({
                phone,
                recency: Math.floor((now.getTime() - data.lastOrder.getTime()) / (1000 * 60 * 60 * 24)),
                frequency: data.orderCount,
                monetary: data.totalSpent,
            }));
            if (customers.length === 0) {
                return { customers: [], summary: [] };
            }
            const recencies = customers.map((c) => c.recency).sort((a, b) => a - b);
            const frequencies = customers
                .map((c) => c.frequency)
                .sort((a, b) => a - b);
            const monetaries = customers.map((c) => c.monetary).sort((a, b) => a - b);
            const getQuintile = (value, sorted, inverse = false) => {
                const idx = sorted.indexOf(value);
                const pct = idx / sorted.length;
                const score = Math.min(5, Math.floor(pct * 5) + 1);
                return inverse ? 6 - score : score;
            };
            const rfmCustomers = customers.map((c) => {
                const rScore = getQuintile(c.recency, recencies, true);
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
            const segmentMap = new Map();
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
            const summary = Array.from(segmentMap.entries())
                .map(([segment, data]) => ({
                segment,
                customerCount: data.count,
                avgRecency: Math.round(data.totalR / data.count),
                avgFrequency: parseFloat((data.totalF / data.count).toFixed(2)),
                avgMonetary: Math.round(data.totalM / data.count),
            }))
                .sort((a, b) => b.customerCount - a.customerCount);
            return { customers: rfmCustomers, summary };
        }
        catch (error) {
            if (error instanceof business_exception_1.BusinessException)
                throw error;
            this.logger.error('Unexpected error in getRfmAnalysis', error);
            throw new business_exception_1.BusinessException('Failed to fetch RFM analysis', 'RFM_ANALYSIS_ERROR', 500);
        }
    }
    getRfmSegment(r, f, m) {
        const avg = (r + f + m) / 3;
        if (r >= 4 && f >= 4 && m >= 4)
            return 'Champions';
        if (r >= 3 && f >= 3)
            return 'Loyal';
        if (r >= 4 && f <= 2)
            return 'New';
        if (r >= 3 && f >= 2)
            return 'Potential';
        if (r <= 2 && f >= 3)
            return 'At Risk';
        if (avg <= 2)
            return 'Lost';
        return 'Potential';
    }
    async getBrandAbcAnalysis(brandId, startDate, endDate) {
        this.logger.log(`Fetching brand ABC analysis for brand: ${brandId}`);
        const sb = this.supabase.adminClient();
        const dateRange = this.getDateRange(startDate, endDate);
        try {
            const { data: orderItems, error } = await sb
                .from('order_items')
                .select(`product_id, product_name_snapshot, qty, unit_price_snapshot,
           order:orders!inner(id, status, created_at, brand_id)`)
                .eq('order.brand_id', brandId)
                .gte('order.created_at', dateRange.start)
                .lte('order.created_at', dateRange.end)
                .in('order.status', ['COMPLETED', 'READY', 'PREPARING', 'CONFIRMED']);
            if (error) {
                throw new business_exception_1.BusinessException('Failed to fetch brand ABC analysis', 'BRAND_ABC_FAILED', 500, { brandId, error: error.message });
            }
            const items = orderItems || [];
            const productMap = new Map();
            items.forEach((item) => {
                const pid = item.product_id || 'unknown';
                const cur = productMap.get(pid) || {
                    name: item.product_name_snapshot || 'Unknown',
                    revenue: 0,
                };
                cur.revenue += (item.qty || 0) * (item.unit_price_snapshot || 0);
                productMap.set(pid, cur);
            });
            const totalRevenue = Array.from(productMap.values()).reduce((s, p) => s + p.revenue, 0);
            const sorted = Array.from(productMap.entries())
                .map(([productId, data]) => ({
                productId,
                productName: data.name,
                revenue: data.revenue,
                revenuePercentage: totalRevenue > 0
                    ? parseFloat(((data.revenue / totalRevenue) * 100).toFixed(2))
                    : 0,
            }))
                .sort((a, b) => b.revenue - a.revenue);
            let cumulative = 0;
            const abcItems = sorted.map((item) => {
                cumulative += item.revenuePercentage;
                const grade = cumulative <= 70 ? 'A' : cumulative <= 90 ? 'B' : 'C';
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
                        revenuePercentage: parseFloat(gradeA.reduce((s, i) => s + i.revenuePercentage, 0).toFixed(2)),
                    },
                    gradeB: {
                        count: gradeB.length,
                        revenuePercentage: parseFloat(gradeB.reduce((s, i) => s + i.revenuePercentage, 0).toFixed(2)),
                    },
                    gradeC: {
                        count: gradeC.length,
                        revenuePercentage: parseFloat(gradeC.reduce((s, i) => s + i.revenuePercentage, 0).toFixed(2)),
                    },
                },
            };
        }
        catch (error) {
            if (error instanceof business_exception_1.BusinessException)
                throw error;
            this.logger.error('Unexpected error in getBrandAbcAnalysis', error);
            throw new business_exception_1.BusinessException('Failed to fetch brand ABC analysis', 'BRAND_ABC_ERROR', 500);
        }
    }
    async getBrandCohortAnalysis(brandId, startDate, endDate, granularity = 'MONTH') {
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
                throw new business_exception_1.BusinessException('Failed to fetch brand cohort analysis', 'BRAND_COHORT_FAILED', 500, { brandId, error: error.message });
            }
            const orderList = orders || [];
            const customerOrders = new Map();
            orderList.forEach((order) => {
                const phone = order.customer_phone || 'anonymous';
                if (!customerOrders.has(phone))
                    customerOrders.set(phone, []);
                customerOrders.get(phone).push(new Date(order.created_at));
            });
            const getPeriodKey = (date) => {
                if (granularity === 'WEEK') {
                    const d = new Date(date);
                    const day = d.getDay();
                    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                    d.setDate(diff);
                    return d.toISOString().split('T')[0];
                }
                return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            };
            const getPeriodDiff = (cohortKey, periodKey) => {
                if (granularity === 'WEEK') {
                    return Math.round((new Date(periodKey).getTime() - new Date(cohortKey).getTime()) /
                        (7 * 24 * 60 * 60 * 1000));
                }
                const [cy, cm] = cohortKey.split('-').map(Number);
                const [py, pm] = periodKey.split('-').map(Number);
                return (py - cy) * 12 + (pm - cm);
            };
            const cohortMap = new Map();
            customerOrders.forEach((dates, phone) => {
                dates.sort((a, b) => a.getTime() - b.getTime());
                const cohortKey = getPeriodKey(dates[0]);
                if (!cohortMap.has(cohortKey))
                    cohortMap.set(cohortKey, {
                        customers: new Set(),
                        periodActivity: new Map(),
                    });
                const cohort = cohortMap.get(cohortKey);
                cohort.customers.add(phone);
                dates.forEach((date) => {
                    const diff = getPeriodDiff(cohortKey, getPeriodKey(date));
                    if (!cohort.periodActivity.has(diff))
                        cohort.periodActivity.set(diff, new Set());
                    cohort.periodActivity.get(diff).add(phone);
                });
            });
            const cohorts = Array.from(cohortMap.entries())
                .map(([cohort, data]) => {
                const cohortSize = data.customers.size;
                const maxPeriod = Math.max(0, ...Array.from(data.periodActivity.keys()));
                const retention = [];
                for (let p = 0; p <= maxPeriod; p++) {
                    const active = data.periodActivity.get(p)?.size || 0;
                    retention.push({
                        period: p,
                        activeCustomers: active,
                        retentionRate: cohortSize > 0
                            ? parseFloat(((active / cohortSize) * 100).toFixed(2))
                            : 0,
                    });
                }
                return { cohort, cohortSize, retention };
            })
                .sort((a, b) => a.cohort.localeCompare(b.cohort));
            return { cohorts, granularity };
        }
        catch (error) {
            if (error instanceof business_exception_1.BusinessException)
                throw error;
            this.logger.error('Unexpected error in getBrandCohortAnalysis', error);
            throw new business_exception_1.BusinessException('Failed to fetch brand cohort analysis', 'BRAND_COHORT_ERROR', 500);
        }
    }
    async getBrandRfmAnalysis(brandId, startDate, endDate) {
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
                throw new business_exception_1.BusinessException('Failed to fetch brand RFM analysis', 'BRAND_RFM_FAILED', 500, { brandId, error: error.message });
            }
            const orderList = orders || [];
            const now = new Date();
            const customerData = new Map();
            orderList.forEach((order) => {
                const phone = order.customer_phone || 'anonymous';
                const date = new Date(order.created_at);
                const cur = customerData.get(phone) || {
                    lastOrder: date,
                    orderCount: 0,
                    totalSpent: 0,
                };
                if (date > cur.lastOrder)
                    cur.lastOrder = date;
                cur.orderCount += 1;
                cur.totalSpent += order.total_amount || 0;
                customerData.set(phone, cur);
            });
            const customers = Array.from(customerData.entries()).map(([phone, data]) => ({
                phone,
                recency: Math.floor((now.getTime() - data.lastOrder.getTime()) / (1000 * 60 * 60 * 24)),
                frequency: data.orderCount,
                monetary: data.totalSpent,
            }));
            if (customers.length === 0) {
                return { customers: [], summary: [] };
            }
            const recencies = customers.map((c) => c.recency).sort((a, b) => a - b);
            const frequencies = customers
                .map((c) => c.frequency)
                .sort((a, b) => a - b);
            const monetaries = customers.map((c) => c.monetary).sort((a, b) => a - b);
            const getQuintile = (value, sorted, inverse = false) => {
                const idx = sorted.indexOf(value);
                const pct = idx / sorted.length;
                const score = Math.min(5, Math.floor(pct * 5) + 1);
                return inverse ? 6 - score : score;
            };
            const rfmCustomers = customers.map((c) => {
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
            const segmentMap = new Map();
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
            const summary = Array.from(segmentMap.entries())
                .map(([segment, data]) => ({
                segment,
                customerCount: data.count,
                avgRecency: Math.round(data.totalR / data.count),
                avgFrequency: parseFloat((data.totalF / data.count).toFixed(2)),
                avgMonetary: Math.round(data.totalM / data.count),
            }))
                .sort((a, b) => b.customerCount - a.customerCount);
            return { customers: rfmCustomers, summary };
        }
        catch (error) {
            if (error instanceof business_exception_1.BusinessException)
                throw error;
            this.logger.error('Unexpected error in getBrandRfmAnalysis', error);
            throw new business_exception_1.BusinessException('Failed to fetch brand RFM analysis', 'BRAND_RFM_ERROR', 500);
        }
    }
};
exports.AnalyticsService = AnalyticsService;
exports.AnalyticsService = AnalyticsService = AnalyticsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], AnalyticsService);
//# sourceMappingURL=analytics.service.js.map