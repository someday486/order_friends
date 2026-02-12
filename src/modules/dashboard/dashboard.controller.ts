import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import type { AuthRequest } from '../../common/types/auth-request';
import { DashboardService } from './dashboard.service';

@Controller('admin/dashboard')
@UseGuards(AuthGuard, AdminGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * 대시보드 통계 조회
   * GET /admin/dashboard/stats
   */
  @Get('stats')
  async getStats(@Req() req: AuthRequest, @Query('brandId') brandId: string) {
    if (!req.accessToken) throw new Error('Missing access token');
    if (!brandId) {
      throw new BadRequestException('brandId is required');
    }
    return this.dashboardService.getStats(
      req.accessToken,
      brandId,
      req.isAdmin,
    );
  }
}
