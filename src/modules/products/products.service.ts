import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { ProductListItemResponse } from './dto/product-list.response';
import { ProductDetailResponse, ProductOptionResponse } from './dto/product-detail.response';
import { CreateProductRequest } from './dto/create-product.request';
import { UpdateProductRequest } from './dto/update-product.request';

@Injectable()
export class ProductsService {
  constructor(private readonly supabase: SupabaseService) {}

  private getClient(accessToken: string, isAdmin?: boolean) {
    return isAdmin ? this.supabase.adminClient() : this.supabase.userClient(accessToken);
  }

  private getPriceFromRow(row: any): number {
    if (!row) return 0;
    if (row.base_price !== undefined && row.base_price !== null) return row.base_price;
    if (row.price !== undefined && row.price !== null) return row.price;
    if (row.price_amount !== undefined && row.price_amount !== null) return row.price_amount;
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
    const sb = this.getClient(accessToken, isAdmin);

    const selectFields = '*';
    const { data, error } = await (sb as any)
      .from('products')
      .select(selectFields)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`[products.getProducts] ${error.message}`);
    }

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
      throw new NotFoundException(`[products.getProduct] ${error.message}`);
    }

    if (!data) {
      throw new NotFoundException('상품을 찾을 수 없습니다.');
    }

    const options: ProductOptionResponse[] = this.emptyOptions();

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
      throw new NotFoundException('수정할 상품을 찾을 수 없습니다.');
    }

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

    const { error } = await sb
      .from('products')
      .delete()
      .eq('id', productId);

    if (error) {
      throw new Error(`[products.deleteProduct] ${error.message}`);
    }

    return { deleted: true };
  }
}
