import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CustomerGuard } from '../../common/guards/customer.guard';
import type { AuthRequest } from '../../common/types/auth-request';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Permission } from '../../modules/auth/authorization/permissions';
import {
  PreparePaymentRequest,
  PreparePaymentResponse,
  ConfirmPaymentRequest,
  ConfirmPaymentResponse,
  PaymentStatusResponse,
  PaymentListItemResponse,
  PaymentDetailResponse,
  RefundPaymentRequest,
  RefundPaymentResponse,
  TossWebhookRequest,
} from './dto/payment.dto';
import {
  PaginationDto,
  PaginatedResponse,
} from '../../common/dto/pagination.dto';

// ============================================================
// Public Payment Endpoints (no auth required)
// ============================================================

@ApiTags('payments-public')
@Controller('payments')
export class PaymentsPublicController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('prepare')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '결제 준비',
    description: '주문 검증 및 결제 정보를 반환합니다. (인증 불필요)',
  })
  @ApiBody({ type: PreparePaymentRequest })
  @ApiResponse({
    status: 200,
    description: '결제 준비 성공',
    type: PreparePaymentResponse,
  })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiResponse({ status: 404, description: '주문을 찾을 수 없음' })
  @ApiResponse({ status: 409, description: '이미 결제된 주문' })
  async preparePayment(
    @Body() dto: PreparePaymentRequest,
  ): Promise<PreparePaymentResponse> {
    return this.paymentsService.preparePayment(dto);
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '결제 확정',
    description: 'Toss Payments 승인 및 결제 완료 처리 (인증 불필요)',
  })
  @ApiBody({ type: ConfirmPaymentRequest })
  @ApiResponse({
    status: 200,
    description: '결제 확정 성공',
    type: ConfirmPaymentResponse,
  })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiResponse({ status: 404, description: '주문을 찾을 수 없음' })
  @ApiResponse({ status: 502, description: '결제 승인 실패' })
  async confirmPayment(
    @Body() dto: ConfirmPaymentRequest,
  ): Promise<ConfirmPaymentResponse> {
    return this.paymentsService.confirmPayment(dto);
  }

  @Get(':orderId/status')
  @ApiOperation({
    summary: '결제 상태 조회',
    description: '주문 결제 상태를 조회합니다. (인증 불필요)',
  })
  @ApiParam({ name: 'orderId', description: '주문 ID 또는 주문 번호' })
  @ApiResponse({
    status: 200,
    description: '결제 상태 조회 성공',
    type: PaymentStatusResponse,
  })
  @ApiResponse({ status: 404, description: '결제 정보를 찾을 수 없음' })
  async getPaymentStatus(
    @Param('orderId') orderId: string,
  ): Promise<PaymentStatusResponse> {
    return this.paymentsService.getPaymentStatus(orderId);
  }

  @Post('webhook/toss')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Toss Payments 웹훅',
    description: 'Toss Payments 웹훅 이벤트를 처리합니다.',
  })
  @ApiBody({ type: TossWebhookRequest })
  @ApiResponse({ status: 200, description: '웹훅 처리 성공' })
  @ApiResponse({ status: 401, description: '서명 검증 실패' })
  async handleTossWebhook(
    @Body() webhookData: TossWebhookRequest,
    @Headers() headers: Record<string, string>,
    @Req() req: any,
  ): Promise<{ success: boolean }> {
    await this.paymentsService.handleTossWebhook(
      webhookData,
      headers,
      req?.rawBody,
    );
    return { success: true };
  }
}

// ============================================================
// Customer Payment Endpoints (with CustomerGuard)
// ============================================================

@ApiTags('payments-customer')
@ApiBearerAuth()
@UseGuards(CustomerGuard)
@Controller('customer/payments')
export class PaymentsCustomerController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @ApiOperation({
    summary: '결제 목록 조회',
    description: '지점의 결제 목록을 조회합니다. (인증 필요)',
  })
  @ApiQuery({ name: 'branchId', description: '지점 ID', required: true })
  @ApiQuery({ name: 'page', description: '페이지 번호', required: false })
  @ApiQuery({ name: 'limit', description: '페이지 크기', required: false })
  @ApiResponse({
    status: 200,
    description: '결제 목록 조회 성공',
    type: PaymentListItemResponse,
    isArray: true,
  })
  @ApiResponse({ status: 401, description: '인증 필요' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async getPayments(
    @Query('branchId') branchId: string,
    @Query() paginationDto: PaginationDto,
  ): Promise<PaginatedResponse<PaymentListItemResponse>> {
    return this.paymentsService.getPayments(branchId, paginationDto);
  }

  @Get(':paymentId')
  @ApiOperation({
    summary: '결제 상세 조회',
    description: '특정 결제의 상세 정보를 조회합니다. (인증 필요)',
  })
  @ApiParam({ name: 'paymentId', description: '결제 ID' })
  @ApiQuery({ name: 'branchId', description: '지점 ID', required: true })
  @ApiResponse({
    status: 200,
    description: '결제 상세 조회 성공',
    type: PaymentDetailResponse,
  })
  @ApiResponse({ status: 401, description: '인증 필요' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  @ApiResponse({ status: 404, description: '결제 정보를 찾을 수 없음' })
  async getPaymentDetail(
    @Param('paymentId') paymentId: string,
    @Query('branchId') branchId: string,
  ): Promise<PaymentDetailResponse> {
    return this.paymentsService.getPaymentDetail(paymentId, branchId);
  }

  @Post(':paymentId/refund')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ORDER_UPDATE_STATUS) // OWNER/ADMIN only
  @ApiOperation({
    summary: '결제 환불',
    description: '결제 환불 처리 (OWNER/ADMIN만 가능)',
  })
  @ApiParam({ name: 'paymentId', description: '결제 ID' })
  @ApiQuery({ name: 'branchId', description: '지점 ID', required: true })
  @ApiBody({ type: RefundPaymentRequest })
  @ApiResponse({
    status: 200,
    description: '환불 처리 성공',
    type: RefundPaymentResponse,
  })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiResponse({ status: 401, description: '인증 필요' })
  @ApiResponse({ status: 403, description: '권한 없음 - OWNER/ADMIN만 가능' })
  @ApiResponse({ status: 404, description: '결제 정보를 찾을 수 없음' })
  async refundPayment(
    @Param('paymentId') paymentId: string,
    @Query('branchId') branchId: string,
    @Body() dto: RefundPaymentRequest,
    @Req() req: AuthRequest,
  ): Promise<RefundPaymentResponse> {
    return this.paymentsService.refundPayment(paymentId, branchId, dto);
  }
}
