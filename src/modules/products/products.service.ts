import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { ProductListItemResponse } from './dto/product-list.response';
import { ProductDetailResponse, ProductOptionResponse } from './dto/product-detail.response';
import { CreateProductRequest } from './dto/create-product.request';
import { UpdateProductRequest } from './dto/update-product.request';

@Injectable()
export class ProductsService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * 상품 목록 조회
   */
  async getProducts(accessToken: string, branchId: string): Promise<ProductListItemResponse[]> {
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

    return (data ?? []).map((row: any) => ({
      id: row.id,
      name: row.name,
      price: row.price ?? 0,
      isActive: row.is_active ?? true,
      sortOrder: row.sort_order ?? 0,
      createdAt: row.created_at ?? '',
    }));
  }

  /**
   * 상품 상세 조회
   */
  async getProduct(accessToken: string, productId: string): Promise<ProductDetailResponse> {
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
      throw new NotFoundException(`[products.getProduct] ${error.message}`);
    }

    if (!data) {
      throw new NotFoundException('상품을 찾을 수 없습니다.');
    }

    const options: ProductOptionResponse[] = (data.product_options ?? []).map((opt: any) => ({
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

  /**
   * 상품 생성
   */
  async createProduct(accessToken: string, dto: CreateProductRequest): Promise<ProductDetailResponse> {
    const sb = this.supabase.userClient(accessToken);

    // 1. 상품 생성
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

    // 2. 옵션 생성 (있으면)
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

    // 3. 생성된 상품 조회 후 반환
    return this.getProduct(accessToken, productId);
  }

  /**
   * 상품 수정
   */
  async updateProduct(
    accessToken: string,
    productId: string,
    dto: UpdateProductRequest,
  ): Promise<ProductDetailResponse> {
    const sb = this.supabase.userClient(accessToken);

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.price !== undefined) updateData.price = dto.price;
    if (dto.isActive !== undefined) updateData.is_active = dto.isActive;
    if (dto.sortOrder !== undefined) updateData.sort_order = dto.sortOrder;

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
      throw new NotFoundException('상품을 찾을 수 없거나 권한이 없습니다.');
    }

    return this.getProduct(accessToken, productId);
  }

  /**
   * 상품 삭제
   */
  async deleteProduct(accessToken: string, productId: string): Promise<{ deleted: boolean }> {
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
}
