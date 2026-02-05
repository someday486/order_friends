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
      .select(
        'id, branch_id, name, description, category_id, price, is_active, sort_order, image_url, created_at',
      )
      .eq('branch_id', branchId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

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
        price: dto.price,
        is_active: dto.isActive ?? true,
        sort_order: dto.sortOrder ?? 0,
        image_url: dto.imageUrl,
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
    if (dto.price !== undefined) updateFields.price = dto.price;
    if (dto.isActive !== undefined) updateFields.is_active = dto.isActive;
    if (dto.sortOrder !== undefined) updateFields.sort_order = dto.sortOrder;
    if (dto.imageUrl !== undefined) updateFields.image_url = dto.imageUrl;

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
}
