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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../../infra/supabase/supabase.service");
let OrdersService = class OrdersService {
    supabase;
    constructor(supabase) {
        this.supabase = supabase;
    }
    isUuid(v) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
    }
    async resolveOrderId(sb, orderIdOrNo) {
        if (this.isUuid(orderIdOrNo)) {
            const byId = await sb.from('orders').select('id').eq('id', orderIdOrNo).maybeSingle();
            if (!byId.error && byId.data?.id)
                return byId.data.id;
        }
        const byNo = await sb.from('orders').select('id').eq('order_no', orderIdOrNo).maybeSingle();
        if (!byNo.error && byNo.data?.id)
            return byNo.data.id;
        return null;
    }
    async getOrders(accessToken) {
        const sb = this.supabase.adminClient();
        const { data, error } = await sb
            .from('orders')
            .select('id, order_no, status, created_at, total_amount, customer_name')
            .order('created_at', { ascending: false })
            .limit(50);
        if (error) {
            throw new Error(`[orders.getOrders] ${error.message}`);
        }
        return (data ?? []).map((row) => ({
            id: row.id,
            orderNo: row.order_no ?? null,
            orderedAt: row.created_at ?? '',
            customerName: row.customer_name ?? '',
            totalAmount: row.total_amount ?? 0,
            status: row.status,
        }));
    }
    async getOrder(accessToken, orderId) {
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
        const resolvedId = await this.resolveOrderId(sb, orderId);
        if (!resolvedId) {
            throw new Error(`[orders.getOrder] order not found: ${orderId}`);
        }
        const { data, error } = await sb.from('orders').select(selectDetail).eq('id', resolvedId).maybeSingle();
        if (error) {
            throw new Error(`[orders.getOrder] ${error.message}`);
        }
        if (!data) {
            throw new Error(`[orders.getOrder] order not found: ${orderId}`);
        }
        const items = (data.items ?? []).map((it) => {
            const opts = (it.options ?? []).map((o) => o.option_name_snapshot).filter(Boolean);
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
    async updateStatus(accessToken, orderId, status) {
        const sb = this.supabase.adminClient();
        const resolvedId = await this.resolveOrderId(sb, orderId);
        if (!resolvedId) {
            throw new Error(`[orders.updateStatus] order not found: ${orderId}`);
        }
        const { data, error } = await sb
            .from('orders')
            .update({ status })
            .eq('id', resolvedId)
            .select('id, order_no, status')
            .maybeSingle();
        if (error) {
            throw new Error(`[orders.updateStatus] ${error.message}`);
        }
        if (!data) {
            throw new Error(`[orders.updateStatus] order not found or not permitted: ${orderId}`);
        }
        return {
            id: data.id,
            orderNo: data.order_no ?? null,
            status: data.status,
        };
    }
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], OrdersService);
//# sourceMappingURL=orders.service.js.map