import { SupabaseService } from '../../infra/supabase/supabase.service';
import { OrderStatus } from './order-status.enum';
import { OrderDetailResponse } from './dto/order-detail.response';
import { OrderListItemResponse } from './dto/order-list.response';
import { PaginationDto, PaginatedResponse } from '../../common/dto/pagination.dto';
export declare class OrdersService {
    private readonly supabase;
    private readonly logger;
    constructor(supabase: SupabaseService);
    private isUuid;
    private resolveOrderId;
    getOrders(accessToken: string, branchId: string, paginationDto?: PaginationDto): Promise<PaginatedResponse<OrderListItemResponse>>;
    getOrder(accessToken: string, orderId: string, branchId: string): Promise<OrderDetailResponse>;
    updateStatus(accessToken: string, orderId: string, status: OrderStatus, branchId: string): Promise<{
        id: any;
        orderNo: any;
        status: OrderStatus;
    }>;
}
