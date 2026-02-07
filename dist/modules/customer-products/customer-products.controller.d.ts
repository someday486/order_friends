import type { AuthRequest } from '../../common/types/auth-request';
import { CustomerProductsService } from './customer-products.service';
import { CreateProductRequest } from '../../modules/products/dto/create-product.request';
import { UpdateProductRequest } from '../../modules/products/dto/update-product.request';
export declare class CustomerProductsController {
    private readonly productsService;
    private readonly logger;
    constructor(productsService: CustomerProductsService);
    getProducts(req: AuthRequest, branchId: string): Promise<any[]>;
    getCategories(req: AuthRequest, branchId: string): Promise<{
        id: any;
        branchId: any;
        name: any;
        sortOrder: any;
        isActive: any;
        createdAt: any;
    }[]>;
    getProduct(req: AuthRequest, productId: string): Promise<any>;
    createProduct(req: AuthRequest, dto: CreateProductRequest): Promise<any>;
    updateProduct(req: AuthRequest, productId: string, dto: UpdateProductRequest): Promise<any>;
    deleteProduct(req: AuthRequest, productId: string): Promise<{
        deleted: boolean;
    }>;
}
