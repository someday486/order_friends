import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import type { AuthRequest } from '../../common/types/auth-request';
import { MembersService } from './members.service';
import {
  BrandRole,
  UpdateBrandMemberRequest,
  AddBranchMemberRequest,
  UpdateBranchMemberRequest,
} from './dto/member.dto';

@Controller('admin/members')
@UseGuards(AuthGuard, AdminGuard)
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  // ============================================================
  // Brand Members
  // ============================================================

  /**
   * 브랜드 멤버 목록 조회
   * GET /admin/members/brand/:brandId
   */
  @Get('brand/:brandId')
  async getBrandMembers(@Req() req: AuthRequest, @Param('brandId') brandId: string) {
    if (!req.accessToken) throw new Error('Missing access token');
    return this.membersService.getBrandMembers(req.accessToken, brandId, req.isAdmin);
  }

  /**
   * 브랜드 멤버 추가
   * POST /admin/members/brand/:brandId
   */
  @Post('brand/:brandId')
  async addBrandMember(
    @Req() req: AuthRequest,
    @Param('brandId') brandId: string,
    @Body() body: { userId: string; role?: BrandRole },
  ) {
    if (!req.accessToken) throw new Error('Missing access token');
    return this.membersService.addBrandMember(
      req.accessToken,
      brandId,
      body.userId,
      body.role,
      req.isAdmin,
    );
  }

  /**
   * 브랜드 멤버 수정
   * PATCH /admin/members/brand/:brandId/:userId
   */
  @Patch('brand/:brandId/:userId')
  async updateBrandMember(
    @Req() req: AuthRequest,
    @Param('brandId') brandId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateBrandMemberRequest,
  ) {
    if (!req.accessToken) throw new Error('Missing access token');
    return this.membersService.updateBrandMember(
      req.accessToken,
      brandId,
      userId,
      dto,
      req.isAdmin,
    );
  }

  /**
   * 브랜드 멤버 삭제
   * DELETE /admin/members/brand/:brandId/:userId
   */
  @Delete('brand/:brandId/:userId')
  async removeBrandMember(
    @Req() req: AuthRequest,
    @Param('brandId') brandId: string,
    @Param('userId') userId: string,
  ) {
    if (!req.accessToken) throw new Error('Missing access token');
    return this.membersService.removeBrandMember(req.accessToken, brandId, userId, req.isAdmin);
  }

  // ============================================================
  // Branch Members
  // ============================================================

  /**
   * 가게 멤버 목록 조회
   * GET /admin/members/branch/:branchId
   */
  @Get('branch/:branchId')
  async getBranchMembers(@Req() req: AuthRequest, @Param('branchId') branchId: string) {
    if (!req.accessToken) throw new Error('Missing access token');
    return this.membersService.getBranchMembers(req.accessToken, branchId, req.isAdmin);
  }

  /**
   * 가게 멤버 추가
   * POST /admin/members/branch
   */
  @Post('branch')
  async addBranchMember(@Req() req: AuthRequest, @Body() dto: AddBranchMemberRequest) {
    if (!req.accessToken) throw new Error('Missing access token');
    return this.membersService.addBranchMember(req.accessToken, dto, req.isAdmin);
  }

  /**
   * 가게 멤버 수정
   * PATCH /admin/members/branch/:branchId/:userId
   */
  @Patch('branch/:branchId/:userId')
  async updateBranchMember(
    @Req() req: AuthRequest,
    @Param('branchId') branchId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateBranchMemberRequest,
  ) {
    if (!req.accessToken) throw new Error('Missing access token');
    return this.membersService.updateBranchMember(
      req.accessToken,
      branchId,
      userId,
      dto,
      req.isAdmin,
    );
  }

  /**
   * 가게 멤버 삭제
   * DELETE /admin/members/branch/:branchId/:userId
   */
  @Delete('branch/:branchId/:userId')
  async removeBranchMember(
    @Req() req: AuthRequest,
    @Param('branchId') branchId: string,
    @Param('userId') userId: string,
  ) {
    if (!req.accessToken) throw new Error('Missing access token');
    return this.membersService.removeBranchMember(req.accessToken, branchId, userId, req.isAdmin);
  }
}
