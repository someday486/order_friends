import { Controller, Get, UseGuards, Headers } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { DashboardService } from './dashboard.service';

@Controller('admin/dashboard')
@UseGuards(AuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * 대시보드 통계 조회
   * GET /admin/dashboard/stats
   */
  @Get('stats')
  async getStats(@Headers('authorization') authHeader: string) {
    const token = authHeader?.replace('Bearer ', '');
    return this.dashboardService.getStats(token);
  }
}
