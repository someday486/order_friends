import {
  Controller,
  Get,
  Post,
  Param,
  Body,
} from '@nestjs/common';
import { PublicOrderService } from './public-order.service';
import { CreatePublicOrderRequest } from './dto/public-order.dto';

@Controller('public')
export class PublicOrderController {
  constructor(private readonly publicOrderService: PublicOrderService) {}

  /**
   * 가게 정보 조회
   * GET /public/branches/:branchId
   */
  @Get('branches/:branchId')
  async getBranch(@Param('branchId') branchId: string) {
    return this.publicOrderService.getBranch(branchId);
  }

  /**
   * 가게 상품 목록 조회
   * GET /public/branches/:branchId/products
   */
  @Get('branches/:branchId/products')
  async getProducts(@Param('branchId') branchId: string) {
    return this.publicOrderService.getProducts(branchId);
  }

  /**
   * 주문 생성
   * POST /public/orders
   */
  @Post('orders')
  async createOrder(@Body() dto: CreatePublicOrderRequest) {
    return this.publicOrderService.createOrder(dto);
  }

  /**
   * 주문 조회 (ID 또는 주문번호)
   * GET /public/orders/:orderIdOrNo
   */
  @Get('orders/:orderIdOrNo')
  async getOrder(@Param('orderIdOrNo') orderIdOrNo: string) {
    return this.publicOrderService.getOrder(orderIdOrNo);
  }
}
