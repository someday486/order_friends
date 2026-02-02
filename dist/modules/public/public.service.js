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
exports.PublicService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../../infra/supabase/supabase.service");
let PublicService = class PublicService {
    supabase;
    constructor(supabase) {
        this.supabase = supabase;
    }
    async getBranch(branchId) {
        const sb = this.supabase.anonClient();
        const { data, error } = await sb
            .from('branches')
            .select(`
        id,
        name,
        brands (
          name
        )
      `)
            .eq('id', branchId)
            .single();
        if (error || !data) {
            throw new common_1.NotFoundException('가게를 찾을 수 없습니다.');
        }
        return {
            id: data.id,
            name: data.name,
            brandName: data.brands?.name ?? undefined,
        };
    }
    async getProducts(branchId) {
        const sb = this.supabase.anonClient();
        const { data, error } = await sb
            .from('products')
            .select(`
        id,
        name,
        description,
        price,
        product_options (
          id,
          name,
          price_delta,
          is_active
        )
      `)
            .eq('branch_id', branchId)
            .eq('is_active', true)
            .order('sort_order', { ascending: true });
        if (error) {
            throw new Error(`[public.getProducts] ${error.message}`);
        }
        return (data ?? []).map((product) => ({
            id: product.id,
            name: product.name,
            description: product.description ?? null,
            price: product.price ?? 0,
            options: (product.product_options ?? [])
                .filter((opt) => opt.is_active)
                .map((opt) => ({
                id: opt.id,
                name: opt.name,
                priceDelta: opt.price_delta ?? 0,
            })),
        }));
    }
    async createOrder(dto) {
        const sb = this.supabase.anonClient();
        const productIds = dto.items.map((item) => item.productId);
        const { data: products, error: productsError } = await sb
            .from('products')
            .select(`
        id,
        name,
        price,
        branch_id,
        product_options (
          id,
          name,
          price_delta
        )
      `)
            .in('id', productIds);
        if (productsError) {
            throw new Error(`상품 조회 실패: ${productsError.message}`);
        }
        const productMap = new Map(products?.map((p) => [p.id, p]) ?? []);
        for (const product of products ?? []) {
            if (product.branch_id !== dto.branchId) {
                throw new common_1.BadRequestException('다른 가게의 상품이 포함되어 있습니다.');
            }
        }
        let subtotalAmount = 0;
        const orderItemsData = [];
        for (const item of dto.items) {
            const product = productMap.get(item.productId);
            if (!product) {
                throw new common_1.BadRequestException(`상품을 찾을 수 없습니다: ${item.productId}`);
            }
            let itemPrice = product.price;
            const optionSnapshots = [];
            if (item.options && item.options.length > 0) {
                const optionMap = new Map((product.product_options ?? []).map((o) => [o.id, o]));
                for (const opt of item.options) {
                    const optionData = optionMap.get(opt.optionId);
                    if (optionData) {
                        itemPrice += optionData.price_delta ?? 0;
                        optionSnapshots.push({
                            product_option_id: optionData.id,
                            option_name_snapshot: optionData.name,
                            price_delta_snapshot: optionData.price_delta ?? 0,
                        });
                    }
                }
            }
            subtotalAmount += itemPrice * item.qty;
            orderItemsData.push({
                product_id: product.id,
                product_name_snapshot: product.name,
                qty: item.qty,
                unit_price: itemPrice,
                options: optionSnapshots,
            });
        }
        const totalAmount = subtotalAmount;
        const { data: order, error: orderError } = await sb
            .from('orders')
            .insert({
            branch_id: dto.branchId,
            customer_name: dto.customerName,
            customer_phone: dto.customerPhone ?? null,
            customer_address1: dto.customerAddress1 ?? null,
            customer_address2: dto.customerAddress2 ?? null,
            customer_memo: dto.customerMemo ?? null,
            payment_method: dto.paymentMethod ?? 'CARD',
            subtotal_amount: subtotalAmount,
            shipping_fee: 0,
            discount_amount: 0,
            total_amount: totalAmount,
            status: 'CREATED',
            payment_status: 'PENDING',
        })
            .select('id, order_no, status, total_amount, created_at')
            .single();
        if (orderError) {
            throw new Error(`주문 생성 실패: ${orderError.message}`);
        }
        for (const itemData of orderItemsData) {
            const { data: orderItem, error: itemError } = await sb
                .from('order_items')
                .insert({
                order_id: order.id,
                product_id: itemData.product_id,
                product_name_snapshot: itemData.product_name_snapshot,
                qty: itemData.qty,
                unit_price: itemData.unit_price,
            })
                .select('id')
                .single();
            if (itemError) {
                console.error('order_item insert error:', itemError);
                continue;
            }
            if (itemData.options && itemData.options.length > 0) {
                for (const opt of itemData.options) {
                    await sb.from('order_item_options').insert({
                        order_item_id: orderItem.id,
                        product_option_id: opt.product_option_id,
                        option_name_snapshot: opt.option_name_snapshot,
                        price_delta_snapshot: opt.price_delta_snapshot,
                    });
                }
            }
        }
        return {
            id: order.id,
            orderNo: order.order_no,
            status: order.status,
            totalAmount: order.total_amount,
            createdAt: order.created_at,
            items: orderItemsData.map((item) => ({
                name: item.product_name_snapshot,
                qty: item.qty,
                unitPrice: item.unit_price,
            })),
        };
    }
    async getOrder(orderId) {
        const sb = this.supabase.anonClient();
        let data = null;
        const { data: byId } = await sb
            .from('orders')
            .select(`
        id,
        order_no,
        status,
        total_amount,
        created_at,
        order_items (
          product_name_snapshot,
          qty,
          unit_price
        )
      `)
            .eq('id', orderId)
            .maybeSingle();
        if (byId) {
            data = byId;
        }
        else {
            const { data: byOrderNo } = await sb
                .from('orders')
                .select(`
          id,
          order_no,
          status,
          total_amount,
          created_at,
          order_items (
            product_name_snapshot,
            qty,
            unit_price
          )
        `)
                .eq('order_no', orderId)
                .maybeSingle();
            data = byOrderNo;
        }
        if (!data) {
            throw new common_1.NotFoundException('주문을 찾을 수 없습니다.');
        }
        return {
            id: data.id,
            orderNo: data.order_no,
            status: data.status,
            totalAmount: data.total_amount,
            createdAt: data.created_at,
            items: (data.order_items ?? []).map((item) => ({
                name: item.product_name_snapshot,
                qty: item.qty,
                unitPrice: item.unit_price,
            })),
        };
    }
};
exports.PublicService = PublicService;
exports.PublicService = PublicService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], PublicService);
//# sourceMappingURL=public.service.js.map