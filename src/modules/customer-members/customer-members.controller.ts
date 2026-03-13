import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
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
import {
  InviteCustomerBrandMemberRequest,
  InviteCustomerBranchMemberRequest,
} from './dto/customer-member-invite.dto';
import {
  UpdateBrandMemberRequest,
  UpdateBranchMemberRequest,
} from '../members/dto/member.dto';
import { CustomerMemberHistoryResponse } from './dto/customer-member-history.dto';

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

  @Get('brand/:brandId/history')
  @ApiOperation({ summary: '브랜드 멤버 변경 이력 조회 (OWNER/ADMIN 전용)' })
  @ApiParam({ name: 'brandId', description: '브랜드 ID' })
  @ApiResponse({
    status: 200,
    description: '브랜드 멤버 변경 이력 조회 성공',
    type: CustomerMemberHistoryResponse,
    isArray: true,
  })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async getBrandMemberHistory(
    @Req() req: AuthRequest,
    @Param('brandId') brandId: string,
  ) {
    if (!req.user) throw new Error('Missing user');
    return this.membersService.getBrandMemberHistory(
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

  @Get('branch/:branchId/history')
  @ApiOperation({ summary: '매장 멤버 변경 이력 조회 (OWNER/ADMIN 전용)' })
  @ApiParam({ name: 'branchId', description: '매장 ID' })
  @ApiResponse({
    status: 200,
    description: '매장 멤버 변경 이력 조회 성공',
    type: CustomerMemberHistoryResponse,
    isArray: true,
  })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async getBranchMemberHistory(
    @Req() req: AuthRequest,
    @Param('branchId') branchId: string,
  ) {
    if (!req.user) throw new Error('Missing user');
    return this.membersService.getBranchMemberHistory(
      req.user.id,
      branchId,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }

  @Post('brand/:brandId/invite')
  @ApiOperation({ summary: '브랜드 멤버 이메일 초대 (OWNER/ADMIN 전용)' })
  @ApiParam({ name: 'brandId', description: '브랜드 ID' })
  @ApiResponse({ status: 201, description: '브랜드 멤버 초대 성공' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async inviteBrandMember(
    @Req() req: AuthRequest,
    @Param('brandId') brandId: string,
    @Body() dto: InviteCustomerBrandMemberRequest,
  ) {
    if (!req.user) throw new Error('Missing user');
    this.logger.log(
      `User ${req.user.id} inviting brand member to brand ${brandId}`,
    );
    return this.membersService.inviteBrandMember(
      req.user.id,
      brandId,
      dto,
      req.brandMemberships || [],
    );
  }

  @Post('branch/:branchId/invite')
  @ApiOperation({ summary: '지점 멤버 이메일 초대 (OWNER/ADMIN 전용)' })
  @ApiParam({ name: 'branchId', description: '지점 ID' })
  @ApiResponse({ status: 201, description: '지점 멤버 초대 성공' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async inviteBranchMember(
    @Req() req: AuthRequest,
    @Param('branchId') branchId: string,
    @Body() dto: InviteCustomerBranchMemberRequest,
  ) {
    if (!req.user) throw new Error('Missing user');
    this.logger.log(
      `User ${req.user.id} inviting branch member to branch ${branchId}`,
    );
    return this.membersService.inviteBranchMember(
      req.user.id,
      branchId,
      dto,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }

  @Patch('brand/:brandId/:userId')
  @ApiOperation({ summary: '브랜드 멤버 권한 수정 (OWNER/ADMIN 전용)' })
  @ApiParam({ name: 'brandId', description: '브랜드 ID' })
  @ApiParam({ name: 'userId', description: '사용자 ID' })
  @ApiResponse({ status: 200, description: '브랜드 멤버 수정 성공' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async updateBrandMember(
    @Req() req: AuthRequest,
    @Param('brandId') brandId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateBrandMemberRequest,
  ) {
    if (!req.user) throw new Error('Missing user');
    return this.membersService.updateBrandMember(
      req.user.id,
      brandId,
      userId,
      dto,
      req.brandMemberships || [],
    );
  }

  @Patch('branch/:branchId/:userId')
  @ApiOperation({ summary: '지점 멤버 권한 수정 (OWNER/ADMIN 전용)' })
  @ApiParam({ name: 'branchId', description: '지점 ID' })
  @ApiParam({ name: 'userId', description: '사용자 ID' })
  @ApiResponse({ status: 200, description: '지점 멤버 수정 성공' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async updateBranchMember(
    @Req() req: AuthRequest,
    @Param('branchId') branchId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateBranchMemberRequest,
  ) {
    if (!req.user) throw new Error('Missing user');
    return this.membersService.updateBranchMember(
      req.user.id,
      branchId,
      userId,
      dto,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }
}
