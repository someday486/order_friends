import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import type { AuthRequest } from '../../common/types/auth-request';
import { OrdersService } from './orders.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { UpdateOrderStatusRequest } from './dto/update-order-status.request';

@UseGuards(AuthGuard)
@Controller('admin/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  async getOrders(@Req() req: AuthRequest) {
    if (!req.accessToken) throw new Error('Missing access token');
    return this.ordersService.getOrders(req.accessToken);
  }

  @Get(':orderId')
  async getOrder(@Param('orderId') orderId: string, @Req() req: AuthRequest) {
    if (!req.accessToken) throw new Error('Missing access token');
    return this.ordersService.getOrder(req.accessToken, orderId);
  }

  @Patch(':orderId/status')
  async updateOrderStatus(
    @Param('orderId') orderId: string,
    @Body() body: UpdateOrderStatusRequest,
    @Req() req: AuthRequest,
  ) {
    if (!req.accessToken) throw new Error('Missing access token');
    return this.ordersService.updateStatus(req.accessToken, orderId, body.status);
  }
}
