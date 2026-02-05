import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { PublicOrderService } from './public-order.service';
import { CreatePublicOrderRequest } from './dto/public-order.dto';

@Controller('public')
export class PublicOrderController {
  constructor(private readonly publicOrderService: PublicOrderService) {}

  /**
   * 媛寃??뺣낫 議고쉶
   * GET /public/branches/:branchId
   */
  @Get('branches/:branchId')
  async getBranch(@Param('branchId') branchId: string) {
    return this.publicOrderService.getBranch(branchId);
  }

  /**
   * 媛寃??뺣낫 議고쉶 (slug)
   * GET /public/branches/slug/:slug
   */
  @Get('branches/slug/:slug')
  async getBranchBySlug(@Param('slug') slug: string) {
    return this.publicOrderService.getBranchBySlug(slug);
  }

  /**
   * 가게 정보 조회 (brand slug + branch slug)
   * GET /public/brands/:brandSlug/branches/:branchSlug
   */
  @Get('brands/:brandSlug/branches/:branchSlug')
  async getBranchByBrandSlug(
    @Param('brandSlug') brandSlug: string,
    @Param('branchSlug') branchSlug: string,
  ) {
    return this.publicOrderService.getBranchByBrandSlug(brandSlug, branchSlug);
  }
  /**
   * 媛寃??곹뭹 紐⑸줉 議고쉶
   * GET /public/branches/:branchId/products
   */
  @Get('branches/:branchId/products')
  async getProducts(@Param('branchId') branchId: string) {
    return this.publicOrderService.getProducts(branchId);
  }

  /**
   * 二쇰Ц ?앹꽦
   * POST /public/orders
   */
  @Post('orders')
  async createOrder(@Body() dto: CreatePublicOrderRequest) {
    return this.publicOrderService.createOrder(dto);
  }

  /**
   * 二쇰Ц 議고쉶 (ID ?먮뒗 二쇰Ц踰덊샇)
   * GET /public/orders/:orderIdOrNo
   */
  @Get('orders/:orderIdOrNo')
  async getOrder(@Param('orderIdOrNo') orderIdOrNo: string) {
    return this.publicOrderService.getOrder(orderIdOrNo);
  }
}
