import { PaginationDto } from '../../../common/dto/pagination.dto';
import { OrderStatus } from '../../orders/order-status.enum';
export declare class GetCustomerOrdersQueryDto extends PaginationDto {
    branchId?: string;
    status?: OrderStatus;
}
