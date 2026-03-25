import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PublicOrderService } from './public-order.service';
import { CreatePublicOrderRequest } from './dto/public-order.dto';
import { CreatePublicShopOrderRequest } from './dto/public-shop.dto';
import { UserRateLimit } from '../../common/decorators/user-rate-limit.decorator';
import { UserRateLimitGuard } from '../../common/guards/user-rate-limit.guard';
import { StampsService } from '../stamps/stamps.service';

@ApiTags('public-order')
@Controller('public')
export class PublicOrderController {
  constructor(
    private readonly publicOrderService: PublicOrderService,
    private readonly stampsService: StampsService,
  ) {}
  /**
   * Public brand list
   * GET /public/brands
   */
  @Get('brands')
  @ApiOperation({ summary: '공개 브랜드 목록 조회' })
  @ApiResponse({ status: 200, description: '브랜드 목록 조회 성공' })
  async getBrands() {
    return this.publicOrderService.getBrands();
  }

  @Get('shop/brands/:brandSlug')
  @ApiOperation({ summary: '브랜드 온라인샵 정보 조회' })
  @ApiResponse({ status: 200, description: '온라인샵 정보 조회 성공' })
  async getShopBrand(@Param('brandSlug') brandSlug: string) {
    return this.publicOrderService.getShopBrandBySlug(brandSlug);
  }

