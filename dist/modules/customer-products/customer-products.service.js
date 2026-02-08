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
var CustomerProductsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerProductsService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../../infra/supabase/supabase.service");
let CustomerProductsService = CustomerProductsService_1 = class CustomerProductsService {
    supabase;
    logger = new common_1.Logger(CustomerProductsService_1.name);
    constructor(supabase) {
        this.supabase = supabase;
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
    async checkProductAccess(productId, userId, brandMemberships, branchMemberships) {
        const sb = this.supabase.adminClient();
        const { data: product, error } = await sb
            .from('products')
            .select('*, branches!inner(id, brand_id)')
            .eq('id', productId)
            .single();
        if (error || !product) {
            throw new common_1.NotFoundException('Product not found');
        }
        const branchId = product.branch_id;
        const brandId = product.branches.brand_id;
        const branchMembership = branchMemberships.find((m) => m.branch_id === branchId);
        if (branchMembership) {
            return { role: branchMembership.role, product };
        }
        const brandMembership = brandMemberships.find((m) => m.brand_id === brandId);
        if (brandMembership) {
            return { role: brandMembership.role, product };
        }
        throw new common_1.ForbiddenException('You do not have access to this product');
    }
    checkModificationPermission(role, action, userId) {
        if (role !== 'OWNER' && role !== 'ADMIN') {
            this.logger.warn(`User ${userId} with role ${role} attempted to ${action}`);
            throw new common_1.ForbiddenException(`Only OWNER or ADMIN can ${action}`);
        }
    }
    async getMyCategories(userId, branchId, brandMemberships, branchMemberships) {
        this.logger.log(`Fetching categories for branch ${branchId} by user ${userId}`);
        await this.checkBranchAccess(branchId, userId, brandMemberships, branchMemberships);
        const sb = this.supabase.adminClient();
        const { data, error } = await sb
            .from('product_categories')
            .select('*')
            .eq('branch_id', branchId)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true });
        if (error) {
            this.logger.error(`Failed to fetch categories for branch ${branchId}`, error);
            throw new Error('Failed to fetch categories');
        }
        return (data || []).map((row) => ({
            id: row.id,
            branchId: row.branch_id,
            name: row.name,
            sortOrder: row.sort_order ?? 0,
            isActive: row.is_active ?? true,
            createdAt: row.created_at ?? '',
        }));
    }
    async getMyProducts(userId, branchId, brandMemberships, branchMemberships) {
        this.logger.log(`Fetching products for branch ${branchId} by user ${userId}`);
        await this.checkBranchAccess(branchId, userId, brandMemberships, branchMemberships);
        const sb = this.supabase.adminClient();
        let { data, error } = await sb
            .from('products')
            .select('*')
            .eq('branch_id', branchId)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true });
        if (error && error.message?.includes('sort_order')) {
            ({ data, error } = await sb
                .from('products')
                .select('*')
                .eq('branch_id', branchId)
                .order('created_at', { ascending: true }));
        }
        if (error) {
            this.logger.error(`Failed to fetch products for branch ${branchId}`, error);
            throw new Error('Failed to fetch products');
        }
        this.logger.log(`Fetched ${data?.length || 0} products for branch ${branchId}`);
        return data || [];
    }
    async getMyProduct(userId, productId, brandMemberships, branchMemberships) {
        this.logger.log(`Fetching product ${productId} by user ${userId}`);
        const { product } = await this.checkProductAccess(productId, userId, brandMemberships, branchMemberships);
        const sb = this.supabase.adminClient();
        const { data: options, error: optionsError } = await sb
            .from('product_options')
            .select('id, product_id, name, price_delta, is_active, sort_order')
            .eq('product_id', productId)
            .order('sort_order', { ascending: true });
        if (optionsError) {
            this.logger.error(`Failed to fetch options for product ${productId}`, optionsError);
        }
        return {
            ...product,
            options: options || [],
        };
    }
    async createMyProduct(userId, dto, brandMemberships, branchMemberships) {
        this.logger.log(`Creating product for branch ${dto.branchId} by user ${userId}`);
        const { branchMembership, brandMembership } = await this.checkBranchAccess(dto.branchId, userId, brandMemberships, branchMemberships);
        const role = branchMembership?.role || brandMembership?.role;
        if (!role) {
            throw new common_1.ForbiddenException('You do not have access to this branch');
        }
        this.checkModificationPermission(role, 'create products', userId);
        const sb = this.supabase.adminClient();
        const { data: product, error: productError } = await sb
            .from('products')
            .insert({
            branch_id: dto.branchId,
            name: dto.name,
            description: dto.description,
            category_id: dto.categoryId,
            base_price: dto.price,
            is_hidden: !(dto.isActive ?? true),
            image_url: dto.imageUrl,
            sort_order: dto.sortOrder ?? 0,
        })
            .select()
            .single();
        if (productError) {
            this.logger.error(`Failed to create product for branch ${dto.branchId}`, productError);
            throw new Error('Failed to create product');
        }
        if (dto.options && dto.options.length > 0) {
            const optionsToInsert = dto.options.map((opt) => ({
                product_id: product.id,
                name: opt.name,
                price_delta: opt.priceDelta ?? 0,
                is_active: opt.isActive ?? true,
                sort_order: opt.sortOrder ?? 0,
            }));
            const { error: optionsError } = await sb
                .from('product_options')
                .insert(optionsToInsert);
            if (optionsError) {
                this.logger.error(`Failed to create options for product ${product.id}`, optionsError);
            }
        }
        this.logger.log(`Product ${product.id} created successfully`);
        return product;
    }
    async updateMyProduct(userId, productId, dto, brandMemberships, branchMemberships) {
        this.logger.log(`Updating product ${productId} by user ${userId}`);
        const { role } = await this.checkProductAccess(productId, userId, brandMemberships, branchMemberships);
        this.checkModificationPermission(role, 'update products', userId);
        const sb = this.supabase.adminClient();
        const updateFields = {};
        if (dto.name !== undefined)
            updateFields.name = dto.name;
        if (dto.description !== undefined)
            updateFields.description = dto.description;
        if (dto.categoryId !== undefined)
            updateFields.category_id = dto.categoryId;
        if (dto.price !== undefined)
            updateFields.base_price = dto.price;
        if (dto.isActive !== undefined)
            updateFields.is_hidden = !dto.isActive;
        if (dto.imageUrl !== undefined)
            updateFields.image_url = dto.imageUrl;
        if (dto.sortOrder !== undefined)
            updateFields.sort_order = dto.sortOrder;
        if (Object.keys(updateFields).length === 0) {
            return this.getMyProduct(userId, productId, brandMemberships, branchMemberships);
        }
        const { data, error } = await sb
            .from('products')
            .update(updateFields)
            .eq('id', productId)
            .select()
            .single();
        if (error || !data) {
            this.logger.error(`Failed to update product ${productId}`, error);
            throw new Error('Failed to update product');
        }
        this.logger.log(`Product ${productId} updated successfully`);
        return data;
    }
    async deleteMyProduct(userId, productId, brandMemberships, branchMemberships) {
        this.logger.log(`Deleting product ${productId} by user ${userId}`);
        const { role } = await this.checkProductAccess(productId, userId, brandMemberships, branchMemberships);
        this.checkModificationPermission(role, 'delete products', userId);
        const sb = this.supabase.adminClient();
        const { error } = await sb.from('products').delete().eq('id', productId);
        if (error) {
            this.logger.error(`Failed to delete product ${productId}`, error);
            throw new Error('Failed to delete product');
        }
        this.logger.log(`Product ${productId} deleted successfully`);
        return { deleted: true };
    }
    async reorderProducts(userId, branchId, items, brandMemberships, branchMemberships) {
        this.logger.log(`Reordering ${items.length} products for branch ${branchId} by user ${userId}`);
        const { branchMembership, brandMembership } = await this.checkBranchAccess(branchId, userId, brandMemberships, branchMemberships);
        const role = branchMembership?.role || brandMembership?.role;
        if (!role) {
            throw new common_1.ForbiddenException('You do not have access to this branch');
        }
        this.checkModificationPermission(role, 'reorder products', userId);
        const sb = this.supabase.adminClient();
        for (const item of items) {
            const { error } = await sb
                .from('products')
                .update({ sort_order: item.sortOrder })
                .eq('id', item.id)
                .eq('branch_id', branchId);
            if (error) {
                this.logger.error(`Failed to update sort_order for product ${item.id}`, error);
            }
        }
        this.logger.log(`Products reordered successfully for branch ${branchId}`);
        return this.getMyProducts(userId, branchId, brandMemberships, branchMemberships);
    }
    async createCategory(userId, branchId, name, sortOrder, isActive, brandMemberships, branchMemberships) {
        this.logger.log(`Creating category for branch ${branchId} by user ${userId}`);
        const { branchMembership, brandMembership } = await this.checkBranchAccess(branchId, userId, brandMemberships, branchMemberships);
        const role = branchMembership?.role || brandMembership?.role;
        if (!role) {
            throw new common_1.ForbiddenException('You do not have access to this branch');
        }
        this.checkModificationPermission(role, 'create categories', userId);
        const sb = this.supabase.adminClient();
        const { data, error } = await sb
            .from('product_categories')
            .insert({
            branch_id: branchId,
            name,
            sort_order: sortOrder ?? 0,
            is_active: isActive ?? true,
        })
            .select()
            .single();
        if (error) {
            this.logger.error(`Failed to create category for branch ${branchId}`, error);
            throw new Error(`Failed to create category: ${error.message}`);
        }
        return {
            id: data.id,
            branchId: data.branch_id,
            name: data.name,
            sortOrder: data.sort_order ?? 0,
            isActive: data.is_active ?? true,
            createdAt: data.created_at ?? '',
        };
    }
    async updateCategory(userId, categoryId, dto, brandMemberships, branchMemberships) {
        this.logger.log(`Updating category ${categoryId} by user ${userId}`);
        const sb = this.supabase.adminClient();
        const { data: category, error: catError } = await sb
            .from('product_categories')
            .select('*')
            .eq('id', categoryId)
            .single();
        if (catError || !category) {
            throw new common_1.NotFoundException('Category not found');
        }
        const { branchMembership, brandMembership } = await this.checkBranchAccess(category.branch_id, userId, brandMemberships, branchMemberships);
        const role = branchMembership?.role || brandMembership?.role;
        if (!role) {
            throw new common_1.ForbiddenException('You do not have access to this branch');
        }
        this.checkModificationPermission(role, 'update categories', userId);
        const updateFields = {};
        if (dto.name !== undefined)
            updateFields.name = dto.name;
        if (dto.sortOrder !== undefined)
            updateFields.sort_order = dto.sortOrder;
        if (dto.isActive !== undefined)
            updateFields.is_active = dto.isActive;
        if (Object.keys(updateFields).length === 0) {
            return {
                id: category.id,
                branchId: category.branch_id,
                name: category.name,
                sortOrder: category.sort_order ?? 0,
                isActive: category.is_active ?? true,
                createdAt: category.created_at ?? '',
            };
        }
        const { data, error } = await sb
            .from('product_categories')
            .update(updateFields)
            .eq('id', categoryId)
            .select()
            .single();
        if (error || !data) {
            this.logger.error(`Failed to update category ${categoryId}`, error);
            throw new Error('Failed to update category');
        }
        return {
            id: data.id,
            branchId: data.branch_id,
            name: data.name,
            sortOrder: data.sort_order ?? 0,
            isActive: data.is_active ?? true,
            createdAt: data.created_at ?? '',
        };
    }
    async deleteCategory(userId, categoryId, brandMemberships, branchMemberships) {
        this.logger.log(`Deleting category ${categoryId} by user ${userId}`);
        const sb = this.supabase.adminClient();
        const { data: category, error: catError } = await sb
            .from('product_categories')
            .select('*')
            .eq('id', categoryId)
            .single();
        if (catError || !category) {
            throw new common_1.NotFoundException('Category not found');
        }
        const { branchMembership, brandMembership } = await this.checkBranchAccess(category.branch_id, userId, brandMemberships, branchMemberships);
        const role = branchMembership?.role || brandMembership?.role;
        if (!role) {
            throw new common_1.ForbiddenException('You do not have access to this branch');
        }
        this.checkModificationPermission(role, 'delete categories', userId);
        const { error } = await sb
            .from('product_categories')
            .delete()
            .eq('id', categoryId);
        if (error) {
            this.logger.error(`Failed to delete category ${categoryId}`, error);
            throw new Error('Failed to delete category');
        }
        return { deleted: true };
    }
    async reorderCategories(userId, branchId, items, brandMemberships, branchMemberships) {
        this.logger.log(`Reordering ${items.length} categories for branch ${branchId} by user ${userId}`);
        const { branchMembership, brandMembership } = await this.checkBranchAccess(branchId, userId, brandMemberships, branchMemberships);
        const role = branchMembership?.role || brandMembership?.role;
        if (!role) {
            throw new common_1.ForbiddenException('You do not have access to this branch');
        }
        this.checkModificationPermission(role, 'reorder categories', userId);
        const sb = this.supabase.adminClient();
        for (const item of items) {
            const { error } = await sb
                .from('product_categories')
                .update({ sort_order: item.sortOrder })
                .eq('id', item.id)
                .eq('branch_id', branchId);
            if (error) {
                this.logger.error(`Failed to update sort_order for category ${item.id}`, error);
            }
        }
        return this.getMyCategories(userId, branchId, brandMemberships, branchMemberships);
    }
};
exports.CustomerProductsService = CustomerProductsService;
exports.CustomerProductsService = CustomerProductsService = CustomerProductsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], CustomerProductsService);
//# sourceMappingURL=customer-products.service.js.map