import { Injectable, Logger, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import type { BrandMembership, BranchMembership } from '../../common/types/auth-request';
import {
  UpdateInventoryRequest,
  AdjustInventoryRequest,
  InventoryListResponse,
  InventoryDetailResponse,
  InventoryAlertResponse,
  InventoryLogResponse,
} from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * 브랜치에 대한 접근 권한 확인
   */
  private async checkBranchAccess(
    branchId: string,
    userId: string,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ): Promise<{ role: string; branch: any }> {
    const sb = this.supabase.adminClient();

    // 브랜치 정보 조회
    const { data: branch, error } = await sb
      .from('branches')
      .select('id, brand_id, name, slug, created_at')
      .eq('id', branchId)
      .single();

    if (error || !branch) {
      throw new NotFoundException('Branch not found');
    }

    // 1. 브랜치 멤버십 확인 (우선순위)
    const branchMembership = branchMemberships.find((m) => m.branch_id === branchId);
    if (branchMembership) {
      return { role: branchMembership.role, branch };
    }

    // 2. 브랜드 멤버십으로 확인
    const brandMembership = brandMemberships.find((m) => m.brand_id === branch.brand_id);
    if (brandMembership) {
      return { role: brandMembership.role, branch };
    }

    throw new ForbiddenException('You do not have access to this branch');
  }

  /**
   * 상품에 대한 접근 권한 확인
   */
  private async checkProductAccess(
    productId: string,
    userId: string,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ): Promise<{ role: string; product: any }> {
    const sb = this.supabase.adminClient();

    // 상품 및 브랜치 정보 조회
    const { data: product, error } = await sb
      .from('products')
      .select('*, branches!inner(id, brand_id, name)')
      .eq('id', productId)
      .single();

    if (error || !product) {
      throw new NotFoundException('Product not found');
    }

    const branchId = product.branch_id;
    const brandId = (product.branches as any).brand_id;

    // 1. 브랜치 멤버십 확인 (우선순위)
    const branchMembership = branchMemberships.find((m) => m.branch_id === branchId);
    if (branchMembership) {
      return { role: branchMembership.role, product };
    }

    // 2. 브랜드 멤버십으로 확인
    const brandMembership = brandMemberships.find((m) => m.brand_id === brandId);
    if (brandMembership) {
      return { role: brandMembership.role, product };
    }

    throw new ForbiddenException('You do not have access to this product');
  }

  /**
   * 수정/삭제 권한 확인 (OWNER 또는 ADMIN만 가능)
   */
  private checkModificationPermission(role: string, action: string, userId: string) {
    if (role !== 'OWNER' && role !== 'ADMIN') {
      this.logger.warn(`User ${userId} with role ${role} attempted to ${action}`);
      throw new ForbiddenException(`Only OWNER or ADMIN can ${action}`);
    }
  }

  /**
   * 인벤토리 로그 생성
   */
  private async createInventoryLog(
    productId: string,
    branchId: string,
    transactionType: string,
    qtyChange: number,
    qtyBefore: number,
    qtyAfter: number,
    userId: string,
    notes?: string,
    referenceId?: string,
    referenceType?: string,
  ) {
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
      // Don't throw - logging failure shouldn't break the main operation
    }
  }

  /**
   * GET /customer/inventory?branchId= - List inventory for a branch
   */
  async getInventoryList(
    userId: string,
    branchId: string,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ): Promise<InventoryListResponse[]> {
    this.logger.log(`Fetching inventory for branch ${branchId} by user ${userId}`);

    // 브랜치 접근 권한 확인
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
      const product = item.products as any;
      const category = product?.product_categories as any;

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

  /**
   * GET /customer/inventory/:productId - Get inventory for a specific product
   */
  async getInventoryByProduct(
    userId: string,
    productId: string,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ): Promise<InventoryDetailResponse> {
    this.logger.log(`Fetching inventory for product ${productId} by user ${userId}`);

    // 상품 접근 권한 확인
    const { product } = await this.checkProductAccess(
      productId,
      userId,
      brandMemberships,
      branchMemberships,
    );

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
      // If inventory doesn't exist, create it
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

  /**
   * PATCH /customer/inventory/:productId - Update inventory quantity (OWNER/ADMIN only)
   */
  async updateInventory(
    userId: string,
    productId: string,
    dto: UpdateInventoryRequest,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ): Promise<InventoryDetailResponse> {
    this.logger.log(`Updating inventory for product ${productId} by user ${userId}`);

    // 상품 접근 권한 확인
    const { role, product } = await this.checkProductAccess(
      productId,
      userId,
      brandMemberships,
      branchMemberships,
    );

    // 수정 권한 확인
    this.checkModificationPermission(role, 'update inventory', userId);

    const sb = this.supabase.adminClient();

    // Get current inventory
    const { data: currentInventory, error: fetchError } = await sb
      .from('product_inventory')
      .select('*')
      .eq('product_id', productId)
      .eq('branch_id', product.branch_id)
      .single();

    if (fetchError || !currentInventory) {
      throw new NotFoundException('Inventory not found');
    }

    // Build update object
    const updateFields: any = {};
    if (dto.qty_available !== undefined) updateFields.qty_available = dto.qty_available;
    if (dto.low_stock_threshold !== undefined) updateFields.low_stock_threshold = dto.low_stock_threshold;

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

    // Create log if qty_available changed
    if (dto.qty_available !== undefined && dto.qty_available !== currentInventory.qty_available) {
      const qtyChange = dto.qty_available - currentInventory.qty_available;
      await this.createInventoryLog(
        productId,
        product.branch_id,
        'ADJUSTMENT',
        qtyChange,
        currentInventory.qty_available,
        dto.qty_available,
        userId,
        'Manual inventory update',
      );
    }

    this.logger.log(`Inventory updated for product ${productId}`);

    return this.getInventoryByProduct(userId, productId, brandMemberships, branchMemberships);
  }

  /**
   * POST /customer/inventory/:productId/adjust - Manual inventory adjustment with notes
   */
  async adjustInventory(
    userId: string,
    productId: string,
    dto: AdjustInventoryRequest,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ): Promise<InventoryDetailResponse> {
    this.logger.log(`Adjusting inventory for product ${productId} by user ${userId}`);

    // 상품 접근 권한 확인
    const { role, product } = await this.checkProductAccess(
      productId,
      userId,
      brandMemberships,
      branchMemberships,
    );

    // 수정 권한 확인
    this.checkModificationPermission(role, 'adjust inventory', userId);

    const sb = this.supabase.adminClient();

    // Get current inventory
    const { data: currentInventory, error: fetchError } = await sb
      .from('product_inventory')
      .select('*')
      .eq('product_id', productId)
      .eq('branch_id', product.branch_id)
      .single();

    if (fetchError || !currentInventory) {
      throw new NotFoundException('Inventory not found');
    }

    const newQty = currentInventory.qty_available + dto.qty_change;

    if (newQty < 0) {
      throw new BadRequestException('Inventory quantity cannot be negative');
    }

    // Update inventory
    const { error: updateError } = await sb
      .from('product_inventory')
      .update({ qty_available: newQty })
      .eq('id', currentInventory.id);

    if (updateError) {
      this.logger.error(`Failed to adjust inventory for product ${productId}`, updateError);
      throw new Error('Failed to adjust inventory');
    }

    // Create inventory log
    await this.createInventoryLog(
      productId,
      product.branch_id,
      dto.transaction_type,
      dto.qty_change,
      currentInventory.qty_available,
      newQty,
      userId,
      dto.notes,
    );

    this.logger.log(`Inventory adjusted for product ${productId}: ${dto.qty_change} (${dto.transaction_type})`);

    return this.getInventoryByProduct(userId, productId, brandMemberships, branchMemberships);
  }

  /**
   * GET /customer/inventory/alerts?branchId= - Get low stock alerts
   */
  async getLowStockAlerts(
    userId: string,
    branchId: string,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ): Promise<InventoryAlertResponse[]> {
    this.logger.log(`Fetching low stock alerts for branch ${branchId} by user ${userId}`);

    // 브랜치 접근 권한 확인
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
      .lte('qty_available', sb.raw('low_stock_threshold'))
      .order('qty_available', { ascending: true });

    if (error) {
      this.logger.error(`Failed to fetch low stock alerts for branch ${branchId}`, error);
      throw new Error('Failed to fetch low stock alerts');
    }

    this.logger.log(`Found ${data?.length || 0} low stock items for branch ${branchId}`);

    return (data || []).map((item) => {
      const product = item.products as any;

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

  /**
   * GET /customer/inventory/logs?productId=&branchId= - Get inventory transaction logs
   */
  async getInventoryLogs(
    userId: string,
    branchId?: string,
    productId?: string,
    brandMemberships?: BrandMembership[],
    branchMemberships?: BranchMembership[],
  ): Promise<InventoryLogResponse[]> {
    this.logger.log(`Fetching inventory logs by user ${userId} (branch: ${branchId}, product: ${productId})`);

    if (!branchId && !productId) {
      throw new BadRequestException('Either branchId or productId must be provided');
    }

    const sb = this.supabase.adminClient();

    let query = sb
      .from('inventory_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (branchId) {
      // 브랜치 접근 권한 확인
      await this.checkBranchAccess(branchId, userId, brandMemberships || [], branchMemberships || []);
      query = query.eq('branch_id', branchId);
    }

    if (productId) {
      // 상품 접근 권한 확인
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
}
