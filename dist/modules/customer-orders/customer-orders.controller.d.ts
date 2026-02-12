import type { AuthRequest } from '../../common/types/auth-request';
import { CustomerOrdersService } from './customer-orders.service';
import { UpdateOrderStatusRequest } from '../../modules/orders/dto/update-order-status.request';
import { GetCustomerOrdersQueryDto } from './dto/get-customer-orders-query.dto';
export declare class CustomerOrdersController {
    private readonly ordersService;
    private readonly logger;
    constructor(ordersService: CustomerOrdersService);
    getOrders(req: AuthRequest, query?: GetCustomerOrdersQueryDto): Promise<import("../../common/dto/pagination.dto").PaginatedResponse<{
        id: any;
        orderNo: any;
        orderedAt: any;
        customerName: any;
        totalAmount: any;
        status: import("../orders/order-status.enum").OrderStatus;
    }>>;
    getOrder(req: AuthRequest, orderId: string): Promise<import("../orders/dto/order-detail.response").OrderDetailResponse>;
    updateOrderStatus(req: AuthRequest, orderId: string, body: UpdateOrderStatusRequest): Promise<{
        id: any;
        orderNo: any;
        orderedAt: any;
        customerName: any;
        totalAmount: any;
        status: import("../orders/order-status.enum").OrderStatus;
    }>;
}
