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
import { SettlementService } from './settlement.service';
import {
  AdminSettlementPeriodsQueryDto,
  CalculateSettlementRequest,
  CommissionTierDto,
  SettlementPeriodDetailResponse,
  SettlementPeriodResponse,
  SettlementPeriodsQueryDto,
  SettlementSummaryQueryDto,
  SettlementSummaryResponse,
  SettleSettlementPeriodRequest,
  UpsertCommissionTierRequest,
} from './dto/settlement.dto';

@ApiTags('settlement')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('settlement')
export class SettlementController {
  constructor(private readonly settlementService: SettlementService) {}

  @Get('periods')
  @ApiOperation({ summary: '브랜드 정산 기간 목록 조회' })
  @ApiResponse({ status: 200, type: SettlementPeriodResponse, isArray: true })
  getPeriods(
    @Req() req: AuthRequest,
    @Query() query: SettlementPeriodsQueryDto,
  ): Promise<SettlementPeriodResponse[]> {
    return this.settlementService.getPeriods(
      req.user?.id ?? '',
      query,
      Boolean(req.isAdmin),
    );
  }

  @Get('periods/:periodId')
  @ApiParam({ name: 'periodId', description: '정산 기간 ID' })
  @ApiOperation({ summary: '브랜드 정산 기간 상세 조회' })
  @ApiResponse({ status: 200, type: SettlementPeriodDetailResponse })
  getPeriodDetail(
    @Req() req: AuthRequest,
    @Param('periodId') periodId: string,
    @Query('brandId') brandId: string,
  ): Promise<SettlementPeriodDetailResponse> {
    return this.settlementService.getPeriodDetail(
      req.user?.id ?? '',
      periodId,
      brandId,
      Boolean(req.isAdmin),
    );
  }

  @Get('summary')
  @ApiOperation({ summary: '브랜드 정산 요약 조회' })
  @ApiResponse({ status: 200, type: SettlementSummaryResponse })
  getSummary(
    @Req() req: AuthRequest,
    @Query() query: SettlementSummaryQueryDto,
  ): Promise<SettlementSummaryResponse> {
    return this.settlementService.getSummary(
      req.user?.id ?? '',
      query,
      Boolean(req.isAdmin),
    );
  }
}

@ApiTags('admin-settlement')
@ApiBearerAuth()
@UseGuards(AuthGuard, AdminGuard)
@Controller('admin/settlement')
export class SettlementAdminController {
  constructor(private readonly settlementService: SettlementService) {}

  @Get('periods')
  @ApiOperation({ summary: '전체 정산 기간 목록 조회' })
  @ApiResponse({ status: 200, type: SettlementPeriodResponse, isArray: true })
  listPeriods(
    @Query() query: AdminSettlementPeriodsQueryDto,
  ): Promise<SettlementPeriodResponse[]> {
    return this.settlementService.listAdminPeriods(query);
  }

  @Get('periods/:periodId')
  @ApiParam({ name: 'periodId', description: '정산 기간 ID' })
  @ApiOperation({ summary: '정산 기간 상세 조회' })
  @ApiResponse({ status: 200, type: SettlementPeriodDetailResponse })
  getPeriodDetail(
    @Param('periodId') periodId: string,
  ): Promise<SettlementPeriodDetailResponse> {
    return this.settlementService.getAdminPeriodDetail(periodId);
  }

  @Put('periods/:periodId/settle')
  @ApiParam({ name: 'periodId', description: '정산 기간 ID' })
  @ApiOperation({ summary: '정산 완료 처리' })
  @ApiResponse({ status: 200, type: SettlementPeriodResponse })
  settlePeriod(
    @Param('periodId') periodId: string,
    @Body() dto: SettleSettlementPeriodRequest,
  ): Promise<SettlementPeriodResponse> {
    return this.settlementService.settlePeriod(periodId, dto);
  }

  @Post('calculate')
  @ApiOperation({ summary: '수동 정산 계산 트리거' })
  triggerCalculation(
    @Body() dto: CalculateSettlementRequest,
  ): Promise<{ processed: number }> {
    return this.settlementService.triggerCalculation(dto);
  }

  @Get('commission-tiers')
  @ApiOperation({ summary: '수수료 구간 목록 조회' })
  listCommissionTiers(): Promise<CommissionTierDto[]> {
    return this.settlementService.listCommissionTiers();
  }

  @Post('commission-tiers')
  @ApiOperation({ summary: '수수료 구간 생성' })
  createCommissionTier(
    @Body() dto: UpsertCommissionTierRequest,
  ): Promise<CommissionTierDto> {
    return this.settlementService.createCommissionTier(dto);
  }

  @Put('commission-tiers/:id')
  @ApiParam({ name: 'id', description: '수수료 구간 ID' })
  @ApiOperation({ summary: '수수료 구간 수정' })
  updateCommissionTier(
    @Param('id') id: string,
    @Body() dto: UpsertCommissionTierRequest,
  ): Promise<CommissionTierDto> {
    return this.settlementService.updateCommissionTier(id, dto);
  }

  @Delete('commission-tiers/:id')
  @ApiParam({ name: 'id', description: '수수료 구간 ID' })
  @ApiOperation({ summary: '수수료 구간 삭제' })
  deleteCommissionTier(@Param('id') id: string): Promise<{ success: true }> {
    return this.settlementService.deleteCommissionTier(id);
  }
}
