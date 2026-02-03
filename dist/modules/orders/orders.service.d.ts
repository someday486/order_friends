import { SupabaseService } from '../../infra/supabase/supabase.service';
import { OrderStatus } from './order-status.enum';
import { OrderDetailResponse } from './dto/order-detail.response';
import { OrderListItemResponse } from './dto/order-list.response';
export declare class OrdersService {
    private readonly supabase;
    constructor(supabase: SupabaseService);
    private isUuid;
    private resolveOrderId;
    getOrders(accessToken: string, branchId: string): Promise<OrderListItemResponse[]>;
    getOrder(accessToken: string, orderId: string, branchId: string): Promise<OrderDetailResponse>;
    updateStatus(accessToken: string, orderId: string, status: OrderStatus, branchId: string): Promise<{
        id: any;
        orderNo: any;
        status: OrderStatus;
    }>;
}
