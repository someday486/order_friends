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
var OrdersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../../infra/supabase/supabase.service");
const order_exception_1 = require("../../common/exceptions/order.exception");
const business_exception_1 = require("../../common/exceptions/business.exception");
const pagination_util_1 = require("../../common/utils/pagination.util");
let OrdersService = OrdersService_1 = class OrdersService {
    supabase;
    logger = new common_1.Logger(OrdersService_1.name);
    constructor(supabase) {
        this.supabase = supabase;
    }
    isUuid(v) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
    }
    async resolveOrderId(sb, orderIdOrNo, branchId) {
        if (this.isUuid(orderIdOrNo)) {
            let query = sb.from('orders').select('id').eq('id', orderIdOrNo);
            if (branchId)
                query = query.eq('branch_id', branchId);
            const byId = await query.maybeSingle();
            if (!byId.error && byId.data?.id)
                return byId.data.id;
        }
        let noQuery = sb.from('orders').select('id').eq('order_no', orderIdOrNo);
        if (branchId)
            noQuery = noQuery.eq('branch_id', branchId);
        const byNo = await noQuery.maybeSingle();
        if (!byNo.error && byNo.data?.id)
            return byNo.data.id;
        return null;
    }
    async getOrders(accessToken, branchId, paginationDto = {}) {
        const { page = 1, limit = 20 } = paginationDto;
        this.logger.log(`Fetching orders for branch: ${branchId} (page: ${page}, limit: ${limit})`);
        const sb = this.supabase.adminClient();
        const { from, to } = pagination_util_1.PaginationUtil.getRange(page, limit);
        const { count, error: countError } = await sb
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('branch_id', branchId);
        if (countError) {
            this.logger.error(`Failed to count orders: ${countError.message}`, countError);
            throw new business_exception_1.BusinessException('Failed to count orders', 'ORDER_COUNT_FAILED', 500, { branchId, error: countError.message });
        }
        const { data, error } = await sb
            .from('orders')
            .select('id, order_no, status, created_at, total_amount, customer_name')
            .eq('branch_id', branchId)
            .order('created_at', { ascending: false })
            .range(from, to);
        if (error) {
            this.logger.error(`Failed to fetch orders: ${error.message}`, error);
            throw new business_exception_1.BusinessException('Failed to fetch orders', 'ORDER_FETCH_FAILED', 500, { branchId, error: error.message });
        }
        const orders = (data ?? []).map((row) => ({
            id: row.id,
            orderNo: row.order_no ?? null,
            orderedAt: row.created_at ?? '',
            customerName: row.customer_name ?? '',
            totalAmount: row.total_amount ?? 0,
            status: row.status,
        }));
        this.logger.log(`Fetched ${orders.length} orders for branch: ${branchId}`);
        return pagination_util_1.PaginationUtil.createResponse(orders, count || 0, paginationDto);
    }
    async getOrder(accessToken, orderId, branchId) {
        this.logger.log(`Fetching order detail: ${orderId} for branch: ${branchId}`);
        const sb = this.supabase.adminClient();
        const selectDetail = `
      id, order_no, status, created_at,
      customer_name, customer_phone,
      delivery_address, delivery_memo,
      subtotal, delivery_fee, discount_total, total_amount,
      items:order_items (
        id, product_name_snapshot, qty, unit_price_snapshot,
        options:order_item_options ( id, option_name_snapshot )
      )
    `;
        const resolvedId = await this.resolveOrderId(sb, orderId, branchId);
        if (!resolvedId) {
            this.logger.warn(`Order not found: ${orderId}`);
            throw new order_exception_1.OrderNotFoundException(orderId);
        }
        const { data, error } = await sb
            .from('orders')
            .select(selectDetail)
            .eq('id', resolvedId)
            .eq('branch_id', branchId)
            .maybeSingle();
        if (error) {
            this.logger.error(`Failed to fetch order: ${error.message}`, error);
            throw new business_exception_1.BusinessException('Failed to fetch order', 'ORDER_FETCH_FAILED', 500, { orderId, error: error.message });
        }
        if (!data) {
            throw new order_exception_1.OrderNotFoundException(orderId);
        }
        const items = (data.items ?? []).map((it) => {
            const opts = (it.options ?? [])
                .map((o) => o.option_name_snapshot)
                .filter(Boolean);
            return {
                id: it.id,
                name: it.product_name_snapshot ?? '',
                option: opts.length ? opts.join(', ') : undefined,
                qty: it.qty ?? 0,
                unitPrice: it.unit_price_snapshot ?? 0,
            };
        });
        return {
            id: data.id,
            orderNo: data.order_no ?? null,
            orderedAt: data.created_at ?? '',
            status: data.status,
            customer: {
                name: data.customer_name ?? '',
                phone: data.customer_phone ?? '',
                address1: data.delivery_address ?? '',
                address2: undefined,
                memo: data.delivery_memo ?? undefined,
            },
            payment: {
                method: 'CARD',
                subtotal: data.subtotal ?? 0,
                shippingFee: data.delivery_fee ?? 0,
                discount: data.discount_total ?? 0,
                total: data.total_amount ?? 0,
            },
            items,
        };
    }
    async updateStatus(accessToken, orderId, status, branchId) {
        this.logger.log(`Updating order status: ${orderId} to ${status}`);
        const sb = this.supabase.adminClient();
        const resolvedId = await this.resolveOrderId(sb, orderId, branchId);
        if (!resolvedId) {
            this.logger.warn(`Order not found for status update: ${orderId}`);
            throw new order_exception_1.OrderNotFoundException(orderId);
        }
        const { data, error } = await sb
            .from('orders')
            .update({ status })
            .eq('id', resolvedId)
            .eq('branch_id', branchId)
            .select('id, order_no, status')
            .maybeSingle();
        if (error) {
            this.logger.error(`Failed to update order status: ${error.message}`, error);
            throw new business_exception_1.BusinessException('Failed to update order status', 'ORDER_UPDATE_FAILED', 500, { orderId, status, error: error.message });
        }
        if (!data) {
            throw new order_exception_1.OrderNotFoundException(orderId);
        }
        if (status === 'CANCELLED') {
            try {
                const { data: orderItems } = await sb
                    .from('order_items')
                    .select('product_id, qty')
                    .eq('order_id', resolvedId);
                if (orderItems && orderItems.length > 0) {
                    const productIds = orderItems.map((item) => item.product_id);
                    const { data: inventories } = await sb
                        .from('product_inventory')
                        .select('product_id, qty_available, qty_reserved')
                        .in('product_id', productIds)
                        .eq('branch_id', branchId);
                    const inventoryMap = new Map(inventories?.map((inv) => [inv.product_id, inv]) ?? []);
                    for (const item of orderItems) {
                        const inventory = inventoryMap.get(item.product_id);
                        if (!inventory)
                            continue;
                        await sb
                            .from('product_inventory')
                            .update({
                            qty_available: inventory.qty_available + item.qty,
                            qty_reserved: Math.max(0, inventory.qty_reserved - item.qty),
                        })
                            .eq('product_id', item.product_id)
                            .eq('branch_id', branchId);
                        await sb.from('inventory_logs').insert({
                            product_id: item.product_id,
                            branch_id: branchId,
                            transaction_type: 'RELEASE',
                            qty_change: item.qty,
                            qty_before: inventory.qty_available,
                            qty_after: inventory.qty_available + item.qty,
                            reference_id: resolvedId,
                            reference_type: 'ORDER',
                            notes: `주문 취소로 인한 재고 복구 (주문번호: ${data.order_no})`,
                        });
                    }
                    this.logger.log(`Inventory released for cancelled order: ${data.order_no}`);
                }
            }
            catch (error) {
                this.logger.error(`Failed to release inventory for cancelled order ${resolvedId}`, error);
            }
        }
        this.logger.log(`Order status updated successfully: ${orderId} -> ${status}`);
        return {
            id: data.id,
            orderNo: data.order_no ?? null,
            status: data.status,
        };
    }
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = OrdersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], OrdersService);
//# sourceMappingURL=orders.service.js.map