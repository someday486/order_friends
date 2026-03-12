import {
  Controller,
  Get,
  Param,
  UseGuards,
  Req,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import type { AuthRequest } from '../../common/types/auth-request';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CustomerGuard } from '../../common/guards/customer.guard';
import { CustomerMembersService } from './customer-members.service';

@ApiTags('customer-members')
@ApiBearerAuth()
@UseGuards(AuthGuard, CustomerGuard)
@Controller('customer/members')
export class CustomerMembersController {
  private readonly logger = new Logger(CustomerMembersController.name);

  constructor(private readonly membersService: CustomerMembersService) {}

  @Get('brand/:brandId')
  @ApiOperation({ summary: '브랜드 멤버 목록 조회 (OWNER/ADMIN 전용)' })
  @ApiParam({ name: 'brandId', description: '브랜드 ID' })
  @ApiResponse({ status: 200, description: '브랜드 멤버 목록 조회 성공' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async getBrandMembers(
    @Req() req: AuthRequest,
    @Param('brandId') brandId: string,
  ) {
    if (!req.user) throw new Error('Missing user');
    this.logger.log(
      `User ${req.user.id} fetching brand members for brand ${brandId}`,
    );
    return this.membersService.getBrandMembers(
      req.user.id,
      brandId,
      req.brandMemberships || [],
    );
  }

  @Get('branch/:branchId')
  @ApiOperation({ summary: '지점 멤버 목록 조회 (OWNER/ADMIN 전용)' })
  @ApiParam({ name: 'branchId', description: '지점 ID' })
  @ApiResponse({ status: 200, description: '지점 멤버 목록 조회 성공' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async getBranchMembers(
    @Req() req: AuthRequest,
    @Param('branchId') branchId: string,
  ) {
    if (!req.user) throw new Error('Missing user');
    this.logger.log(
      `User ${req.user.id} fetching branch members for branch ${branchId}`,
    );
    return this.membersService.getBranchMembers(
      req.user.id,
      branchId,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }
}
