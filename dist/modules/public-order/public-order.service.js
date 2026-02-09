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
var PublicOrderService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicOrderService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../../infra/supabase/supabase.service");
const inventory_service_1 = require("../inventory/inventory.service");
let PublicOrderService = PublicOrderService_1 = class PublicOrderService {
    supabase;
    inventoryService;
    logger = new common_1.Logger(PublicOrderService_1.name);
    constructor(supabase, inventoryService) {
        this.supabase = supabase;
        this.inventoryService = inventoryService;
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
    async rollbackOrder(adminClient, orderId) {
        try {
            await adminClient.from('order_items').delete().eq('order_id', orderId);
        }
        catch (error) {
            this.logger.error(`Failed to rollback order items for ${orderId}`, error);
        }
        try {
            await adminClient.from('orders').delete().eq('id', orderId);
        }
        catch (error) {
            this.logger.error(`Failed to rollback order ${orderId}`, error);
        }
    }
    async rollbackInventory(adminClient, branchId, reservedItems) {
        for (const item of reservedItems) {
            try {
                await adminClient
                    .from('product_inventory')
                    .update({
                    qty_available: item.inventory.qty_available + item.qty,
                    qty_reserved: Math.max(0, item.inventory.qty_reserved - item.qty),
                })
                    .eq('product_id', item.productId)
                    .eq('branch_id', branchId);
            }
            catch (error) {
                this.logger.error(`Failed to rollback inventory for product ${item.productId}`, error);
            }
        }
    }
    async getBranch(branchId) {
        const sb = this.supabase.anonClient();
        const { data, error } = await sb
            .from('branches')
            .select(`
        id,
        name,
        logo_url,
        cover_image_url,
        brands (
          name,
          logo_url,
          cover_image_url
        )
      `)
            .eq('id', branchId)
            .single();
        if (error || !data) {
            throw new common_1.NotFoundException('사용할 수 없는 가게입니다.');
        }
        const row = data;
        return {
            id: row.id,
            name: row.name,
            brandName: row.brands?.name ?? undefined,
            logoUrl: row.logo_url || row.brands?.logo_url || null,
            coverImageUrl: row.cover_image_url || row.brands?.cover_image_url || null,
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
        logo_url,
        cover_image_url,
        brands (
          name,
          logo_url,
          cover_image_url
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
            logoUrl: row.logo_url || row.brands?.logo_url || null,
            coverImageUrl: row.cover_image_url || row.brands?.cover_image_url || null,
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
        logo_url,
        cover_image_url,
        brands!inner (
          id,
          name,
          slug,
          logo_url,
          cover_image_url
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
            logoUrl: row.logo_url || row.brands?.logo_url || null,
            coverImageUrl: row.cover_image_url || row.brands?.cover_image_url || null,
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
        let includeSortOrder = true;
        for (let attempt = 0; attempt < 8; attempt += 1) {
            const query = buildBaseQuery(includeIsHidden, includeIsSoldOut);
            const orderedQuery = includeSortOrder
                ? query
                    .order('sort_order', { ascending: true })
                    .order('created_at', { ascending: true })
                : query.order('created_at', { ascending: true });
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
            if (message.includes('sort_order')) {
                includeSortOrder = false;
                retried = true;
            }
            if (!retried)
                break;
        }
        if (error) {
            throw new Error(`상품 목록 조회 실패: ${error.message}`);
        }
        const products = data ?? [];
        const categoryIds = [
            ...new Set(products
                .map((p) => p.category_id)
                .filter(Boolean)),
        ];
        let categoryMap = new Map();
        if (categoryIds.length > 0) {
            const { data: categories } = await sb
                .from('product_categories')
                .select('id, name')
                .in('id', categoryIds);
            if (categories) {
                categoryMap = new Map(categories.map((c) => [c.id, c.name]));
            }
        }
        return products.map((product) => ({
            id: product.id,
            name: product.name,
            description: product.description ?? null,
            price: this.getPriceFromRow(product),
            imageUrl: product.image_url ?? null,
            categoryId: product.category_id ?? null,
            categoryName: categoryMap.get(product.category_id) ?? null,
            sortOrder: product.sort_order ?? 0,
            options: [],
        }));
    }
    async createOrder(dto) {
        const sb = this.supabase.anonClient();
        const adminClient = this.supabase.adminClient();
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
        const { data: inventoryRecords, error: invError } = await adminClient
            .from('product_inventory')
            .select('product_id, qty_available, qty_reserved')
            .in('product_id', productIds)
            .eq('branch_id', dto.branchId);
        if (invError) {
            throw new common_1.BadRequestException(`재고 조회 실패: ${invError.message}`);
        }
        const inventoryMap = new Map(inventoryRecords?.map((inv) => [inv.product_id, inv]) ?? []);
        for (const item of dto.items) {
            const inventory = inventoryMap.get(item.productId);
            if (!inventory) {
                throw new common_1.BadRequestException(`재고 정보를 찾을 수 없습니다: ${productMap.get(item.productId)?.name}`);
            }
            if (inventory.qty_available < item.qty) {
                throw new common_1.BadRequestException(`재고가 부족합니다: ${productMap.get(item.productId)?.name} (재고: ${inventory.qty_available}개, 주문: ${item.qty}개)`);
            }
        }
        let subtotalAmount = 0;
        const orderItemsData = [];
        for (const item of dto.items) {
            const product = productMap.get(item.productId);
            if (!product) {
                throw new common_1.BadRequestException(`상품을 찾을 수 없습니다: ${item.productId}`);
            }
            const itemPrice = this.getPriceFromRow(product);
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
        try {
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
                if (itemError || !orderItem) {
                    this.logger.error('order_item insert error:', itemError);
                    throw new common_1.BadRequestException('주문 항목 생성에 실패했습니다.');
                }
                const optionNames = [];
                if (itemData.options && itemData.options.length > 0) {
                    for (const opt of itemData.options) {
                        const { error: optError } = await sb
                            .from('order_item_options')
                            .insert({
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
        }
        catch (error) {
            await this.rollbackOrder(adminClient, order.id);
            throw error;
        }
        const reservedItems = [];
        try {
            for (const item of dto.items) {
                const inventory = inventoryMap.get(item.productId);
                if (!inventory)
                    continue;
                const { error: updateError } = await adminClient
                    .from('product_inventory')
                    .update({
                    qty_available: inventory.qty_available - item.qty,
                    qty_reserved: inventory.qty_reserved + item.qty,
                })
                    .eq('product_id', item.productId)
                    .eq('branch_id', dto.branchId);
                if (updateError) {
                    this.logger.error(`Failed to reserve inventory for product ${item.productId}`, updateError);
                    throw new common_1.BadRequestException(`재고 예약 실패: ${productMap.get(item.productId)?.name}`);
                }
                reservedItems.push({
                    productId: item.productId,
                    qty: item.qty,
                    inventory,
                });
                await adminClient.from('inventory_logs').insert({
                    product_id: item.productId,
                    branch_id: dto.branchId,
                    transaction_type: 'RESERVE',
                    qty_change: -item.qty,
                    qty_before: inventory.qty_available,
                    qty_after: inventory.qty_available - item.qty,
                    reference_id: order.id,
                    reference_type: 'ORDER',
                    notes: `주문 생성으로 인한 재고 예약 (주문번호: ${order.order_no})`,
                });
            }
        }
        catch (error) {
            await this.rollbackInventory(adminClient, dto.branchId, reservedItems);
            await this.rollbackOrder(adminClient, order.id);
            this.logger.error('Inventory reservation failed for order ' + order.id, error);
            throw new common_1.BadRequestException('재고 처리 중 오류가 발생했습니다. 관리자에게 문의해주세요.');
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
    async getCategories(branchId) {
        const sb = this.supabase.adminClient();
        const { data, error } = await sb
            .from('product_categories')
            .select('id, name, sort_order')
            .eq('branch_id', branchId)
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true });
        if (error) {
            throw new Error(`카테고리 목록 조회 실패: ${error.message}`);
        }
        return (data ?? []).map((row) => ({
            id: row.id,
            name: row.name,
            sortOrder: row.sort_order ?? 0,
        }));
    }
};
exports.PublicOrderService = PublicOrderService;
exports.PublicOrderService = PublicOrderService = PublicOrderService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService,
        inventory_service_1.InventoryService])
], PublicOrderService);
//# sourceMappingURL=public-order.service.js.map