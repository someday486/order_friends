import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam, ApiResponse, ApiBody } from '@nestjs/swagger';
import type { AuthRequest } from '../../common/types/auth-request';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CustomerGuard } from '../../common/guards/customer.guard';
import { InventoryService } from './inventory.service';
import {
  UpdateInventoryRequest,
  AdjustInventoryRequest,
  InventoryListResponse,
  InventoryDetailResponse,
  InventoryAlertResponse,
  InventoryLogResponse,
} from './dto/inventory.dto';

@ApiTags('customer-inventory')
@ApiBearerAuth()
@UseGuards(AuthGuard, CustomerGuard)
@Controller('customer/inventory')
export class InventoryController {
  private readonly logger = new Logger(InventoryController.name);

  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @ApiOperation({
    summary: '지점의 재고 목록 조회',
    description: '내가 멤버로 등록된 지점의 재고 목록을 조회합니다.',
  })
  @ApiQuery({ name: 'branchId', description: '지점 ID', required: true })
  @ApiResponse({ status: 200, description: '재고 목록 조회 성공', type: [InventoryListResponse] })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async getInventoryList(
    @Req() req: AuthRequest,
    @Query('branchId') branchId: string,
  ): Promise<InventoryListResponse[]> {
    if (!req.user) throw new Error('Missing user');
    if (!branchId) {
      throw new BadRequestException('branchId is required');
    }

    this.logger.log(`User ${req.user.id} fetching inventory for branch ${branchId}`);
    return this.inventoryService.getInventoryList(
      req.user.id,
      branchId,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }

  @Get('alerts')
  @ApiOperation({
    summary: '낮은 재고 알림 조회',
    description: '재고가 임계값 이하인 상품 목록을 조회합니다.',
  })
  @ApiQuery({ name: 'branchId', description: '지점 ID', required: true })
  @ApiResponse({ status: 200, description: '낮은 재고 알림 조회 성공', type: [InventoryAlertResponse] })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async getLowStockAlerts(
    @Req() req: AuthRequest,
    @Query('branchId') branchId: string,
  ): Promise<InventoryAlertResponse[]> {
    if (!req.user) throw new Error('Missing user');
    if (!branchId) {
      throw new BadRequestException('branchId is required');
    }

    this.logger.log(`User ${req.user.id} fetching low stock alerts for branch ${branchId}`);
    return this.inventoryService.getLowStockAlerts(
      req.user.id,
      branchId,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }

  @Get('logs')
  @ApiOperation({
    summary: '재고 변경 로그 조회',
    description: '재고 변경 내역을 조회합니다.',
  })
  @ApiQuery({ name: 'branchId', description: '지점 ID', required: false })
  @ApiQuery({ name: 'productId', description: '상품 ID', required: false })
  @ApiResponse({ status: 200, description: '재고 로그 조회 성공', type: [InventoryLogResponse] })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async getInventoryLogs(
    @Req() req: AuthRequest,
    @Query('branchId') branchId?: string,
    @Query('productId') productId?: string,
  ): Promise<InventoryLogResponse[]> {
    if (!req.user) throw new Error('Missing user');

    this.logger.log(`User ${req.user.id} fetching inventory logs (branch: ${branchId}, product: ${productId})`);
    return this.inventoryService.getInventoryLogs(
      req.user.id,
      branchId,
      productId,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }

  @Get(':productId')
  @ApiOperation({
    summary: '특정 상품의 재고 조회',
    description: '특정 상품의 재고 정보를 조회합니다.',
  })
  @ApiParam({ name: 'productId', description: '상품 ID' })
  @ApiResponse({ status: 200, description: '재고 조회 성공', type: InventoryDetailResponse })
  @ApiResponse({ status: 403, description: '권한 없음' })
  @ApiResponse({ status: 404, description: '재고를 찾을 수 없음' })
  async getInventoryByProduct(
    @Req() req: AuthRequest,
    @Param('productId') productId: string,
  ): Promise<InventoryDetailResponse> {
    if (!req.user) throw new Error('Missing user');

    this.logger.log(`User ${req.user.id} fetching inventory for product ${productId}`);
    return this.inventoryService.getInventoryByProduct(
      req.user.id,
      productId,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }

  @Patch(':productId')
  @ApiOperation({
    summary: '재고 수량 업데이트',
    description: 'OWNER 또는 ADMIN만 재고 수량을 업데이트할 수 있습니다.',
  })
  @ApiParam({ name: 'productId', description: '상품 ID' })
  @ApiBody({ type: UpdateInventoryRequest })
  @ApiResponse({ status: 200, description: '재고 업데이트 성공', type: InventoryDetailResponse })
  @ApiResponse({ status: 403, description: '권한 없음 (OWNER/ADMIN만 가능)' })
  @ApiResponse({ status: 404, description: '재고를 찾을 수 없음' })
  async updateInventory(
    @Req() req: AuthRequest,
    @Param('productId') productId: string,
    @Body() dto: UpdateInventoryRequest,
  ): Promise<InventoryDetailResponse> {
    if (!req.user) throw new Error('Missing user');

    this.logger.log(`User ${req.user.id} updating inventory for product ${productId}`);
    return this.inventoryService.updateInventory(
      req.user.id,
      productId,
      dto,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }

  @Post(':productId/adjust')
  @ApiOperation({
    summary: '재고 수동 조정',
    description: 'OWNER 또는 ADMIN만 재고를 수동으로 조정할 수 있습니다. 로그에 기록됩니다.',
  })
  @ApiParam({ name: 'productId', description: '상품 ID' })
  @ApiBody({ type: AdjustInventoryRequest })
  @ApiResponse({ status: 200, description: '재고 조정 성공', type: InventoryDetailResponse })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiResponse({ status: 403, description: '권한 없음 (OWNER/ADMIN만 가능)' })
  @ApiResponse({ status: 404, description: '재고를 찾을 수 없음' })
  async adjustInventory(
    @Req() req: AuthRequest,
    @Param('productId') productId: string,
    @Body() dto: AdjustInventoryRequest,
  ): Promise<InventoryDetailResponse> {
    if (!req.user) throw new Error('Missing user');

    this.logger.log(`User ${req.user.id} adjusting inventory for product ${productId}`);
    return this.inventoryService.adjustInventory(
      req.user.id,
      productId,
      dto,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }
}
