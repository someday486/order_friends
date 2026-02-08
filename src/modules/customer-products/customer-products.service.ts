import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import type {
  BrandMembership,
  BranchMembership,
} from '../../common/types/auth-request';
import { CreateProductRequest } from '../../modules/products/dto/create-product.request';
import { UpdateProductRequest } from '../../modules/products/dto/update-product.request';

@Injectable()
export class CustomerProductsService {
  private readonly logger = new Logger(CustomerProductsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * 브랜치에 대한 접근 권한 확인
   */
  private async checkBranchAccess(
    branchId: string,
    userId: string,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ): Promise<{
    branchMembership?: BranchMembership;
    brandMembership?: BrandMembership;
    branch: any;
  }> {
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
    const branchMembership = branchMemberships.find(
      (m) => m.branch_id === branchId,
    );
    if (branchMembership) {
      return { branchMembership, branch };
    }

    // 2. 브랜드 멤버십으로 확인
    const brandMembership = brandMemberships.find(
      (m) => m.brand_id === branch.brand_id,
    );
    if (brandMembership) {
      return { brandMembership, branch };
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
      .select('*, branches!inner(id, brand_id)')
      .eq('id', productId)
      .single();

    if (error || !product) {
      throw new NotFoundException('Product not found');
    }

    const branchId = product.branch_id;
    const brandId = product.branches.brand_id;

    // 1. 브랜치 멤버십 확인 (우선순위)
    const branchMembership = branchMemberships.find(
      (m) => m.branch_id === branchId,
    );
    if (branchMembership) {
      return { role: branchMembership.role, product };
    }

    // 2. 브랜드 멤버십으로 확인
    const brandMembership = brandMemberships.find(
      (m) => m.brand_id === brandId,
    );
    if (brandMembership) {
      return { role: brandMembership.role, product };
    }

    throw new ForbiddenException('You do not have access to this product');
  }

  /**
   * 수정/삭제 권한 확인 (OWNER 또는 ADMIN만 가능)
   */
  private checkModificationPermission(
    role: string,
    action: string,
    userId: string,
  ) {
    if (role !== 'OWNER' && role !== 'ADMIN') {
      this.logger.warn(
        `User ${userId} with role ${role} attempted to ${action}`,
      );
      throw new ForbiddenException(`Only OWNER or ADMIN can ${action}`);
    }
  }

  /**
   * 내 지점의 상품 카테고리 목록 조회
   */
  async getMyCategories(
    userId: string,
    branchId: string,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    this.logger.log(
      `Fetching categories for branch ${branchId} by user ${userId}`,
    );

    // 브랜치 접근 권한 확인
    await this.checkBranchAccess(
      branchId,
      userId,
      brandMemberships,
      branchMemberships,
    );

    const sb = this.supabase.adminClient();

    const { data, error } = await sb
      .from('product_categories')
      .select('*')
      .eq('branch_id', branchId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      this.logger.error(
        `Failed to fetch categories for branch ${branchId}`,
        error,
      );
      throw new Error('Failed to fetch categories');
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      branchId: row.branch_id,
      name: row.name,
      sortOrder: row.sort_order ?? 0,
      isActive: row.is_active ?? true,
      createdAt: row.created_at ?? '',
    }));
  }

  /**
   * 내 지점의 상품 목록 조회
   */
  async getMyProducts(
    userId: string,
    branchId: string,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    this.logger.log(
      `Fetching products for branch ${branchId} by user ${userId}`,
    );

    // 브랜치 접근 권한 확인
    await this.checkBranchAccess(
      branchId,
      userId,
      brandMemberships,
      branchMemberships,
    );

    const sb = this.supabase.adminClient();

    const { data, error } = await sb
      .from('products')
      .select('*')
      .eq('branch_id', branchId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      this.logger.error(
        `Failed to fetch products for branch ${branchId}`,
        error,
      );
      throw new Error('Failed to fetch products');
    }

    this.logger.log(
      `Fetched ${data?.length || 0} products for branch ${branchId}`,
    );

    return data || [];
  }

