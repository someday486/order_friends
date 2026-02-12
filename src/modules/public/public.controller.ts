import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { PublicService } from './public.service';
import { CreatePublicOrderRequest } from './dto/public.dto';
import { UserRateLimit } from '../../common/decorators/user-rate-limit.decorator';

@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  /**
   * 가게 정보 조회
   * GET /public/branch/:branchId
   */
  @Get('branch/:branchId')
  @UserRateLimit({ points: 60, duration: 60 }) // 60 requests per minute
  async getBranch(@Param('branchId') branchId: string) {
    return this.publicService.getBranch(branchId);
  }

  /**
   * 가게 상품 목록 조회
   * GET /public/branch/:branchId/products
   */
  @Get('branch/:branchId/products')
  @UserRateLimit({ points: 30, duration: 60 }) // 30 requests per minute
  async getProducts(@Param('branchId') branchId: string) {
    return this.publicService.getProducts(branchId);
  }

  /**
   * 주문 생성
   * POST /public/orders
   */
  @Post('orders')
  @UserRateLimit({ points: 5, duration: 60, blockDuration: 300 }) // 5 orders per minute, 5min block
  async createOrder(@Body() dto: CreatePublicOrderRequest) {
    return this.publicService.createOrder(dto);
  }

  /**
   * 주문 조회
   * GET /public/orders/:orderId
   */
  @Get('orders/:orderId')
  @UserRateLimit({ points: 30, duration: 60 }) // 30 requests per minute
  async getOrder(@Param('orderId') orderId: string) {
    return this.publicService.getOrder(orderId);
  }
}
