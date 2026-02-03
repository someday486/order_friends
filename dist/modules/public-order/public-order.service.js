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
exports.PublicOrderService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../../infra/supabase/supabase.service");
let PublicOrderService = class PublicOrderService {
    supabase;
    constructor(supabase) {
        this.supabase = supabase;
    }
    getPriceFromRow(row) {
        if (!row)
            return 0;
        if (row.base_price !== undefined && row.base_price !== null)
            return row.base_price;
        if (row.price !== undefined && row.price !== null)
            return row.price;
        if (row.price_amount !== undefined && row.price_amount !== null)
            return row.price_amount;
        return 0;
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
            throw new common_1.NotFoundException('사용할 수 없는 가게입니다.');
        }
        return {
            id: data.id,
            name: data.name,
            brandName: data.brands?.name ?? undefined,
        };
    }
    async getBranchBySlug(slug) {
        const sb = this.supabase.anonClient();
        const { data, error } = await sb
            .from('branches')
            .select(`
        id,
        name,
        slug,
        brands (
          name
        )
      `)
            .eq('slug', slug)
            .limit(2);
        if (error) {
            throw new common_1.NotFoundException('사용할 수 없는 가게입니다.');
        }
        if (!data || data.length === 0) {
            throw new common_1.NotFoundException('사용할 수 없는 가게입니다.');
        }
        if (data.length > 1) {
            throw new common_1.ConflictException('가게 URL이 중복되어 사용할 수 없습니다.');
        }
        const row = data[0];
        return {
            id: row.id,
            name: row.name,
            brandName: row.brands?.name ?? undefined,
        };
    }
    async getBranchByBrandSlug(brandSlug, branchSlug) {
        const sb = this.supabase.anonClient();
        const { data, error } = await sb
            .from('branches')
            .select(`
        id,
        name,
        slug,
        brands!inner (
          id,
          name,
          slug
        )
      `)
            .eq('slug', branchSlug)
            .eq('brands.slug', brandSlug)
            .limit(2);
        if (error) {
            throw new common_1.NotFoundException('사용할 수 없는 가게입니다.');
        }
        if (!data || data.length === 0) {
            throw new common_1.NotFoundException('사용할 수 없는 가게입니다.');
        }
        if (data.length > 1) {
            throw new common_1.ConflictException('가게 URL이 중복되어 사용할 수 없습니다.');
        }
        const row = data[0];
        return {
            id: row.id,
            name: row.name,
            brandName: row.brands?.name ?? undefined,
        };
    }
    async getProducts(branchId) {
        const sb = this.supabase.anonClient();
        const selectFields = '*';
        const buildBaseQuery = (includeIsHidden, includeIsSoldOut) => {
            let query = sb
                .from('products')
                .select(selectFields)
                .eq('branch_id', branchId);
            if (includeIsHidden) {
                query = query.eq('is_hidden', false);
            }
            if (includeIsSoldOut) {
                query = query.eq('is_sold_out', false);
            }
            return query;
        };
        let data;
        let error;
        let includeIsHidden = true;
        let includeIsSoldOut = true;
        for (let attempt = 0; attempt < 4; attempt += 1) {
            const query = buildBaseQuery(includeIsHidden, includeIsSoldOut);
            const orderedQuery = query.order('created_at', { ascending: false });
            ({ data, error } = await orderedQuery);
            if (!error)
                break;
            const message = error.message ?? '';
            let retried = false;
            if (message.includes('is_hidden')) {
                includeIsHidden = false;
                retried = true;
            }
            if (message.includes('is_sold_out')) {
                includeIsSoldOut = false;
                retried = true;
            }
            if (!retried)
                break;
        }
        if (error) {
            throw new Error(`상품 목록 조회 실패: ${error.message}`);
        }
        const products = data ?? [];
        return products.map((product) => ({
            id: product.id,
            name: product.name,
            description: product.description ?? null,
            price: this.getPriceFromRow(product),
            options: [],
        }));
    }
    async createOrder(dto) {
        const sb = this.supabase.anonClient();
        const productIds = dto.items.map((item) => item.productId);
        const selectProductFields = '*';
        const { data: products, error: productsError } = await sb
            .from('products')
            .select(selectProductFields)
            .in('id', productIds);
        if (productsError) {
            throw new common_1.BadRequestException(`상품 조회 실패: ${productsError.message}`);
        }
        const productMap = new Map(products?.map((p) => [p.id, p]) ?? []);
        for (const product of products ?? []) {
            if (product.branch_id !== dto.branchId) {
                throw new common_1.BadRequestException('다른 가게의 상품이 포함되어 있습니다.');
            }
            if (product.is_hidden === true || product.is_sold_out === true) {
                throw new common_1.BadRequestException('판매 중지된 상품이 포함되어 있습니다.');
            }
        }
        if (dto.items.some((item) => item.options && item.options.length > 0)) {
            throw new common_1.BadRequestException('옵션 기능이 비활성화되어 있습니다.');
        }
        let subtotalAmount = 0;
        const orderItemsData = [];
        for (const item of dto.items) {
            const product = productMap.get(item.productId);
            if (!product) {
                throw new common_1.BadRequestException(`상품을 찾을 수 없습니다: ${item.productId}`);
            }
            let itemPrice = this.getPriceFromRow(product);
            const optionSnapshots = [];
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
            throw new common_1.BadRequestException(`주문 생성 실패: ${orderError.message}`);
        }
        const orderItemResults = [];
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
            const optionNames = [];
            if (itemData.options && itemData.options.length > 0) {
                for (const opt of itemData.options) {
                    const { error: optError } = await sb.from('order_item_options').insert({
                        order_item_id: orderItem.id,
                        product_option_id: opt.product_option_id,
                        option_name_snapshot: opt.option_name_snapshot,
                        price_delta_snapshot: opt.price_delta_snapshot,
                    });
                    if (!optError) {
                        optionNames.push(opt.option_name_snapshot);
                    }
                }
            }
            orderItemResults.push({
                productName: itemData.product_name_snapshot,
                qty: itemData.qty,
                unitPrice: itemData.unit_price,
                options: optionNames,
            });
        }
        return {
            id: order.id,
            orderNo: order.order_no,
            status: order.status,
            totalAmount: order.total_amount,
            createdAt: order.created_at,
            items: orderItemResults,
        };
    }
    async getOrder(orderIdOrNo) {
        const sb = this.supabase.anonClient();
        let { data, error } = await sb
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
          unit_price,
          order_item_options (
            option_name_snapshot
          )
        )
      `)
            .eq('id', orderIdOrNo)
            .maybeSingle();
        if (!data) {
            const result = await sb
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
            unit_price,
            order_item_options (
              option_name_snapshot
            )
          )
        `)
                .eq('order_no', orderIdOrNo)
                .maybeSingle();
            data = result.data;
            error = result.error;
        }
        if (error || !data) {
            throw new common_1.NotFoundException('주문을 찾을 수 없습니다.');
        }
        return {
            id: data.id,
            orderNo: data.order_no,
            status: data.status,
            totalAmount: data.total_amount,
            createdAt: data.created_at,
            items: (data.order_items ?? []).map((item) => ({
                productName: item.product_name_snapshot,
                qty: item.qty,
                unitPrice: item.unit_price,
                options: (item.order_item_options ?? []).map((o) => o.option_name_snapshot),
            })),
        };
    }
};
exports.PublicOrderService = PublicOrderService;
exports.PublicOrderService = PublicOrderService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], PublicOrderService);
//# sourceMappingURL=public-order.service.js.map