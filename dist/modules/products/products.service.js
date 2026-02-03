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
    getClient(accessToken, isAdmin) {
        return isAdmin ? this.supabase.adminClient() : this.supabase.userClient(accessToken);
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
    emptyOptions() {
        return [];
    }
    async getProducts(accessToken, branchId, isAdmin) {
        const sb = this.getClient(accessToken, isAdmin);
        const selectFields = '*';
        const { data, error } = await sb
            .from('products')
            .select(selectFields)
            .eq('branch_id', branchId)
            .order('created_at', { ascending: false });
        if (error) {
            throw new Error(`[products.getProducts] ${error.message}`);
        }
        return (data ?? []).map((row) => ({
            id: row.id,
            name: row.name,
            price: this.getPriceFromRow(row),
            isActive: !(row.is_hidden ?? false),
            sortOrder: 0,
            createdAt: row.created_at ?? '',
        }));
    }
    async getProduct(accessToken, productId, isAdmin) {
        const sb = this.getClient(accessToken, isAdmin);
        const selectDetail = '*';
        const { data, error } = await sb
            .from('products')
            .select(selectDetail)
            .eq('id', productId)
            .single();
        if (error) {
            throw new common_1.NotFoundException(`[products.getProduct] ${error.message}`);
        }
        if (!data) {
            throw new common_1.NotFoundException('상품을 찾을 수 없습니다.');
        }
        const options = this.emptyOptions();
        return {
            id: data.id,
            branchId: data.branch_id,
            name: data.name,
            description: data.description ?? null,
            price: this.getPriceFromRow(data),
            isActive: !(data.is_hidden ?? false),
            sortOrder: 0,
            createdAt: data.created_at ?? '',
            updatedAt: data.updated_at ?? '',
            options,
        };
    }
    async createProduct(accessToken, dto, isAdmin) {
        const sb = this.getClient(accessToken, isAdmin);
        const insertPayload = {
            branch_id: dto.branchId,
            name: dto.name,
            description: dto.description ?? null,
            base_price: dto.price,
            is_hidden: !(dto.isActive ?? true),
            is_sold_out: false,
        };
        const { data: productData, error: productError } = await sb
            .from('products')
            .insert(insertPayload)
            .select('id')
            .single();
        if (productError) {
            throw new Error(`[products.createProduct] ${productError.message}`);
        }
        const productId = productData.id;
        if (dto.options && dto.options.length > 0) {
            console.warn('[products.createProduct] product_options table not available; options ignored');
        }
        return this.getProduct(accessToken, productId, isAdmin);
    }
    async updateProduct(accessToken, productId, dto, isAdmin) {
        const sb = this.getClient(accessToken, isAdmin);
        const baseUpdate = {};
        if (dto.name !== undefined)
            baseUpdate.name = dto.name;
        if (dto.description !== undefined)
            baseUpdate.description = dto.description;
        if (dto.isActive !== undefined)
            baseUpdate.is_hidden = !dto.isActive;
        if (dto.price !== undefined)
            baseUpdate.base_price = dto.price;
        if (Object.keys(baseUpdate).length === 0) {
            return this.getProduct(accessToken, productId, isAdmin);
        }
        const { data, error } = await sb
            .from('products')
            .update(baseUpdate)
            .eq('id', productId)
            .select('id')
            .maybeSingle();
        if (error) {
            throw new Error(`[products.updateProduct] ${error.message}`);
        }
        if (!data) {
            throw new common_1.NotFoundException('수정할 상품을 찾을 수 없습니다.');
        }
        return this.getProduct(accessToken, productId, isAdmin);
    }
    async deleteProduct(accessToken, productId, isAdmin) {
        const sb = this.getClient(accessToken, isAdmin);
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