  /**
   * 내 상품 상세 조회
   */
  async getMyProduct(
    userId: string,
    productId: string,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    this.logger.log(`Fetching product ${productId} by user ${userId}`);

    const { product } = await this.checkProductAccess(
      productId,
      userId,
      brandMemberships,
      branchMemberships,
    );

    // 상품 옵션 조회
    const sb = this.supabase.adminClient();
    const { data: options, error: optionsError } = await sb
      .from('product_options')
      .select('id, product_id, name, price_delta, is_active, sort_order')
      .eq('product_id', productId)
      .order('sort_order', { ascending: true });

    if (optionsError) {
      this.logger.error(
        `Failed to fetch options for product ${productId}`,
        optionsError,
      );
    }

    return {
      ...product,
      options: options || [],
    };
  }

  /**
   * 상품 생성 (OWNER, ADMIN만 가능)
   */
  async createMyProduct(
    userId: string,
    dto: CreateProductRequest,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    this.logger.log(
      `Creating product for branch ${dto.branchId} by user ${userId}`,
    );

    // 브랜치 접근 권한 확인
    const { branchMembership, brandMembership } = await this.checkBranchAccess(
      dto.branchId,
      userId,
      brandMemberships,
      branchMemberships,
    );

    const role = branchMembership?.role || brandMembership?.role;
    if (!role) {
      throw new ForbiddenException('You do not have access to this branch');
    }

    // 생성 권한 확인
    this.checkModificationPermission(role, 'create products', userId);

    const sb = this.supabase.adminClient();

    // 상품 생성
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
      this.logger.error(
        `Failed to create product for branch ${dto.branchId}`,
        productError,
      );
      throw new Error('Failed to create product');
    }

