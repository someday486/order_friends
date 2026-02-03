import { ProductsService } from './products.service';
import { CreateProductRequest } from './dto/create-product.request';
import { UpdateProductRequest } from './dto/update-product.request';
export declare class ProductsController {
    private readonly productsService;
    constructor(productsService: ProductsService);
    getProducts(authHeader: string, branchId: string): Promise<import("./dto/product-list.response").ProductListItemResponse[]>;
    getProduct(authHeader: string, productId: string): Promise<import("./dto/product-detail.response").ProductDetailResponse>;
    createProduct(authHeader: string, dto: CreateProductRequest): Promise<import("./dto/product-detail.response").ProductDetailResponse>;
    updateProduct(authHeader: string, productId: string, dto: UpdateProductRequest): Promise<import("./dto/product-detail.response").ProductDetailResponse>;
    deleteProduct(authHeader: string, productId: string): Promise<{
        deleted: boolean;
    }>;
}
