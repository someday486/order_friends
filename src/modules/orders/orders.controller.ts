import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
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
import { OrdersService } from './orders.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { UpdateOrderStatusRequest } from './dto/update-order-status.request';
import { GetOrdersQueryDto } from './dto/get-orders-query.dto';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(AuthGuard, AdminGuard)
@Controller('admin/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({
    summary: '주문 목록 조회',
    description: '지점의 주문 목록을 조회합니다. (페이지네이션 지원)',
  })
  @ApiResponse({ status: 200, description: '주문 목록 조회 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async getOrders(
    @Req() req: AuthRequest,
    @Query() query: GetOrdersQueryDto,
  ) {
    if (!req.accessToken) throw new Error('Missing access token');
    return this.ordersService.getOrders(
      req.accessToken,
      query.branchId,
      query,
    );
  }

  @Get(':orderId')
  @ApiOperation({
    summary: '주문 상세 조회',
    description: '특정 주문의 상세 정보를 조회합니다.',
  })
  @ApiParam({ name: 'orderId', description: '주문 ID 또는 주문 번호' })
  @ApiQuery({ name: 'branchId', description: '지점 ID', required: true })
  @ApiResponse({ status: 200, description: '주문 상세 조회 성공' })
  @ApiResponse({ status: 404, description: '주문을 찾을 수 없음' })
  async getOrder(
    @Param('orderId') orderId: string,
    @Req() req: AuthRequest,
    @Query('branchId') branchId: string,
  ) {
    if (!req.accessToken) throw new Error('Missing access token');
    if (!branchId) {
      throw new BadRequestException('branchId is required');
    }
    return this.ordersService.getOrder(req.accessToken, orderId, branchId);
  }

  @Patch(':orderId/status')
  @ApiOperation({
    summary: '주문 상태 변경',
    description: '주문의 상태를 변경합니다.',
  })
  @ApiParam({ name: 'orderId', description: '주문 ID 또는 주문 번호' })
  @ApiQuery({ name: 'branchId', description: '지점 ID', required: true })
  @ApiResponse({ status: 200, description: '주문 상태 변경 성공' })
  @ApiResponse({ status: 404, description: '주문을 찾을 수 없음' })
  async updateOrderStatus(
    @Param('orderId') orderId: string,
    @Body() body: UpdateOrderStatusRequest,
    @Req() req: AuthRequest,
    @Query('branchId') branchId: string,
  ) {
    if (!req.accessToken) throw new Error('Missing access token');
    if (!branchId) {
      throw new BadRequestException('branchId is required');
    }
    return this.ordersService.updateStatus(
      req.accessToken,
      orderId,
      body.status,
      branchId,
    );
  }
}
