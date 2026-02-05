import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import type { AuthRequest } from '../../common/types/auth-request';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CustomerGuard } from '../../common/guards/customer.guard';
import { CustomerDashboardService } from './customer-dashboard.service';

@ApiTags('customer-dashboard')
@ApiBearerAuth()
@UseGuards(AuthGuard, CustomerGuard)
@Controller('customer/dashboard')
export class CustomerDashboardController {
  constructor(private readonly dashboardService: CustomerDashboardService) {}

  @Get()
  @ApiOperation({
    summary: '고객 대시보드 통계 조회',
    description: '고객(브랜드 오너)의 전체 통계를 조회합니다. 본인이 소유한 브랜드/매장의 통계만 조회됩니다.'
  })
  @ApiResponse({ status: 200, description: '대시보드 통계 조회 성공' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  async getDashboardStats(@Req() req: AuthRequest) {
    if (!req.accessToken) throw new Error('Missing access token');
    if (!req.user) throw new Error('Missing user');

    return this.dashboardService.getDashboardStats(
      req.user.id,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }
}
