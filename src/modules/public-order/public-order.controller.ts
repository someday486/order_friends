import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PublicOrderService } from './public-order.service';
import { CreatePublicOrderRequest } from './dto/public-order.dto';
import { UserRateLimit } from '../../common/decorators/user-rate-limit.decorator';
import { UserRateLimitGuard } from '../../common/guards/user-rate-limit.guard';

@ApiTags('public-order')
@Controller('public')
export class PublicOrderController {
  constructor(private readonly publicOrderService: PublicOrderService) {}

  /**
   * 가게 정보 조회
   * GET /public/branches/:branchId
   */
  @Get('branches/:branchId')
  @ApiOperation({ summary: '가게 정보 조회 (ID)' })
  @ApiResponse({ status: 200, description: '가게 정보 조회 성공' })
  @ApiResponse({ status: 404, description: '가게를 찾을 수 없음' })
  async getBranch(@Param('branchId') branchId: string) {
    return this.publicOrderService.getBranch(branchId);
  }

  /**
   * Backward-compatible route
   * GET /public/branch/:branchId
   */
  @Get('branch/:branchId')
  @ApiOperation({ summary: '가게 정보 조회 (ID, legacy)' })
  @ApiResponse({ status: 200, description: '가게 정보 조회 성공' })
  @ApiResponse({ status: 404, description: '가게를 찾을 수 없음' })
  async getBranchLegacy(@Param('branchId') branchId: string) {
    return this.publicOrderService.getBranch(branchId);
  }

  /**
   * 가게 정보 조회 (slug)
   * GET /public/branches/slug/:slug
   */
  @Get('branches/slug/:slug')
  @ApiOperation({ summary: '가게 정보 조회 (slug)' })
  @ApiResponse({ status: 200, description: '가게 정보 조회 성공' })
  @ApiResponse({ status: 404, description: '가게를 찾을 수 없음' })
  async getBranchBySlug(@Param('slug') slug: string) {
    return this.publicOrderService.getBranchBySlug(slug);
  }

  /**
   * 가게 정보 조회 (brand slug + branch slug)
   * GET /public/brands/:brandSlug/branches/:branchSlug
   */
  @Get('brands/:brandSlug/branches/:branchSlug')
  @ApiOperation({ summary: '가게 정보 조회 (브랜드 slug + 지점 slug)' })
  @ApiResponse({ status: 200, description: '가게 정보 조회 성공' })
  @ApiResponse({ status: 404, description: '가게를 찾을 수 없음' })
  async getBranchByBrandSlug(
    @Param('brandSlug') brandSlug: string,
    @Param('branchSlug') branchSlug: string,
  ) {
    return this.publicOrderService.getBranchByBrandSlug(brandSlug, branchSlug);
  }

  /**
   * 브랜드 기준 가게 목록 조회
   * GET /public/brands/:brandSlug/branches
   */
  @Get('brands/:brandSlug/branches')
  @ApiOperation({ summary: '브랜드 기준 가게 목록 조회' })
  @ApiResponse({ status: 200, description: '가게 목록 조회 성공' })
  async getBranchesByBrandSlug(@Param('brandSlug') brandSlug: string) {
    return this.publicOrderService.getBranchesByBrandSlug(brandSlug);
  }

  /**
   * 가게 카테고리 목록 조회
   * GET /public/branches/:branchId/categories
   */
  @Get('branches/:branchId/categories')
  @ApiOperation({ summary: '가게 카테고리 목록 조회' })
  @ApiResponse({ status: 200, description: '카테고리 목록 조회 성공' })
  async getCategories(@Param('branchId') branchId: string) {
    return this.publicOrderService.getCategories(branchId);
  }

  /**
   * 가게 상품 목록 조회
   * GET /public/branches/:branchId/products
   */
  @Get('branches/:branchId/products')
  @ApiOperation({ summary: '가게 상품 목록 조회' })
  @ApiResponse({ status: 200, description: '상품 목록 조회 성공' })
  async getProducts(@Param('branchId') branchId: string) {
    return this.publicOrderService.getProducts(branchId);
  }

  /**
   * Backward-compatible route
   * GET /public/branch/:branchId/products
   */
  @Get('branch/:branchId/products')
  @ApiOperation({ summary: '가게 상품 목록 조회 (legacy)' })
  @ApiResponse({ status: 200, description: '상품 목록 조회 성공' })
  async getProductsLegacy(@Param('branchId') branchId: string) {
    return this.publicOrderService.getProducts(branchId);
  }

  /**
   * 주문 생성
   * POST /public/orders
   * Rate limit: 10 orders per minute (to prevent order spam)
   */
  @Post('orders')
  @UseGuards(UserRateLimitGuard)
  @UserRateLimit({ points: 10, duration: 60, blockDuration: 300 })
  @ApiOperation({ summary: '공개 주문 생성' })
  @ApiResponse({ status: 201, description: '주문 생성 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiResponse({ status: 429, description: '요청 제한 초과' })
  async createOrder(@Body() dto: CreatePublicOrderRequest) {
    return this.publicOrderService.createOrder(dto);
  }

  /**
   * 주문 조회 (ID 또는 주문번호)
   * GET /public/orders/:orderIdOrNo
   */
  @Get('orders/:orderIdOrNo')
  @ApiOperation({ summary: '주문 조회 (ID 또는 주문번호)' })
  @ApiResponse({ status: 200, description: '주문 조회 성공' })
  @ApiResponse({ status: 404, description: '주문을 찾을 수 없음' })
  async getOrder(@Param('orderIdOrNo') orderIdOrNo: string) {
    return this.publicOrderService.getOrder(orderIdOrNo);
  }
}
