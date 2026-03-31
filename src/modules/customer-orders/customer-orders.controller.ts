import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
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
import { BulkUpdateOrderStatusRequest } from './dto/bulk-update-order-status.request';
import { PaymentStatusResponse } from '../payments/dto/payment.dto';

@ApiTags('customer-orders')
@ApiBearerAuth()
@UseGuards(AuthGuard, CustomerGuard)
@Controller('customer/orders')
export class CustomerOrdersController {
  private readonly logger = new Logger(CustomerOrdersController.name);

  constructor(private readonly ordersService: CustomerOrdersService) {}

  @Get()
  @ApiOperation({
    summary: '접근 가능한 지점의 주문 목록 조회',
    description:
      '내가 멤버로 등록된 지점의 주문 목록을 조회합니다. 페이지네이션과 상태/수령 방식/기간 필터를 지원합니다.',
  })
  @ApiQuery({ name: 'branchId', description: '지점 ID', required: false })
  @ApiQuery({ name: 'status', description: '주문 상태 필터', required: false })
  @ApiQuery({
    name: 'fulfillmentType',
    description: '수령 방식 필터',
    required: false,
  })
  @ApiQuery({
    name: 'dateStart',
    description: '조회 시작일 (YYYY-MM-DD)',
    required: false,
  })
  @ApiQuery({
    name: 'dateEnd',
    description: '조회 종료일 (YYYY-MM-DD, inclusive)',
    required: false,
  })
  @ApiQuery({
    name: 'depositStatus',
    description: '입금 상태 필터',
    required: false,
  })
  @ApiQuery({
    name: 'search',
    description:
      '\uC8FC\uBB38\uBC88\uD638, \uACE0\uAC1D\uBA85, \uC0C1\uD488\uBA85 \uAC80\uC0C9\uC5B4',
    required: false,
  })
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

    const {
      branchId,
      status,
      fulfillmentType,
      dateStart,
      dateEnd,
      depositStatus,
      search,
      page,
      limit,
    } = query ?? {};
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
      fulfillmentType,
      dateStart,
      dateEnd,
      depositStatus,
      search,
    );
  }

  @Get(':orderId')
  @ApiOperation({
    summary: '주문 상세 조회',
    description: '내가 접근 가능한 지점의 특정 주문 상세 정보를 조회합니다.',
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
      '내가 권한을 가진 지점의 주문 상태를 변경합니다. OWNER, ADMIN, BRANCH_OWNER, BRANCH_ADMIN, STAFF 역할에서 사용할 수 있습니다.',
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

  @Patch(':orderId/payment/confirm-transfer')
  @ApiOperation({
    summary: '계좌이체 수동 입금확인',
    description:
      '계좌이체 주문의 결제 상태를 수동으로 SUCCESS로 변경합니다. OWNER, ADMIN, BRANCH_OWNER, BRANCH_ADMIN, STAFF 역할에서 사용할 수 있습니다.',
  })
  @ApiParam({ name: 'orderId', description: '주문 ID 또는 주문 번호' })
  @ApiResponse({
    status: 200,
    description: '입금확인 처리 성공',
    type: PaymentStatusResponse,
  })
  @ApiResponse({ status: 403, description: '권한 없음' })
  @ApiResponse({
    status: 404,
    description: '주문 또는 결제 정보를 찾을 수 없음',
  })
  async confirmTransferPayment(
    @Req() req: AuthRequest,
    @Param('orderId') orderId: string,
  ) {
    if (!req.user) throw new Error('Missing user');

    this.logger.log(
      `User ${req.user.id} manually confirming transfer payment for ${orderId}`,
    );

    return this.ordersService.confirmMyOrderTransferPayment(
      req.user.id,
      orderId,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }

  @Patch(':orderId/cash-receipt/retry')
  @ApiOperation({
    summary: '현금영수증 재발행 시도',
    description:
      '현금영수증 발행에 실패했거나 결과가 없는 완료 주문에 대해 발행을 다시 시도합니다.',
  })
  @ApiParam({ name: 'orderId', description: '주문 ID 또는 주문 번호' })
  @ApiResponse({ status: 200, description: '현금영수증 재발행 시도 성공' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  @ApiResponse({
    status: 404,
    description: '주문을 찾을 수 없거나 현금영수증을 재시도할 수 없음',
  })
  async retryCashReceiptIssue(
    @Req() req: AuthRequest,
    @Param('orderId') orderId: string,
  ) {
    if (!req.user) throw new Error('Missing user');

    this.logger.log(
      `User ${req.user.id} retrying cash receipt issue for ${orderId}`,
    );

    return this.ordersService.retryMyOrderCashReceiptIssue(
      req.user.id,
      orderId,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }

  @Patch('bulk-status')
  @ApiOperation({
    summary: '주문 상태 일괄 변경',
    description:
      '선택한 주문들의 상태를 한 번에 변경합니다. 권한이 없는 주문이 포함되면 요청이 실패할 수 있습니다.',
  })
  @ApiResponse({ status: 200, description: '주문 상태 일괄 변경 성공' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  @ApiResponse({ status: 404, description: '주문을 찾을 수 없음' })
  async updateOrderStatusBulk(
    @Req() req: AuthRequest,
    @Body() body: BulkUpdateOrderStatusRequest,
  ) {
    if (!req.user) throw new Error('Missing user');

    this.logger.log(
      `User ${req.user.id} bulk updating ${body.orderIds.length} orders to ${body.status}`,
    );

    return this.ordersService.updateMyOrdersStatusBulk(
      req.user.id,
      body.orderIds,
      body.status,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }
}
