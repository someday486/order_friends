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
var CustomerOrdersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerOrdersService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../../infra/supabase/supabase.service");
const pagination_util_1 = require("../../common/utils/pagination.util");
let CustomerOrdersService = CustomerOrdersService_1 = class CustomerOrdersService {
    supabase;
    logger = new common_1.Logger(CustomerOrdersService_1.name);
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
    async checkBranchAccess(branchId, userId, brandMemberships, branchMemberships) {
        const sb = this.supabase.adminClient();
        const { data: branch, error } = await sb
            .from('branches')
            .select('id, brand_id, name, slug, created_at')
            .eq('id', branchId)
            .single();
        if (error || !branch) {
            throw new common_1.NotFoundException('Branch not found');
        }
        const branchMembership = branchMemberships.find((m) => m.branch_id === branchId);
        if (branchMembership) {
            return { branchMembership, branch };
        }
        const brandMembership = brandMemberships.find((m) => m.brand_id === branch.brand_id);
        if (brandMembership) {
            return { brandMembership, branch };
        }
        throw new common_1.ForbiddenException('You do not have access to this branch');
    }
    async checkOrderAccess(orderId, userId, brandMemberships, branchMemberships) {
        const sb = this.supabase.adminClient();
        const resolvedId = await this.resolveOrderId(sb, orderId);
        if (!resolvedId) {
            throw new common_1.NotFoundException('Order not found');
        }
        const { data: order, error } = await sb
            .from('orders')
            .select('*, branches!inner(id, brand_id)')
            .eq('id', resolvedId)
            .single();
        if (error || !order) {
            throw new common_1.NotFoundException('Order not found');
        }
        const branchId = order.branch_id;
        const brandId = order.branches.brand_id;
        const branchMembership = branchMemberships.find((m) => m.branch_id === branchId);
        if (branchMembership) {
            return { role: branchMembership.role, order };
        }
        const brandMembership = brandMemberships.find((m) => m.brand_id === brandId);
        if (brandMembership) {
            return { role: brandMembership.role, order };
        }
        throw new common_1.ForbiddenException('You do not have access to this order');
    }
    checkModificationPermission(role, action, userId) {
        if (role !== 'OWNER' && role !== 'ADMIN') {
            this.logger.warn(`User ${userId} with role ${role} attempted to ${action}`);
            throw new common_1.ForbiddenException(`Only OWNER or ADMIN can ${action}`);
        }
    }
    async getMyOrders(userId, branchId, brandMemberships, branchMemberships, paginationDto = {}, status) {
        this.logger.log(`Fetching orders for branch ${branchId} by user ${userId}`);
        await this.checkBranchAccess(branchId, userId, brandMemberships, branchMemberships);
        const { page = 1, limit = 20 } = paginationDto;
        const sb = this.supabase.adminClient();
        const { from, to } = pagination_util_1.PaginationUtil.getRange(page, limit);
        let countQuery = sb
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('branch_id', branchId);
        if (status) {
            countQuery = countQuery.eq('status', status);
        }
        const { count, error: countError } = await countQuery;
        if (countError) {
            this.logger.error(`Failed to count orders for branch ${branchId}`, countError);
            throw new Error('Failed to count orders');
        }
        let dataQuery = sb
            .from('orders')
            .select('id, order_no, status, created_at, total_amount, customer_name')
            .eq('branch_id', branchId)
            .order('created_at', { ascending: false })
            .range(from, to);
        if (status) {
            dataQuery = dataQuery.eq('status', status);
        }
        const { data, error } = await dataQuery;
        if (error) {
            this.logger.error(`Failed to fetch orders for branch ${branchId}`, error);
            throw new Error('Failed to fetch orders');
        }
        const orders = (data ?? []).map((row) => ({
            id: row.id,
            orderNo: row.order_no ?? null,
            orderedAt: row.created_at ?? '',
            customerName: row.customer_name ?? '',
            totalAmount: row.total_amount ?? 0,
            status: row.status,
        }));
        this.logger.log(`Fetched ${orders.length} orders for branch ${branchId}`);
        return pagination_util_1.PaginationUtil.createResponse(orders, count || 0, paginationDto);
    }
    async getMyOrder(userId, orderId, brandMemberships, branchMemberships) {
        this.logger.log(`Fetching order ${orderId} by user ${userId}`);
        const { order } = await this.checkOrderAccess(orderId, userId, brandMemberships, branchMemberships);
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
        const { data, error } = await sb
            .from('orders')
            .select(selectDetail)
            .eq('id', order.id)
            .maybeSingle();
        if (error || !data) {
            this.logger.error(`Failed to fetch order ${orderId}`, error);
            throw new common_1.NotFoundException('Order not found');
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
    async updateMyOrderStatus(userId, orderId, status, brandMemberships, branchMemberships) {
        this.logger.log(`Updating order ${orderId} status to ${status} by user ${userId}`);
        const { role, order } = await this.checkOrderAccess(orderId, userId, brandMemberships, branchMemberships);
        this.checkModificationPermission(role, 'update order status', userId);
        const sb = this.supabase.adminClient();
        const { data, error } = await sb
            .from('orders')
            .update({ status })
            .eq('id', order.id)
            .select('id, order_no, status, created_at, customer_name, total_amount')
            .single();
        if (error || !data) {
            this.logger.error(`Failed to update order ${orderId} status`, error);
            throw new Error('Failed to update order status');
        }
        this.logger.log(`Order ${orderId} status updated to ${status} successfully`);
        return {
            id: data.id,
            orderNo: data.order_no ?? null,
            orderedAt: data.created_at ?? '',
            customerName: data.customer_name ?? '',
            totalAmount: data.total_amount ?? 0,
            status: data.status,
        };
    }
};
exports.CustomerOrdersService = CustomerOrdersService;
exports.CustomerOrdersService = CustomerOrdersService = CustomerOrdersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], CustomerOrdersService);
//# sourceMappingURL=customer-orders.service.js.map