import { SupabaseService } from '../../infra/supabase/supabase.service';
import { ProductListItemResponse } from './dto/product-list.response';
import { ProductDetailResponse } from './dto/product-detail.response';
import { CreateProductRequest } from './dto/create-product.request';
import { UpdateProductRequest } from './dto/update-product.request';
export declare class ProductsService {
    private readonly supabase;
    constructor(supabase: SupabaseService);
    getProducts(accessToken: string, branchId: string): Promise<ProductListItemResponse[]>;
    getProduct(accessToken: string, productId: string): Promise<ProductDetailResponse>;
    createProduct(accessToken: string, dto: CreateProductRequest): Promise<ProductDetailResponse>;
    updateProduct(accessToken: string, productId: string, dto: UpdateProductRequest): Promise<ProductDetailResponse>;
    deleteProduct(accessToken: string, productId: string): Promise<{
        deleted: boolean;
    }>;
}
