import { PublicOrderService } from './public-order.service';
import { CreatePublicOrderRequest } from './dto/public-order.dto';
export declare class PublicOrderController {
    private readonly publicOrderService;
    constructor(publicOrderService: PublicOrderService);
    getBranch(branchId: string): Promise<import("./dto/public-order.dto").PublicBranchResponse>;
    getBranchBySlug(slug: string): Promise<import("./dto/public-order.dto").PublicBranchResponse>;
    getBranchByBrandSlug(brandSlug: string, branchSlug: string): Promise<import("./dto/public-order.dto").PublicBranchResponse>;
    getCategories(branchId: string): Promise<{
        id: any;
        name: any;
        sortOrder: any;
    }[]>;
    getProducts(branchId: string): Promise<import("./dto/public-order.dto").PublicProductResponse[]>;
    createOrder(dto: CreatePublicOrderRequest): Promise<import("./dto/public-order.dto").PublicOrderResponse>;
    getOrder(orderIdOrNo: string): Promise<import("./dto/public-order.dto").PublicOrderResponse>;
}
