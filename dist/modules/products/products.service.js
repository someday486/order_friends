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
exports.ProductsService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../../infra/supabase/supabase.service");
let ProductsService = class ProductsService {
    supabase;
    constructor(supabase) {
        this.supabase = supabase;
    }
    async getProducts(accessToken, branchId) {
        const sb = this.supabase.userClient(accessToken);
        const { data, error } = await sb
            .from('products')
            .select('id, name, price, is_active, sort_order, created_at')
            .eq('branch_id', branchId)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false });
        if (error) {
            throw new Error(`[products.getProducts] ${error.message}`);
        }
        return (data ?? []).map((row) => ({
            id: row.id,
            name: row.name,
            price: row.price ?? 0,
            isActive: row.is_active ?? true,
            sortOrder: row.sort_order ?? 0,
            createdAt: row.created_at ?? '',
        }));
    }
    async getProduct(accessToken, productId) {
        const sb = this.supabase.userClient(accessToken);
        const { data, error } = await sb
            .from('products')
            .select(`
        id, branch_id, name, description, price, is_active, sort_order, created_at, updated_at,
        product_options (
          id, name, price_delta, is_active, sort_order
        )
      `)
            .eq('id', productId)
            .single();
        if (error) {
            throw new common_1.NotFoundException(`[products.getProduct] ${error.message}`);
        }
        if (!data) {
            throw new common_1.NotFoundException('상품을 찾을 수 없습니다.');
        }
        const options = (data.product_options ?? []).map((opt) => ({
            id: opt.id,
            name: opt.name,
            priceDelta: opt.price_delta ?? 0,
            isActive: opt.is_active ?? true,
            sortOrder: opt.sort_order ?? 0,
        }));
        return {
            id: data.id,
            branchId: data.branch_id,
            name: data.name,
            description: data.description ?? null,
            price: data.price ?? 0,
            isActive: data.is_active ?? true,
            sortOrder: data.sort_order ?? 0,
            createdAt: data.created_at ?? '',
            updatedAt: data.updated_at ?? '',
            options,
        };
    }
    async createProduct(accessToken, dto) {
        const sb = this.supabase.userClient(accessToken);
        const { data: productData, error: productError } = await sb
            .from('products')
            .insert({
            branch_id: dto.branchId,
            name: dto.name,
            description: dto.description ?? null,
            price: dto.price,
            is_active: dto.isActive ?? true,
            sort_order: dto.sortOrder ?? 0,
        })
            .select('id')
            .single();
        if (productError) {
            throw new Error(`[products.createProduct] ${productError.message}`);
        }
        const productId = productData.id;
        if (dto.options && dto.options.length > 0) {
            const optionsToInsert = dto.options.map((opt) => ({
                product_id: productId,
                name: opt.name,
                price_delta: opt.priceDelta ?? 0,
                is_active: opt.isActive ?? true,
                sort_order: opt.sortOrder ?? 0,
            }));
            const { error: optError } = await sb
                .from('product_options')
                .insert(optionsToInsert);
            if (optError) {
                console.error('[products.createProduct] options insert error:', optError);
            }
        }
        return this.getProduct(accessToken, productId);
    }
    async updateProduct(accessToken, productId, dto) {
        const sb = this.supabase.userClient(accessToken);
        const updateData = {};
        if (dto.name !== undefined)
            updateData.name = dto.name;
        if (dto.description !== undefined)
            updateData.description = dto.description;
        if (dto.price !== undefined)
            updateData.price = dto.price;
        if (dto.isActive !== undefined)
            updateData.is_active = dto.isActive;
        if (dto.sortOrder !== undefined)
            updateData.sort_order = dto.sortOrder;
        if (Object.keys(updateData).length === 0) {
            return this.getProduct(accessToken, productId);
        }
        const { data, error } = await sb
            .from('products')
            .update(updateData)
            .eq('id', productId)
            .select('id')
            .maybeSingle();
        if (error) {
            throw new Error(`[products.updateProduct] ${error.message}`);
        }
        if (!data) {
            throw new common_1.NotFoundException('상품을 찾을 수 없거나 권한이 없습니다.');
        }
        return this.getProduct(accessToken, productId);
    }
    async deleteProduct(accessToken, productId) {
        const sb = this.supabase.userClient(accessToken);
        const { error } = await sb
            .from('products')
            .delete()
            .eq('id', productId);
        if (error) {
            throw new Error(`[products.deleteProduct] ${error.message}`);
        }
        return { deleted: true };
    }
};
exports.ProductsService = ProductsService;
exports.ProductsService = ProductsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], ProductsService);
//# sourceMappingURL=products.service.js.map