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
var InventoryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../../infra/supabase/supabase.service");
const role_permission_util_1 = require("../../common/utils/role-permission.util");
let InventoryService = InventoryService_1 = class InventoryService {
    supabase;
    logger = new common_1.Logger(InventoryService_1.name);
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
            return { role: branchMembership.role, branch };
        }
        const brandMembership = brandMemberships.find((m) => m.brand_id === branch.brand_id);
        if (brandMembership) {
            return { role: brandMembership.role, branch };
        }
        throw new common_1.ForbiddenException('You do not have access to this branch');
    }
    async checkProductAccess(productId, userId, brandMemberships, branchMemberships) {
        const sb = this.supabase.adminClient();
        const { data: product, error } = await sb
            .from('products')
            .select('*, branches!inner(id, brand_id, name)')
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
        if (!(0, role_permission_util_1.canModifyProductOrInventory)(role)) {
            this.logger.warn(`User ${userId} with role ${role} attempted to ${action}`);
            throw new common_1.ForbiddenException(`Only OWNER, ADMIN, or BRANCH_ADMIN can ${action}`);
        }
    }
    async createInventoryLog(productId, branchId, transactionType, qtyChange, qtyBefore, qtyAfter, userId, notes, referenceId, referenceType) {
        const sb = this.supabase.adminClient();
        const { error } = await sb.from('inventory_logs').insert({
            product_id: productId,
            branch_id: branchId,
            transaction_type: transactionType,
            qty_change: qtyChange,
            qty_before: qtyBefore,
            qty_after: qtyAfter,
            created_by: userId,
            notes,
            reference_id: referenceId,
            reference_type: referenceType,
        });
        if (error) {
            this.logger.error(`Failed to create inventory log for product ${productId}`, error);
        }
    }
    async getInventoryList(userId, branchId, brandMemberships, branchMemberships) {
        this.logger.log(`Fetching inventory for branch ${branchId} by user ${userId}`);
        await this.checkBranchAccess(branchId, userId, brandMemberships, branchMemberships);
        const sb = this.supabase.adminClient();
        const { data, error } = await sb
            .from('product_inventory')
            .select(`
        id,
        product_id,
        branch_id,
        qty_available,
        qty_reserved,
        qty_sold,
        low_stock_threshold,
        created_at,
        updated_at,
        products!inner(
          name,
          image_url,
          category_id,
          product_categories(name)
        )
      `)
            .eq('branch_id', branchId)
            .order('created_at', { ascending: false });
        if (error) {
            this.logger.error(`Failed to fetch inventory for branch ${branchId}`, error);
            throw new Error('Failed to fetch inventory');
        }
        this.logger.log(`Fetched ${data?.length || 0} inventory items for branch ${branchId}`);
        return (data || []).map((item) => {
            const product = item.products;
            const category = product?.product_categories;
            return {
                id: item.id,
                product_id: item.product_id,
                product_name: product?.name || 'Unknown',
                branch_id: item.branch_id,
                qty_available: item.qty_available,
                qty_reserved: item.qty_reserved,
                qty_sold: item.qty_sold,
                low_stock_threshold: item.low_stock_threshold,
                is_low_stock: item.qty_available <= item.low_stock_threshold,
                total_quantity: item.qty_available + item.qty_reserved,
                image_url: product?.image_url,
                category: category?.name,
                created_at: item.created_at,
                updated_at: item.updated_at,
            };
        });
    }
    async getInventoryByProduct(userId, productId, brandMemberships, branchMemberships) {
        this.logger.log(`Fetching inventory for product ${productId} by user ${userId}`);
        const { product } = await this.checkProductAccess(productId, userId, brandMemberships, branchMemberships);
        const sb = this.supabase.adminClient();
        const { data: inventory, error } = await sb
            .from('product_inventory')
            .select(`
        id,
        product_id,
        branch_id,
        qty_available,
        qty_reserved,
        qty_sold,
        low_stock_threshold,
        created_at,
        updated_at
      `)
            .eq('product_id', productId)
            .eq('branch_id', product.branch_id)
            .single();
        if (error || !inventory) {
            const { data: newInventory, error: createError } = await sb
                .from('product_inventory')
                .insert({
                product_id: productId,
                branch_id: product.branch_id,
                qty_available: 0,
                qty_reserved: 0,
                qty_sold: 0,
                low_stock_threshold: 10,
            })
                .select()
                .single();
            if (createError || !newInventory) {
                this.logger.error(`Failed to create inventory for product ${productId}`, createError);
                throw new Error('Failed to get or create inventory');
            }
            return {
                id: newInventory.id,
                product_id: newInventory.product_id,
                product_name: product.name,
                branch_id: newInventory.branch_id,
                qty_available: newInventory.qty_available,
                qty_reserved: newInventory.qty_reserved,
                qty_sold: newInventory.qty_sold,
                low_stock_threshold: newInventory.low_stock_threshold,
                is_low_stock: newInventory.qty_available <= newInventory.low_stock_threshold,
                total_quantity: newInventory.qty_available + newInventory.qty_reserved,
                created_at: newInventory.created_at,
                updated_at: newInventory.updated_at,
                product: {
                    id: product.id,
                    name: product.name,
                    description: product.description,
                    price: product.price,
                    image_url: product.image_url,
                    category: product.category_id,
                },
            };
        }
        return {
            id: inventory.id,
            product_id: inventory.product_id,
            product_name: product.name,
            branch_id: inventory.branch_id,
            qty_available: inventory.qty_available,
            qty_reserved: inventory.qty_reserved,
            qty_sold: inventory.qty_sold,
            low_stock_threshold: inventory.low_stock_threshold,
            is_low_stock: inventory.qty_available <= inventory.low_stock_threshold,
            total_quantity: inventory.qty_available + inventory.qty_reserved,
            created_at: inventory.created_at,
            updated_at: inventory.updated_at,
            product: {
                id: product.id,
                name: product.name,
                description: product.description,
                price: product.price,
                image_url: product.image_url,
                category: product.category_id,
            },
        };
    }
    async updateInventory(userId, productId, dto, brandMemberships, branchMemberships) {
        this.logger.log(`Updating inventory for product ${productId} by user ${userId}`);
        const { role, product } = await this.checkProductAccess(productId, userId, brandMemberships, branchMemberships);
        this.checkModificationPermission(role, 'update inventory', userId);
        const sb = this.supabase.adminClient();
        const { data: currentInventory, error: fetchError } = await sb
            .from('product_inventory')
            .select('*')
            .eq('product_id', productId)
            .eq('branch_id', product.branch_id)
            .single();
        if (fetchError || !currentInventory) {
            throw new common_1.NotFoundException('Inventory not found');
        }
        const updateFields = {};
        if (dto.qty_available !== undefined)
            updateFields.qty_available = dto.qty_available;
        if (dto.low_stock_threshold !== undefined)
            updateFields.low_stock_threshold = dto.low_stock_threshold;
        if (Object.keys(updateFields).length === 0) {
            return this.getInventoryByProduct(userId, productId, brandMemberships, branchMemberships);
        }
        const { data: updatedInventory, error: updateError } = await sb
            .from('product_inventory')
            .update(updateFields)
            .eq('id', currentInventory.id)
            .select()
            .single();
        if (updateError || !updatedInventory) {
            this.logger.error(`Failed to update inventory for product ${productId}`, updateError);
            throw new Error('Failed to update inventory');
        }
        if (dto.qty_available !== undefined &&
            dto.qty_available !== currentInventory.qty_available) {
            const qtyChange = dto.qty_available - currentInventory.qty_available;
            await this.createInventoryLog(productId, product.branch_id, 'ADJUSTMENT', qtyChange, currentInventory.qty_available, dto.qty_available, userId, 'Manual inventory update');
        }
        this.logger.log(`Inventory updated for product ${productId}`);
        return this.getInventoryByProduct(userId, productId, brandMemberships, branchMemberships);
    }
    async adjustInventory(userId, productId, dto, brandMemberships, branchMemberships) {
        this.logger.log(`Adjusting inventory for product ${productId} by user ${userId}`);
        const { role, product } = await this.checkProductAccess(productId, userId, brandMemberships, branchMemberships);
        this.checkModificationPermission(role, 'adjust inventory', userId);
        const sb = this.supabase.adminClient();
        const { data: currentInventory, error: fetchError } = await sb
            .from('product_inventory')
            .select('*')
            .eq('product_id', productId)
            .eq('branch_id', product.branch_id)
            .single();
        if (fetchError || !currentInventory) {
            throw new common_1.NotFoundException('Inventory not found');
        }
        const newQty = currentInventory.qty_available + dto.qty_change;
        if (newQty < 0) {
            throw new common_1.BadRequestException('Inventory quantity cannot be negative');
        }
        const { error: updateError } = await sb
            .from('product_inventory')
            .update({ qty_available: newQty })
            .eq('id', currentInventory.id);
        if (updateError) {
            this.logger.error(`Failed to adjust inventory for product ${productId}`, updateError);
            throw new Error('Failed to adjust inventory');
        }
        await this.createInventoryLog(productId, product.branch_id, dto.transaction_type, dto.qty_change, currentInventory.qty_available, newQty, userId, dto.notes);
        this.logger.log(`Inventory adjusted for product ${productId}: ${dto.qty_change} (${dto.transaction_type})`);
        return this.getInventoryByProduct(userId, productId, brandMemberships, branchMemberships);
    }
    async getLowStockAlerts(userId, branchId, brandMemberships, branchMemberships) {
        this.logger.log(`Fetching low stock alerts for branch ${branchId} by user ${userId}`);
        const { branch } = await this.checkBranchAccess(branchId, userId, brandMemberships, branchMemberships);
        const sb = this.supabase.adminClient();
        const { data, error } = await sb
            .from('product_inventory')
            .select(`
        product_id,
        branch_id,
        qty_available,
        low_stock_threshold,
        products!inner(
          name,
          image_url
        )
      `)
            .eq('branch_id', branchId)
            .order('qty_available', { ascending: true });
        if (error) {
            this.logger.error(`Failed to fetch low stock alerts for branch ${branchId}`, error);
            throw new Error('Failed to fetch low stock alerts');
        }
        const lowStockItems = (data || []).filter((item) => item.qty_available <= item.low_stock_threshold);
        this.logger.log(`Found ${lowStockItems.length} low stock items for branch ${branchId}`);
        return lowStockItems.map((item) => {
            const product = item.products;
            return {
                product_id: item.product_id,
                product_name: product?.name || 'Unknown',
                branch_id: item.branch_id,
                branch_name: branch.name,
                qty_available: item.qty_available,
                low_stock_threshold: item.low_stock_threshold,
                image_url: product?.image_url,
            };
        });
    }
    async getInventoryLogs(userId, branchId, productId, brandMemberships, branchMemberships) {
        this.logger.log(`Fetching inventory logs by user ${userId} (branch: ${branchId}, product: ${productId})`);
        if (!branchId && !productId) {
            throw new common_1.BadRequestException('Either branchId or productId must be provided');
        }
        const sb = this.supabase.adminClient();
        let query = sb
            .from('inventory_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);
        if (branchId) {
            await this.checkBranchAccess(branchId, userId, brandMemberships || [], branchMemberships || []);
            query = query.eq('branch_id', branchId);
        }
        if (productId) {
            await this.checkProductAccess(productId, userId, brandMemberships || [], branchMemberships || []);
            query = query.eq('product_id', productId);
        }
        const { data, error } = await query;
        if (error) {
            this.logger.error(`Failed to fetch inventory logs`, error);
            throw new Error('Failed to fetch inventory logs');
        }
        this.logger.log(`Fetched ${data?.length || 0} inventory logs`);
        return data || [];
    }
};
exports.InventoryService = InventoryService;
exports.InventoryService = InventoryService = InventoryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], InventoryService);
//# sourceMappingURL=inventory.service.js.map