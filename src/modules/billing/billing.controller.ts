import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AuthGuard } from '../../common/guards/auth.guard';
import type { AuthRequest } from '../../common/types/auth-request';
import { BillingService } from './billing.service';
import {
  AdminBillingRecordQueryDto,
  AdminExtendSubscriptionRequest,
  AdminSubscriptionQueryDto,
  AdminUpdateSubscriptionStatusRequest,
  BillingKeyResponse,
  BillingRecordQueryDto,
  BillingRecordResponse,
  DeleteBillingKeyRequest,
  IssueBillingKeyRequest,
  RetryBillingRequest,
  UpdateBillingKeyRequest,
} from './dto/billing.dto';
import {
  BillingSummaryQueryDto,
  BillingSummaryResponse,
  CancelSubscriptionRequest,
  SubscriptionQueryDto,
  SubscriptionResponse,
} from './dto/subscription.dto';

@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('billing-key')
  @ApiOperation({ summary: '빌링키 발급' })
  @ApiResponse({ status: 201, type: BillingKeyResponse })
  issueBillingKey(
    @Req() req: AuthRequest,
    @Body() dto: IssueBillingKeyRequest,
  ): Promise<BillingKeyResponse> {
    return this.billingService.issueBillingKey(
      req.user?.id ?? '',
      dto,
      Boolean(req.isAdmin),
    );
  }

  @Put('billing-key')
  @ApiOperation({ summary: '빌링키 교체' })
  @ApiResponse({ status: 200, type: BillingKeyResponse })
  replaceBillingKey(
    @Req() req: AuthRequest,
    @Body() dto: UpdateBillingKeyRequest,
  ): Promise<BillingKeyResponse> {
    return this.billingService.replaceBillingKey(
      req.user?.id ?? '',
      dto,
      Boolean(req.isAdmin),
    );
  }

  @Delete('billing-key')
  @ApiOperation({ summary: '빌링키 삭제' })
  deleteBillingKey(
    @Req() req: AuthRequest,
    @Body() dto: DeleteBillingKeyRequest,
  ): Promise<{ success: true }> {
    return this.billingService.deleteBillingKey(
      req.user?.id ?? '',
      dto,
      Boolean(req.isAdmin),
    );
  }

  @Get('subscription')
  @ApiOperation({ summary: '현재 구독 상태 조회' })
  @ApiResponse({ status: 200, type: SubscriptionResponse })
  getSubscription(
    @Req() req: AuthRequest,
    @Query() query: SubscriptionQueryDto,
  ): Promise<SubscriptionResponse> {
    return this.billingService.getSubscription(
      req.user?.id ?? '',
      query,
      Boolean(req.isAdmin),
    );
  }

  @Get('records')
  @ApiOperation({ summary: '빌링 이력 조회' })
  @ApiResponse({ status: 200, type: BillingRecordResponse, isArray: true })
  getBillingRecords(
    @Req() req: AuthRequest,
    @Query() query: BillingRecordQueryDto,
  ): Promise<BillingRecordResponse[]> {
    return this.billingService.getBillingRecords(
      req.user?.id ?? '',
      query,
      Boolean(req.isAdmin),
    );
  }

  @Get('summary')
  @ApiOperation({ summary: '빌링 요약 조회' })
  @ApiResponse({ status: 200, type: BillingSummaryResponse })
  getBillingSummary(
    @Req() req: AuthRequest,
    @Query() query: BillingSummaryQueryDto,
  ): Promise<BillingSummaryResponse> {
    return this.billingService.getBillingSummary(
      req.user?.id ?? '',
      query,
      Boolean(req.isAdmin),
    );
  }

  @Put('subscription/cancel')
  @ApiOperation({ summary: '구독 해지 요청' })
  @ApiResponse({ status: 200, type: SubscriptionResponse })
  cancelSubscription(
    @Req() req: AuthRequest,
    @Body() dto: CancelSubscriptionRequest,
  ): Promise<SubscriptionResponse> {
    return this.billingService.cancelSubscription(
      req.user?.id ?? '',
      dto,
      Boolean(req.isAdmin),
    );
  }
}

@ApiTags('admin-billing')
@ApiBearerAuth()
@UseGuards(AuthGuard, AdminGuard)
@Controller('admin/billing')
export class BillingAdminController {
  constructor(private readonly billingService: BillingService) {}

  @Post('retry')
  @ApiOperation({ summary: '실패한 빌링 수동 재시도' })
  retryBilling(@Body() dto: RetryBillingRequest): Promise<{ success: true }> {
    return this.billingService.retryBilling(dto);
  }

  @Get('subscriptions')
  @ApiOperation({ summary: '전체 구독 목록 조회' })
  @ApiResponse({ status: 200, type: SubscriptionResponse, isArray: true })
  listSubscriptions(
    @Query() query: AdminSubscriptionQueryDto,
  ): Promise<SubscriptionResponse[]> {
    return this.billingService.listSubscriptions(query);
  }

  @Get('subscriptions/:brandId')
  @ApiParam({ name: 'brandId', description: '브랜드 ID' })
  @ApiOperation({ summary: '특정 브랜드 구독 상세' })
  @ApiResponse({ status: 200, type: SubscriptionResponse })
  getSubscription(
    @Param('brandId') brandId: string,
  ): Promise<SubscriptionResponse> {
    return this.billingService.getAdminSubscription(brandId);
  }

  @Put('subscriptions/:brandId/status')
  @ApiParam({ name: 'brandId', description: '브랜드 ID' })
  @ApiOperation({ summary: '구독 상태 수동 변경' })
  updateStatus(
    @Param('brandId') brandId: string,
    @Body() dto: AdminUpdateSubscriptionStatusRequest,
  ): Promise<SubscriptionResponse> {
    return this.billingService.updateSubscriptionStatus(brandId, dto);
  }

  @Put('subscriptions/:brandId/extend')
  @ApiParam({ name: 'brandId', description: '브랜드 ID' })
  @ApiOperation({ summary: '유예 기간 연장' })
  extendSubscription(
    @Param('brandId') brandId: string,
    @Body() dto: AdminExtendSubscriptionRequest,
  ): Promise<SubscriptionResponse> {
    return this.billingService.extendSubscription(brandId, dto);
  }

  @Get('records')
  @ApiOperation({ summary: '전체 빌링 이력 조회' })
  @ApiResponse({ status: 200, type: BillingRecordResponse, isArray: true })
  getRecords(
    @Query() query: AdminBillingRecordQueryDto,
  ): Promise<BillingRecordResponse[]> {
    return this.billingService.listAllBillingRecords(query);
  }
}
