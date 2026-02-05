import type { AuthRequest } from '../../common/types/auth-request';
import { ProductsService } from './products.service';
import { CreateProductRequest } from './dto/create-product.request';
import { UpdateProductRequest } from './dto/update-product.request';
export declare class ProductsController {
    private readonly productsService;
    constructor(productsService: ProductsService);
    getProducts(req: AuthRequest, branchId: string): Promise<import("./dto/product-list.response").ProductListItemResponse[]>;
    getCategories(req: AuthRequest, branchId: string): Promise<import("./dto/product-category.response").ProductCategoryResponse[]>;
    getProduct(req: AuthRequest, productId: string): Promise<import("./dto/product-detail.response").ProductDetailResponse>;
    createProduct(req: AuthRequest, dto: CreateProductRequest): Promise<import("./dto/product-detail.response").ProductDetailResponse>;
    updateProduct(req: AuthRequest, productId: string, dto: UpdateProductRequest): Promise<import("./dto/product-detail.response").ProductDetailResponse>;
    deleteProduct(req: AuthRequest, productId: string): Promise<{
        deleted: boolean;
    }>;
}
