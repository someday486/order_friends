import { PublicService } from './public.service';
import { CreatePublicOrderRequest } from './dto/public.dto';
export declare class PublicController {
    private readonly publicService;
    constructor(publicService: PublicService);
    getBranch(branchId: string): Promise<import("./dto/public.dto").PublicBranchResponse>;
    getProducts(branchId: string): Promise<import("./dto/public.dto").PublicProductResponse[]>;
    createOrder(dto: CreatePublicOrderRequest): Promise<import("./dto/public.dto").PublicOrderResponse>;
    getOrder(orderId: string): Promise<import("./dto/public.dto").PublicOrderResponse>;
}
