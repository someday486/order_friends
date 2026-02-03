import { SupabaseService } from '../../infra/supabase/supabase.service';
import { ProductListItemResponse } from './dto/product-list.response';
import { ProductDetailResponse } from './dto/product-detail.response';
import { CreateProductRequest } from './dto/create-product.request';
import { UpdateProductRequest } from './dto/update-product.request';
export declare class ProductsService {
    private readonly supabase;
    constructor(supabase: SupabaseService);
    private getClient;
    private getPriceFromRow;
    private emptyOptions;
    getProducts(accessToken: string, branchId: string, isAdmin?: boolean): Promise<ProductListItemResponse[]>;
    getProduct(accessToken: string, productId: string, isAdmin?: boolean): Promise<ProductDetailResponse>;
    createProduct(accessToken: string, dto: CreateProductRequest, isAdmin?: boolean): Promise<ProductDetailResponse>;
    updateProduct(accessToken: string, productId: string, dto: UpdateProductRequest, isAdmin?: boolean): Promise<ProductDetailResponse>;
    deleteProduct(accessToken: string, productId: string, isAdmin?: boolean): Promise<{
        deleted: boolean;
    }>;
}
