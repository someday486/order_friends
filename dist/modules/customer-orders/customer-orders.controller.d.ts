import type { AuthRequest } from '../../common/types/auth-request';
import { CustomerOrdersService } from './customer-orders.service';
import { UpdateOrderStatusRequest } from '../../modules/orders/dto/update-order-status.request';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { OrderStatus } from '../../modules/orders/order-status.enum';
export declare class CustomerOrdersController {
    private readonly ordersService;
    private readonly logger;
    constructor(ordersService: CustomerOrdersService);
    getOrders(req: AuthRequest, branchId?: string, status?: OrderStatus, paginationDto?: PaginationDto): Promise<import("../../common/dto/pagination.dto").PaginatedResponse<{
        id: any;
        orderNo: any;
        orderedAt: any;
        customerName: any;
        totalAmount: any;
        status: OrderStatus;
    }>>;
    getOrder(req: AuthRequest, orderId: string): Promise<import("../orders/dto/order-detail.response").OrderDetailResponse>;
    updateOrderStatus(req: AuthRequest, orderId: string, body: UpdateOrderStatusRequest): Promise<{
        id: any;
        orderNo: any;
        orderedAt: any;
        customerName: any;
        totalAmount: any;
        status: OrderStatus;
    }>;
}
