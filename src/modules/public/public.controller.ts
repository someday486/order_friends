import {
  Controller,
  Get,
  Post,
  Param,
  Body,
} from '@nestjs/common';
import { PublicService } from './public.service';
import { CreatePublicOrderRequest } from './dto/public.dto';

@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  /**
   * 가게 정보 조회
   * GET /public/branch/:branchId
   */
  @Get('branch/:branchId')
  async getBranch(@Param('branchId') branchId: string) {
    return this.publicService.getBranch(branchId);
  }

  /**
   * 가게 상품 목록 조회
   * GET /public/branch/:branchId/products
   */
  @Get('branch/:branchId/products')
  async getProducts(@Param('branchId') branchId: string) {
    return this.publicService.getProducts(branchId);
  }

  /**
   * 주문 생성
   * POST /public/orders
   */
  @Post('orders')
  async createOrder(@Body() dto: CreatePublicOrderRequest) {
    return this.publicService.createOrder(dto);
  }

  /**
   * 주문 조회
   * GET /public/orders/:orderId
   */
  @Get('orders/:orderId')
  async getOrder(@Param('orderId') orderId: string) {
    return this.publicService.getOrder(orderId);
  }
}
