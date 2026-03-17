import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CustomerGuard } from '../../common/guards/customer.guard';
import type { AuthRequest } from '../../common/types/auth-request';
import { StampsService } from './stamps.service';
import { UpsertStampCardConfigDto } from './dto/stamp-card-config.dto';

@ApiTags('stamps')
@Controller('customer/branches/:branchId/stamp-card')
@ApiBearerAuth()
@UseGuards(AuthGuard, CustomerGuard)
export class StampsController {
  constructor(private readonly stampsService: StampsService) {}

  @Get()
  @ApiOperation({ summary: '스탬프 카드 설정 조회' })
  async getConfig(
    @Param('branchId') branchId: string,
    @Req() req: AuthRequest,
  ) {
    await this.assertCanManage(req, branchId);
    return this.stampsService.getConfig(branchId);
  }

  @Put()
  @ApiOperation({ summary: '스탬프 카드 설정 저장' })
  async upsertConfig(
    @Param('branchId') branchId: string,
    @Body() dto: UpsertStampCardConfigDto,
    @Req() req: AuthRequest,
  ) {
    await this.assertCanManage(req, branchId);
    return this.stampsService.upsertConfig(branchId, dto);
  }

  private async assertCanManage(req: AuthRequest, branchId: string) {
    const canManage = await this.stampsService.canManageConfig(
      branchId,
      req.brandMemberships ?? [],
      req.branchMemberships ?? [],
    );

    if (!canManage) {
      throw new ForbiddenException('스탬프 설정 권한이 없습니다.');
    }
  }
}
