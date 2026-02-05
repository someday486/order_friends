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
var ProductsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductsService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../../infra/supabase/supabase.service");
const product_exception_1 = require("../../common/exceptions/product.exception");
const business_exception_1 = require("../../common/exceptions/business.exception");
let ProductsService = ProductsService_1 = class ProductsService {
    supabase;
    logger = new common_1.Logger(ProductsService_1.name);
    constructor(supabase) {
        this.supabase = supabase;
    }
    getClient(accessToken, isAdmin) {
        return isAdmin
            ? this.supabase.adminClient()
            : this.supabase.userClient(accessToken);
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
        this.logger.log(`Fetching products for branch: ${branchId}`);
        const sb = this.getClient(accessToken, isAdmin);
        const selectFields = '*';
        const { data, error } = await sb
            .from('products')
            .select(selectFields)
            .eq('branch_id', branchId)
            .order('created_at', { ascending: false });
        if (error) {
            this.logger.error(`Failed to fetch products: ${error.message}`, error);
            throw new business_exception_1.BusinessException('Failed to fetch products', 'PRODUCT_FETCH_FAILED', 500, { branchId, error: error.message });
        }
        this.logger.log(`Fetched ${data?.length || 0} products for branch: ${branchId}`);
        return (data ?? []).map((row) => ({
            id: row.id,
            name: row.name,
            price: this.getPriceFromRow(row),
            isActive: !(row.is_hidden ?? false),
            sortOrder: 0,
            createdAt: row.created_at ?? '',
        }));
    }
    async getCategories(accessToken, branchId, isAdmin) {
        const sb = this.getClient(accessToken, isAdmin);
        const { data, error } = await sb
            .from('product_categories')
            .select('*')
            .eq('branch_id', branchId)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true });
        if (error) {
            throw new Error(`[products.getCategories] ${error.message}`);
        }
        return (data ?? []).map((row) => ({
            id: row.id,
            branchId: row.branch_id,
            name: row.name,
            sortOrder: row.sort_order ?? 0,
            isActive: row.is_active ?? true,
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
            this.logger.error(`Failed to fetch product: ${error.message}`, error);
            throw new business_exception_1.BusinessException('Failed to fetch product', 'PRODUCT_FETCH_FAILED', 500, { productId, error: error.message });
        }
        if (!data) {
            this.logger.warn(`Product not found: ${productId}`);
            throw new product_exception_1.ProductNotFoundException(productId);
        }
        const options = this.emptyOptions();
        return {
            id: data.id,
            branchId: data.branch_id,
            name: data.name,
            categoryId: data.category_id ?? null,
            description: data.description ?? null,
            price: this.getPriceFromRow(data),
            imageUrl: data.image_url ?? null,
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
            category_id: dto.categoryId,
            description: dto.description ?? null,
            base_price: dto.price,
            image_url: dto.imageUrl ?? null,
            is_hidden: !(dto.isActive ?? true),
            is_sold_out: false,
        };
        const { data: productData, error: productError } = await sb
            .from('products')
            .insert(insertPayload)
            .select('id')
            .single();
        if (productError) {
            this.logger.error(`Failed to create product: ${productError.message}`, productError);
            throw new business_exception_1.BusinessException('Failed to create product', 'PRODUCT_CREATE_FAILED', 500, { error: productError.message });
        }
        const productId = productData.id;
        this.logger.log(`Product created successfully: ${productId}`);
        if (dto.options && dto.options.length > 0) {
            this.logger.warn('[products.createProduct] product_options table not available; options ignored');
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
        if (dto.categoryId !== undefined)
            baseUpdate.category_id = dto.categoryId;
        if (dto.imageUrl !== undefined)
            baseUpdate.image_url = dto.imageUrl;
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
            this.logger.error(`Failed to update product: ${error.message}`, error);
            throw new business_exception_1.BusinessException('Failed to update product', 'PRODUCT_UPDATE_FAILED', 500, { productId, error: error.message });
        }
        if (!data) {
            this.logger.warn(`Product not found for update: ${productId}`);
            throw new product_exception_1.ProductNotFoundException(productId);
        }
        this.logger.log(`Product updated successfully: ${productId}`);
        return this.getProduct(accessToken, productId, isAdmin);
    }
    async deleteProduct(accessToken, productId, isAdmin) {
        const sb = this.getClient(accessToken, isAdmin);
        const { error } = await sb.from('products').delete().eq('id', productId);
        if (error) {
            this.logger.error(`Failed to delete product: ${error.message}`, error);
            throw new business_exception_1.BusinessException('Failed to delete product', 'PRODUCT_DELETE_FAILED', 500, { productId, error: error.message });
        }
        this.logger.log(`Product deleted successfully: ${productId}`);
        return { deleted: true };
    }
};
exports.ProductsService = ProductsService;
exports.ProductsService = ProductsService = ProductsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], ProductsService);
//# sourceMappingURL=products.service.js.map