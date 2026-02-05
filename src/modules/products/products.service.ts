import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { ProductListItemResponse } from './dto/product-list.response';
import {
  ProductDetailResponse,
  ProductOptionResponse,
} from './dto/product-detail.response';
import { CreateProductRequest } from './dto/create-product.request';
import { UpdateProductRequest } from './dto/update-product.request';
import { ProductCategoryResponse } from './dto/product-category.response';
import { ProductNotFoundException } from '../../common/exceptions/product.exception';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ProductSearchDto } from '../../common/dto/search.dto';
import { QueryBuilder } from '../../common/utils/query-builder.util';
import { PaginatedResponse } from '../../common/dto/pagination.dto';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  private getClient(accessToken: string, isAdmin?: boolean) {
    return isAdmin
      ? this.supabase.adminClient()
      : this.supabase.userClient(accessToken);
  }

  private getPriceFromRow(row: any): number {
    if (!row) return 0;
    if (row.base_price !== undefined && row.base_price !== null)
      return row.base_price;
    if (row.price !== undefined && row.price !== null) return row.price;
    if (row.price_amount !== undefined && row.price_amount !== null)
      return row.price_amount;
    return 0;
  }

  private emptyOptions(): ProductOptionResponse[] {
    return [];
  }

  /**
   * 상품 목록
   */
  async getProducts(
    accessToken: string,
    branchId: string,
    isAdmin?: boolean,
  ): Promise<ProductListItemResponse[]> {
    this.logger.log(`Fetching products for branch: ${branchId}`);
    const sb = this.getClient(accessToken, isAdmin);

    const selectFields = '*';
    const { data, error } = await (sb as any)
      .from('products')
      .select(selectFields)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to fetch products: ${error.message}`, error);
      throw new BusinessException(
        'Failed to fetch products',
        'PRODUCT_FETCH_FAILED',
        500,
        { branchId, error: error.message },
      );
    }

    this.logger.log(
      `Fetched ${data?.length || 0} products for branch: ${branchId}`,
    );

    return (data ?? []).map((row: any) => ({
      id: row.id,
      name: row.name,
      price: this.getPriceFromRow(row),
      isActive: !(row.is_hidden ?? false),
      sortOrder: 0,
      createdAt: row.created_at ?? '',
    }));
  }

  /**
   * 상품 검색 (필터링 및 페이지네이션 지원)
   */
  async searchProducts(
    accessToken: string,
    branchId: string,
    searchDto: ProductSearchDto,
    isAdmin?: boolean,
  ): Promise<PaginatedResponse<ProductListItemResponse>> {
    this.logger.log(`Searching products for branch: ${branchId} with filters: ${JSON.stringify(searchDto)}`);
    const sb = this.getClient(accessToken, isAdmin);

    const query = QueryBuilder.buildProductSearchQuery(sb, branchId, searchDto);
    const { data, error, count } = await query;

    if (error) {
      this.logger.error(`Failed to search products: ${error.message}`, error);
      throw new BusinessException(
        'Failed to search products',
        'PRODUCT_SEARCH_FAILED',
        500,
        { branchId, searchDto, error: error.message },
      );
    }

    const items = (data ?? []).map((row: any) => ({
      id: row.id,
      name: row.name,
      price: this.getPriceFromRow(row),
      isActive: !(row.is_hidden ?? false),
      sortOrder: 0,
      createdAt: row.created_at ?? '',
    }));

    const page = searchDto.page || 1;
    const limit = searchDto.limit || 20;
    const totalPages = count ? Math.ceil(count / limit) : 0;

    return {
      data: items,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
      },
    };
  }

  /**
   * 상품 카테고리 목록
   */
  async getCategories(
    accessToken: string,
    branchId: string,
    isAdmin?: boolean,
  ): Promise<ProductCategoryResponse[]> {
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

    return (data ?? []).map((row: any) => ({
      id: row.id,
      branchId: row.branch_id,
      name: row.name,
      sortOrder: row.sort_order ?? 0,
      isActive: row.is_active ?? true,
      createdAt: row.created_at ?? '',
    }));
  }

  /**
   * 상품 상세
   */
  async getProduct(
    accessToken: string,
    productId: string,
    isAdmin?: boolean,
  ): Promise<ProductDetailResponse> {
    const sb = this.getClient(accessToken, isAdmin);

    const selectDetail = '*';
    const { data, error } = await (sb as any)
      .from('products')
      .select(selectDetail)
      .eq('id', productId)
      .single();

    if (error) {
      this.logger.error(`Failed to fetch product: ${error.message}`, error);
      throw new BusinessException(
        'Failed to fetch product',
        'PRODUCT_FETCH_FAILED',
        500,
        { productId, error: error.message },
      );
    }

    if (!data) {
      this.logger.warn(`Product not found: ${productId}`);
      throw new ProductNotFoundException(productId);
    }

    const options: ProductOptionResponse[] = this.emptyOptions();

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

  /**
   * 상품 생성
   */
  async createProduct(
    accessToken: string,
    dto: CreateProductRequest,
    isAdmin?: boolean,
  ): Promise<ProductDetailResponse> {
    const sb = this.getClient(accessToken, isAdmin);
    const insertPayload: any = {
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
      this.logger.error(
        `Failed to create product: ${productError.message}`,
        productError,
      );
      throw new BusinessException(
        'Failed to create product',
        'PRODUCT_CREATE_FAILED',
        500,
        { error: productError.message },
      );
    }

    const productId = productData.id;
    this.logger.log(`Product created successfully: ${productId}`);

    if (dto.options && dto.options.length > 0) {
      this.logger.warn(
        '[products.createProduct] product_options table not available; options ignored',
      );
    }

    return this.getProduct(accessToken, productId, isAdmin);
  }

  /**
   * 상품 수정
   */
  async updateProduct(
    accessToken: string,
    productId: string,
    dto: UpdateProductRequest,
    isAdmin?: boolean,
  ): Promise<ProductDetailResponse> {
    const sb = this.getClient(accessToken, isAdmin);

    const baseUpdate: any = {};
    if (dto.name !== undefined) baseUpdate.name = dto.name;
    if (dto.description !== undefined) baseUpdate.description = dto.description;
    if (dto.isActive !== undefined) baseUpdate.is_hidden = !dto.isActive;
    if (dto.price !== undefined) baseUpdate.base_price = dto.price;
    if (dto.categoryId !== undefined) baseUpdate.category_id = dto.categoryId;
    if (dto.imageUrl !== undefined) baseUpdate.image_url = dto.imageUrl;

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
      throw new BusinessException(
        'Failed to update product',
        'PRODUCT_UPDATE_FAILED',
        500,
        { productId, error: error.message },
      );
    }

    if (!data) {
      this.logger.warn(`Product not found for update: ${productId}`);
      throw new ProductNotFoundException(productId);
    }

    this.logger.log(`Product updated successfully: ${productId}`);

    return this.getProduct(accessToken, productId, isAdmin);
  }

  /**
   * 상품 삭제
   */
  async deleteProduct(
    accessToken: string,
    productId: string,
    isAdmin?: boolean,
  ): Promise<{ deleted: boolean }> {
    const sb = this.getClient(accessToken, isAdmin);

    const { error } = await sb.from('products').delete().eq('id', productId);

    if (error) {
      this.logger.error(`Failed to delete product: ${error.message}`, error);
      throw new BusinessException(
        'Failed to delete product',
        'PRODUCT_DELETE_FAILED',
        500,
        { productId, error: error.message },
      );
    }

    this.logger.log(`Product deleted successfully: ${productId}`);

    return { deleted: true };
  }
}