    // 상품 옵션 생성 (있는 경우)
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
        this.logger.error(
          `Failed to create options for product ${product.id}`,
          optionsError,
        );
        // 상품은 생성되었으므로 에러를 던지지 않고 로그만 남김
      }
    }

    this.logger.log(`Product ${product.id} created successfully`);

    return product;
  }

  /**
   * 상품 수정 (OWNER, ADMIN만 가능)
   */
  async updateMyProduct(
    userId: string,
    productId: string,
    dto: UpdateProductRequest,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    this.logger.log(`Updating product ${productId} by user ${userId}`);

    // 접근 권한 확인
    const { role } = await this.checkProductAccess(
      productId,
      userId,
      brandMemberships,
      branchMemberships,
    );

    // 수정 권한 확인
    this.checkModificationPermission(role, 'update products', userId);

    const sb = this.supabase.adminClient();

    // 수정 가능한 필드만 허용
    const updateFields: any = {};
    if (dto.name !== undefined) updateFields.name = dto.name;
    if (dto.description !== undefined)
      updateFields.description = dto.description;
    if (dto.categoryId !== undefined) updateFields.category_id = dto.categoryId;
    if (dto.price !== undefined) updateFields.base_price = dto.price;
    if (dto.isActive !== undefined) updateFields.is_hidden = !dto.isActive;
    if (dto.imageUrl !== undefined) updateFields.image_url = dto.imageUrl;
    if (dto.sortOrder !== undefined) updateFields.sort_order = dto.sortOrder;

    if (Object.keys(updateFields).length === 0) {
      return this.getMyProduct(
        userId,
        productId,
        brandMemberships,
        branchMemberships,
      );
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

  /**
   * 상품 삭제 (OWNER, ADMIN만 가능)
   */
  async deleteMyProduct(
    userId: string,
    productId: string,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    this.logger.log(`Deleting product ${productId} by user ${userId}`);

    // 접근 권한 확인
    const { role } = await this.checkProductAccess(
      productId,
      userId,
      brandMemberships,
      branchMemberships,
    );

    // 삭제 권한 확인
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

  /**
   * 상품 정렬 순서 일괄 변경 (OWNER, ADMIN만 가능)
   */
  async reorderProducts(
    userId: string,
    branchId: string,
    items: { id: string; sortOrder: number }[],
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    this.logger.log(
      `Reordering ${items.length} products for branch ${branchId} by user ${userId}`,
    );

    const { branchMembership, brandMembership } = await this.checkBranchAccess(
      branchId,
      userId,
      brandMemberships,
      branchMemberships,
    );

    const role = branchMembership?.role || brandMembership?.role;
    if (!role) {
      throw new ForbiddenException('You do not have access to this branch');
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
        this.logger.error(
          `Failed to update sort_order for product ${item.id}`,
          error,
        );
      }
    }

    this.logger.log(`Products reordered successfully for branch ${branchId}`);

    return this.getMyProducts(
      userId,
      branchId,
      brandMemberships,
      branchMemberships,
    );
  }

  /**
   * 카테고리 생성 (OWNER, ADMIN만 가능)
   */
  async createCategory(
    userId: string,
    branchId: string,
    name: string,
    sortOrder: number | undefined,
    isActive: boolean | undefined,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    this.logger.log(
      `Creating category for branch ${branchId} by user ${userId}`,
    );

    const { branchMembership, brandMembership } = await this.checkBranchAccess(
      branchId,
      userId,
      brandMemberships,
      branchMemberships,
    );

    const role = branchMembership?.role || brandMembership?.role;
    if (!role) {
      throw new ForbiddenException('You do not have access to this branch');
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
      this.logger.error(
        `Failed to create category for branch ${branchId}`,
        error,
      );
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

  /**
   * 카테고리 수정 (OWNER, ADMIN만 가능)
   */
  async updateCategory(
    userId: string,
    categoryId: string,
    dto: { name?: string; sortOrder?: number; isActive?: boolean },
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    this.logger.log(`Updating category ${categoryId} by user ${userId}`);

    const sb = this.supabase.adminClient();

    // 카테고리 조회하여 branch_id 확인
    const { data: category, error: catError } = await sb
      .from('product_categories')
      .select('*')
      .eq('id', categoryId)
      .single();

    if (catError || !category) {
      throw new NotFoundException('Category not found');
    }

    const { branchMembership, brandMembership } = await this.checkBranchAccess(
      category.branch_id,
      userId,
      brandMemberships,
      branchMemberships,
    );

    const role = branchMembership?.role || brandMembership?.role;
    if (!role) {
      throw new ForbiddenException('You do not have access to this branch');
    }
    this.checkModificationPermission(role, 'update categories', userId);

    const updateFields: any = {};
    if (dto.name !== undefined) updateFields.name = dto.name;
    if (dto.sortOrder !== undefined) updateFields.sort_order = dto.sortOrder;
    if (dto.isActive !== undefined) updateFields.is_active = dto.isActive;

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

  /**
   * 카테고리 삭제 (OWNER, ADMIN만 가능)
   */
  async deleteCategory(
    userId: string,
    categoryId: string,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    this.logger.log(`Deleting category ${categoryId} by user ${userId}`);

    const sb = this.supabase.adminClient();

    const { data: category, error: catError } = await sb
      .from('product_categories')
      .select('*')
      .eq('id', categoryId)
      .single();

    if (catError || !category) {
      throw new NotFoundException('Category not found');
    }

    const { branchMembership, brandMembership } = await this.checkBranchAccess(
      category.branch_id,
      userId,
      brandMemberships,
      branchMemberships,
    );

    const role = branchMembership?.role || brandMembership?.role;
    if (!role) {
      throw new ForbiddenException('You do not have access to this branch');
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

  /**
   * 카테고리 정렬 순서 일괄 변경 (OWNER, ADMIN만 가능)
   */
  async reorderCategories(
    userId: string,
    branchId: string,
    items: { id: string; sortOrder: number }[],
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    this.logger.log(
      `Reordering ${items.length} categories for branch ${branchId} by user ${userId}`,
    );

    const { branchMembership, brandMembership } = await this.checkBranchAccess(
      branchId,
      userId,
      brandMemberships,
      branchMemberships,
    );

    const role = branchMembership?.role || brandMembership?.role;
    if (!role) {
      throw new ForbiddenException('You do not have access to this branch');
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
        this.logger.error(
          `Failed to update sort_order for category ${item.id}`,
          error,
        );
      }
    }

    return this.getMyCategories(
      userId,
      branchId,
      brandMemberships,
      branchMemberships,
    );
  }
}
