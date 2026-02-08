import { SupabaseService } from '../../infra/supabase/supabase.service';
import type { BrandMembership, BranchMembership } from '../../common/types/auth-request';
import { OrderStatus } from '../../modules/orders/order-status.enum';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { OrderDetailResponse } from '../../modules/orders/dto/order-detail.response';
export declare class CustomerOrdersService {
    private readonly supabase;
    private readonly logger;
    constructor(supabase: SupabaseService);
    private isUuid;
    private resolveOrderId;
    private checkBranchAccess;
    private checkOrderAccess;
    private checkModificationPermission;
    private getAccessibleBranchIds;
    getMyOrders(userId: string, branchId: string | undefined, brandMemberships: BrandMembership[], branchMemberships: BranchMembership[], paginationDto?: PaginationDto, status?: OrderStatus): Promise<import("../../common/dto/pagination.dto").PaginatedResponse<{
        id: any;
        orderNo: any;
        orderedAt: any;
        customerName: any;
        totalAmount: any;
        status: OrderStatus;
    }>>;
    getMyOrder(userId: string, orderId: string, brandMemberships: BrandMembership[], branchMemberships: BranchMembership[]): Promise<OrderDetailResponse>;
    updateMyOrderStatus(userId: string, orderId: string, status: OrderStatus, brandMemberships: BrandMembership[], branchMemberships: BranchMembership[]): Promise<{
        id: any;
        orderNo: any;
        orderedAt: any;
        customerName: any;
        totalAmount: any;
        status: OrderStatus;
    }>;
}