  @Post('shop/brands/:brandSlug/orders')
  @UseGuards(UserRateLimitGuard)
  @UserRateLimit({ points: 10, duration: 60, blockDuration: 300 })
  @ApiOperation({ summary: '브랜드 온라인샵 주문 생성' })
  @ApiResponse({ status: 201, description: '온라인샵 주문 생성 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiResponse({ status: 429, description: '요청 제한 초과' })
  async createShopOrder(
    @Param('brandSlug') brandSlug: string,
    @Body() dto: CreatePublicShopOrderRequest,
  ) {
    return this.publicOrderService.createShopOrderByBrandSlug(brandSlug, dto);
  }

  /**
   * 媛寃??뺣낫 議고쉶
   * GET /public/branches/:branchId
   */
  @Get('branches/:branchId')
  @ApiOperation({ summary: '媛寃??뺣낫 議고쉶 (ID)' })
  @ApiResponse({ status: 200, description: '媛寃??뺣낫 議고쉶 ?깃났' })
  @ApiResponse({ status: 404, description: '媛寃뚮? 李얠쓣 ???놁쓬' })
  async getBranch(@Param('branchId') branchId: string) {
    return this.publicOrderService.getBranch(branchId);
  }

  /**
   * Backward-compatible route
   * GET /public/branch/:branchId
   */
  @Get('branch/:branchId')
  @ApiOperation({ summary: '媛寃??뺣낫 議고쉶 (ID, legacy)' })
  @ApiResponse({ status: 200, description: '媛寃??뺣낫 議고쉶 ?깃났' })
  @ApiResponse({ status: 404, description: '媛寃뚮? 李얠쓣 ???놁쓬' })
  async getBranchLegacy(@Param('branchId') branchId: string) {
    return this.publicOrderService.getBranch(branchId);
  }

  /**
   * 媛寃??뺣낫 議고쉶 (slug)
   * GET /public/branches/slug/:slug
   */
  @Get('branches/slug/:slug')
  @ApiOperation({ summary: '媛寃??뺣낫 議고쉶 (slug)' })
  @ApiResponse({ status: 200, description: '媛寃??뺣낫 議고쉶 ?깃났' })
  @ApiResponse({ status: 404, description: '媛寃뚮? 李얠쓣 ???놁쓬' })
  async getBranchBySlug(@Param('slug') slug: string) {
    return this.publicOrderService.getBranchBySlug(slug);
  }

  /**
   * 媛寃??뺣낫 議고쉶 (brand slug + branch slug)
   * GET /public/brands/:brandSlug/branches/:branchSlug
   */
  @Get('brands/:brandSlug/branches/:branchSlug')
  @ApiOperation({ summary: '媛寃??뺣낫 議고쉶 (釉뚮옖??slug + 吏??slug)' })
  @ApiResponse({ status: 200, description: '媛寃??뺣낫 議고쉶 ?깃났' })
  @ApiResponse({ status: 404, description: '媛寃뚮? 李얠쓣 ???놁쓬' })
  async getBranchByBrandSlug(
    @Param('brandSlug') brandSlug: string,
    @Param('branchSlug') branchSlug: string,
  ) {
    return this.publicOrderService.getBranchByBrandSlug(brandSlug, branchSlug);
  }

  /**
   * 釉뚮옖??湲곗? 媛寃?紐⑸줉 議고쉶
   * GET /public/brands/:brandSlug/branches
   */
  @Get('brands/:brandSlug/branches')
  @ApiOperation({ summary: '釉뚮옖??湲곗? 媛寃?紐⑸줉 議고쉶' })
  @ApiResponse({ status: 200, description: '媛寃?紐⑸줉 議고쉶 ?깃났' })
  async getBranchesByBrandSlug(@Param('brandSlug') brandSlug: string) {
    return this.publicOrderService.getBranchesByBrandSlug(brandSlug);
  }

  /**
   * 媛寃?移댄뀒怨좊━ 紐⑸줉 議고쉶
   * GET /public/branches/:branchId/categories
   */
  @Get('branches/:branchId/categories')
  @ApiOperation({ summary: '媛寃?移댄뀒怨좊━ 紐⑸줉 議고쉶' })
  @ApiResponse({ status: 200, description: '移댄뀒怨좊━ 紐⑸줉 議고쉶 ?깃났' })
  async getCategories(@Param('branchId') branchId: string) {
    return this.publicOrderService.getCategories(branchId);
  }

  /**
   * 媛寃??곹뭹 紐⑸줉 議고쉶
   * GET /public/branches/:branchId/products
   */
  @Get('branches/:branchId/products')
  @ApiOperation({ summary: '媛寃??곹뭹 紐⑸줉 議고쉶' })
  @ApiResponse({ status: 200, description: '?곹뭹 紐⑸줉 議고쉶 ?깃났' })
  async getProducts(@Param('branchId') branchId: string) {
    return this.publicOrderService.getProducts(branchId);
  }

  /**
   * Backward-compatible route
   * GET /public/branch/:branchId/products
   */
  @Get('branch/:branchId/products')
  @ApiOperation({ summary: '媛寃??곹뭹 紐⑸줉 議고쉶 (legacy)' })
  @ApiResponse({ status: 200, description: '?곹뭹 紐⑸줉 議고쉶 ?깃났' })
  async getProductsLegacy(@Param('branchId') branchId: string) {
    return this.publicOrderService.getProducts(branchId);
  }

  /**
   * 二쇰Ц ?앹꽦
   * POST /public/orders
   * Rate limit: 10 orders per minute (to prevent order spam)
   */
  @Get('branch/:branchId/stamp-info')
  @UserRateLimit({ points: 30, duration: 60 })
  @ApiOperation({ summary: '공개 스탬프 적립 정보 조회' })
  @ApiResponse({ status: 200, description: '스탬프 정보 조회 성공' })
  async getStampInfo(
    @Param('branchId') branchId: string,
    @Query('phone') phone: string,
  ) {
    return this.stampsService.getPublicStampInfo(branchId, phone ?? '');
  }

  @Post('orders')
  @UseGuards(UserRateLimitGuard)
  @UserRateLimit({ points: 10, duration: 60, blockDuration: 300 })
  @ApiOperation({ summary: '怨듦컻 二쇰Ц ?앹꽦' })
  @ApiResponse({ status: 201, description: '二쇰Ц ?앹꽦 ?깃났' })
  @ApiResponse({ status: 400, description: '?섎せ???붿껌' })
  @ApiResponse({ status: 429, description: '?붿껌 ?쒗븳 珥덇낵' })
  async createOrder(@Body() dto: CreatePublicOrderRequest) {
    return this.publicOrderService.createOrder(dto);
  }

  /**
   * 二쇰Ц 議고쉶 (ID ?먮뒗 二쇰Ц踰덊샇)
   * GET /public/orders/:orderIdOrNo
   */
  @Get('orders/:orderIdOrNo')
  @ApiOperation({ summary: '二쇰Ц 議고쉶 (ID ?먮뒗 二쇰Ц踰덊샇)' })
  @ApiResponse({ status: 200, description: '二쇰Ц 議고쉶 ?깃났' })
  @ApiResponse({ status: 404, description: '二쇰Ц??李얠쓣 ???놁쓬' })
  async getOrder(@Param('orderIdOrNo') orderIdOrNo: string) {
    return this.publicOrderService.getOrder(orderIdOrNo);
  }
}
