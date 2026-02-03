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
import type { AuthRequest } from '../../common/types/auth-request';
import { OrdersService } from './orders.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { UpdateOrderStatusRequest } from './dto/update-order-status.request';

@UseGuards(AuthGuard, AdminGuard)
@Controller('admin/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  async getOrders(@Req() req: AuthRequest, @Query('branchId') branchId: string) {
    if (!req.accessToken) throw new Error('Missing access token');
    if (!branchId) {
      throw new BadRequestException('branchId is required');
    }
    return this.ordersService.getOrders(req.accessToken, branchId);
  }

  @Get(':orderId')
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
    return this.ordersService.updateStatus(req.accessToken, orderId, body.status, branchId);
  }
}
