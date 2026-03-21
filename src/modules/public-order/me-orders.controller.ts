import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/decorators/current-user.decorator';
import { CreatePublicOrderRequest } from './dto/public-order.dto';
import { MeOrdersService } from './me-orders.service';

@ApiTags('me-orders')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('me/orders')
export class MeOrdersController {
  constructor(private readonly meOrdersService: MeOrdersService) {}

  @Post()
  @ApiOperation({ summary: '로그인한 구매자가 주문 생성' })
  @ApiResponse({ status: 201, description: '주문 생성 성공' })
  async createOrder(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreatePublicOrderRequest,
  ) {
    return this.meOrdersService.createMyOrder(user.id, dto);
  }

  @Post(':orderId/cancel')
  @ApiOperation({ summary: '로그인한 구매자가 자신의 주문 취소' })
  @ApiResponse({ status: 200, description: '주문 취소 성공' })
  async cancelOrder(
    @CurrentUser() user: RequestUser,
    @Param('orderId') orderId: string,
  ) {
    return this.meOrdersService.cancelMyOrder(user.id, orderId);
  }
}
