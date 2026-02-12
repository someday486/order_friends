import type { AuthRequest } from '../../common/types/auth-request';
import { OrdersService } from './orders.service';
import { UpdateOrderStatusRequest } from './dto/update-order-status.request';
import { GetOrdersQueryDto } from './dto/get-orders-query.dto';
export declare class OrdersController {
    private readonly ordersService;
    constructor(ordersService: OrdersService);
    getOrders(req: AuthRequest, query: GetOrdersQueryDto): Promise<import("../../common/dto/pagination.dto").PaginatedResponse<import("./dto/order-list.response").OrderListItemResponse>>;
    getOrder(orderId: string, req: AuthRequest, branchId: string): Promise<import("./dto/order-detail.response").OrderDetailResponse>;
    updateOrderStatus(orderId: string, body: UpdateOrderStatusRequest, req: AuthRequest, branchId: string): Promise<{
        id: any;
        orderNo: any;
        status: import("./order-status.enum").OrderStatus;
    }>;
}
