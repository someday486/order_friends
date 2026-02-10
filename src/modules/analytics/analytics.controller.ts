import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CustomerGuard } from '../../common/guards/customer.guard';
import type { AuthRequest } from '../../common/types/auth-request';
import { AnalyticsService } from './analytics.service';
import {
  SalesAnalyticsResponse,
  ProductAnalyticsResponse,
  OrderAnalyticsResponse,
  CustomerAnalyticsResponse,
  AnalyticsQueryDto,
  PeriodComparisonDto,
  BrandSalesAnalyticsResponse,
} from './dto/analytics.dto';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(AuthGuard, CustomerGuard)
@Controller('customer/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('sales')
  @ApiOperation({
    summary: '매출 분석 조회',
    description: '지정된 기간 동안의 매출 통계와 일별 매출 추이를 조회합니다.',
  })
  @ApiQuery({
    name: 'branchId',
    description: '지점 ID',
    required: true,
    type: String,
  })
  @ApiQuery({
    name: 'startDate',
    description: '시작 날짜 (ISO 8601 형식, 예: 2026-01-01)',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'endDate',
    description: '종료 날짜 (ISO 8601 형식, 예: 2026-01-31)',
    required: false,
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: '매출 분석 조회 성공',
    type: SalesAnalyticsResponse,
  })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async getSalesAnalytics(
    @Req() req: AuthRequest,
    @Query('branchId') branchId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<SalesAnalyticsResponse> {
    if (!req.accessToken) {
      throw new BadRequestException('Missing access token');
    }
    if (!branchId) {
      throw new BadRequestException('branchId is required');
    }

    return this.analyticsService.getSalesAnalytics(
      req.accessToken,
      branchId,
      startDate,
      endDate,
    );
  }

  @Get('products')
  @ApiOperation({
    summary: '상품 분석 조회',
    description: '상품별 판매 실적, 인기 상품, 재고 회전율 등을 조회합니다.',
  })
  @ApiQuery({
    name: 'branchId',
    description: '지점 ID',
    required: true,
    type: String,
  })
  @ApiQuery({
    name: 'startDate',
    description: '시작 날짜 (ISO 8601 형식, 예: 2026-01-01)',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'endDate',
    description: '종료 날짜 (ISO 8601 형식, 예: 2026-01-31)',
    required: false,
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: '상품 분석 조회 성공',
    type: ProductAnalyticsResponse,
  })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async getProductAnalytics(
    @Req() req: AuthRequest,
    @Query('branchId') branchId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<ProductAnalyticsResponse> {
    if (!req.accessToken) {
      throw new BadRequestException('Missing access token');
    }
    if (!branchId) {
      throw new BadRequestException('branchId is required');
    }

    return this.analyticsService.getProductAnalytics(
      req.accessToken,
      branchId,
      startDate,
      endDate,
    );
  }

  @Get('orders')
  @ApiOperation({
    summary: '주문 통계 조회',
    description: '주문 상태 분포, 일별/시간대별 주문 추이를 조회합니다.',
  })
  @ApiQuery({
    name: 'branchId',
    description: '지점 ID',
    required: true,
    type: String,
  })
  @ApiQuery({
    name: 'startDate',
    description: '시작 날짜 (ISO 8601 형식, 예: 2026-01-01)',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'endDate',
    description: '종료 날짜 (ISO 8601 형식, 예: 2026-01-31)',
    required: false,
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: '주문 통계 조회 성공',
    type: OrderAnalyticsResponse,
  })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async getOrderAnalytics(
    @Req() req: AuthRequest,
    @Query('branchId') branchId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<OrderAnalyticsResponse> {
    if (!req.accessToken) {
      throw new BadRequestException('Missing access token');
    }
    if (!branchId) {
      throw new BadRequestException('branchId is required');
    }

    return this.analyticsService.getOrderAnalytics(
      req.accessToken,
      branchId,
      startDate,
      endDate,
    );
  }

  @Get('customers')
  @ApiOperation({
    summary: '고객 분석 조회',
    description: '신규/재구매 고객 수, 고객 생애 가치(CLV) 등을 조회합니다.',
  })
  @ApiQuery({
    name: 'branchId',
    description: '지점 ID',
    required: true,
    type: String,
  })
  @ApiQuery({
    name: 'startDate',
    description:
      '시작 날짜 (ISO 8601 형식, 예: 2026-01-01) - 신규 고객 집계에 사용',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'endDate',
    description:
      '종료 날짜 (ISO 8601 형식, 예: 2026-01-31) - 신규 고객 집계에 사용',
    required: false,
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: '고객 분석 조회 성공',
    type: CustomerAnalyticsResponse,
  })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async getCustomerAnalytics(
    @Req() req: AuthRequest,
    @Query('branchId') branchId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<CustomerAnalyticsResponse> {
    if (!req.accessToken) {
      throw new BadRequestException('Missing access token');
    }
    if (!branchId) {
      throw new BadRequestException('branchId is required');
    }

    return this.analyticsService.getCustomerAnalytics(
      req.accessToken,
      branchId,
      startDate,
      endDate,
    );
  }

  // ============================================================
  // Brand-level analytics endpoints
  // ============================================================

  private validateBrandAccess(req: AuthRequest, brandId: string): void {
    const memberships = req.brandMemberships || [];
    const hasAccess = memberships.some((m: any) => m.brand_id === brandId);
    if (!hasAccess) {
      throw new ForbiddenException('No access to this brand');
    }
  }

  @Get('brand/sales')
  @ApiOperation({
    summary: '브랜드 전체 매출 분석 조회',
    description:
      '브랜드 소속 전체 지점의 매출을 집계합니다. 지점별 비교 데이터를 포함합니다.',
  })
  @ApiQuery({
    name: 'brandId',
    description: '브랜드 ID',
    required: true,
    type: String,
  })
  @ApiQuery({
    name: 'startDate',
    description: '시작 날짜 (ISO 8601)',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'endDate',
    description: '종료 날짜 (ISO 8601)',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'compare',
    description: '이전 기간 비교',
    required: false,
    type: Boolean,
  })
  @ApiResponse({ status: 200, description: '브랜드 매출 분석 조회 성공' })
  async getBrandSalesAnalytics(
    @Req() req: AuthRequest,
    @Query('brandId') brandId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('compare') compare?: string,
  ): Promise<PeriodComparisonDto<BrandSalesAnalyticsResponse>> {
    if (!req.accessToken) throw new BadRequestException('Missing access token');
    if (!brandId) throw new BadRequestException('brandId is required');
    this.validateBrandAccess(req, brandId);

    return this.analyticsService.getBrandSalesAnalytics(
      req.accessToken,
      brandId,
      startDate,
      endDate,
      compare === 'true',
    );
  }

  @Get('brand/products')
  @ApiOperation({
    summary: '브랜드 전체 상품 분석 조회',
    description: '브랜드 소속 전체 지점의 상품별 판매 실적을 집계합니다.',
  })
  @ApiQuery({
    name: 'brandId',
    description: '브랜드 ID',
    required: true,
    type: String,
  })
  @ApiQuery({
    name: 'startDate',
    description: '시작 날짜 (ISO 8601)',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'endDate',
    description: '종료 날짜 (ISO 8601)',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'compare',
    description: '이전 기간 비교',
    required: false,
    type: Boolean,
  })
  @ApiResponse({ status: 200, description: '브랜드 상품 분석 조회 성공' })
  async getBrandProductAnalytics(
    @Req() req: AuthRequest,
    @Query('brandId') brandId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('compare') compare?: string,
  ): Promise<PeriodComparisonDto<ProductAnalyticsResponse>> {
    if (!req.accessToken) throw new BadRequestException('Missing access token');
    if (!brandId) throw new BadRequestException('brandId is required');
    this.validateBrandAccess(req, brandId);

    return this.analyticsService.getBrandProductAnalytics(
      req.accessToken,
      brandId,
      startDate,
      endDate,
      compare === 'true',
    );
  }

  @Get('brand/orders')
  @ApiOperation({
    summary: '브랜드 전체 주문 통계 조회',
    description: '브랜드 소속 전체 지점의 주문 상태 분포, 추이를 집계합니다.',
  })
  @ApiQuery({
    name: 'brandId',
    description: '브랜드 ID',
    required: true,
    type: String,
  })
  @ApiQuery({
    name: 'startDate',
    description: '시작 날짜 (ISO 8601)',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'endDate',
    description: '종료 날짜 (ISO 8601)',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'compare',
    description: '이전 기간 비교',
    required: false,
    type: Boolean,
  })
  @ApiResponse({ status: 200, description: '브랜드 주문 통계 조회 성공' })
  async getBrandOrderAnalytics(
    @Req() req: AuthRequest,
    @Query('brandId') brandId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('compare') compare?: string,
  ): Promise<PeriodComparisonDto<OrderAnalyticsResponse>> {
    if (!req.accessToken) throw new BadRequestException('Missing access token');
    if (!brandId) throw new BadRequestException('brandId is required');
    this.validateBrandAccess(req, brandId);

    return this.analyticsService.getBrandOrderAnalytics(
      req.accessToken,
      brandId,
      startDate,
      endDate,
      compare === 'true',
    );
  }

  @Get('brand/customers')
  @ApiOperation({
    summary: '브랜드 전체 고객 분석 조회',
    description: '브랜드 소속 전체 지점의 고객 분석을 집계합니다.',
  })
  @ApiQuery({
    name: 'brandId',
    description: '브랜드 ID',
    required: true,
    type: String,
  })
  @ApiQuery({
    name: 'startDate',
    description: '시작 날짜 (ISO 8601)',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'endDate',
    description: '종료 날짜 (ISO 8601)',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'compare',
    description: '이전 기간 비교',
    required: false,
    type: Boolean,
  })
  @ApiResponse({ status: 200, description: '브랜드 고객 분석 조회 성공' })
  async getBrandCustomerAnalytics(
    @Req() req: AuthRequest,
    @Query('brandId') brandId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('compare') compare?: string,
  ): Promise<PeriodComparisonDto<CustomerAnalyticsResponse>> {
    if (!req.accessToken) throw new BadRequestException('Missing access token');
    if (!brandId) throw new BadRequestException('brandId is required');
    this.validateBrandAccess(req, brandId);

    return this.analyticsService.getBrandCustomerAnalytics(
      req.accessToken,
      brandId,
      startDate,
      endDate,
      compare === 'true',
    );
  }
}
