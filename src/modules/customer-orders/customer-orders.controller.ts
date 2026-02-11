import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import type { AuthRequest } from '../../common/types/auth-request';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CustomerGuard } from '../../common/guards/customer.guard';
import { CustomerOrdersService } from './customer-orders.service';
import { UpdateOrderStatusRequest } from '../../modules/orders/dto/update-order-status.request';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { GetCustomerOrdersQueryDto } from './dto/get-customer-orders-query.dto';

@ApiTags('customer-orders')
@ApiBearerAuth()
@UseGuards(AuthGuard, CustomerGuard)
@Controller('customer/orders')
export class CustomerOrdersController {
  private readonly logger = new Logger(CustomerOrdersController.name);

  constructor(private readonly ordersService: CustomerOrdersService) {}

  @Get()
  @ApiOperation({
    summary: '내 지점의 주문 목록 조회',
    description:
      '내가 멤버로 등록된 지점의 주문 목록을 조회합니다. (페이지네이션 지원)',
  })
  @ApiQuery({ name: 'branchId', description: '지점 ID', required: false })
  @ApiQuery({ name: 'status', description: '주문 상태 필터', required: false })
  @ApiQuery({ name: 'page', description: '페이지 번호', required: false })
  @ApiQuery({ name: 'limit', description: '페이지당 항목 수', required: false })
  @ApiResponse({ status: 200, description: '주문 목록 조회 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async getOrders(
    @Req() req: AuthRequest,
    @Query() query?: GetCustomerOrdersQueryDto,
  ) {
    if (!req.user) throw new Error('Missing user');

    const { branchId, status, page, limit } = query ?? {};
    const paginationDto: PaginationDto = { page, limit };

    this.logger.log(
      `User ${req.user.id} fetching orders${branchId ? ` for branch ${branchId}` : ' (all branches)'}`,
    );
    return this.ordersService.getMyOrders(
      req.user.id,
      branchId,
      req.brandMemberships || [],
      req.branchMemberships || [],
      paginationDto,
      status,
    );
  }

  @Get(':orderId')
  @ApiOperation({
    summary: '내 주문 상세 조회',
    description: '내가 멤버로 등록된 지점의 주문 상세 정보를 조회합니다.',
  })
  @ApiParam({ name: 'orderId', description: '주문 ID 또는 주문 번호' })
  @ApiResponse({ status: 200, description: '주문 상세 조회 성공' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  @ApiResponse({ status: 404, description: '주문을 찾을 수 없음' })
  async getOrder(@Req() req: AuthRequest, @Param('orderId') orderId: string) {
    if (!req.user) throw new Error('Missing user');

    this.logger.log(`User ${req.user.id} fetching order ${orderId}`);
    return this.ordersService.getMyOrder(
      req.user.id,
      orderId,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }

  @Patch(':orderId/status')
  @ApiOperation({
    summary: '주문 상태 변경',
    description:
      '내가 OWNER 또는 ADMIN 권한을 가진 지점의 주문 상태를 변경합니다.',
  })
  @ApiParam({ name: 'orderId', description: '주문 ID 또는 주문 번호' })
  @ApiResponse({ status: 200, description: '주문 상태 변경 성공' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  @ApiResponse({ status: 404, description: '주문을 찾을 수 없음' })
  async updateOrderStatus(
    @Req() req: AuthRequest,
    @Param('orderId') orderId: string,
    @Body() body: UpdateOrderStatusRequest,
  ) {
    if (!req.user) throw new Error('Missing user');

    this.logger.log(
      `User ${req.user.id} updating order ${orderId} status to ${body.status}`,
    );
    return this.ordersService.updateMyOrderStatus(
      req.user.id,
      orderId,
      body.status,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }
}
