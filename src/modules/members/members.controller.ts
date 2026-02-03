import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { MembersService } from './members.service';
import {
  BrandRole,
  UpdateBrandMemberRequest,
  AddBranchMemberRequest,
  UpdateBranchMemberRequest,
} from './dto/member.dto';

@Controller('admin/members')
@UseGuards(AuthGuard)
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
  async getBrandMembers(
    @Headers('authorization') authHeader: string,
    @Param('brandId') brandId: string,
  ) {
    const token = authHeader?.replace('Bearer ', '');
    return this.membersService.getBrandMembers(token, brandId);
  }

  /**
   * 브랜드 멤버 추가
   * POST /admin/members/brand/:brandId
   */
  @Post('brand/:brandId')
  async addBrandMember(
    @Headers('authorization') authHeader: string,
    @Param('brandId') brandId: string,
    @Body() body: { userId: string; role?: BrandRole },
  ) {
    const token = authHeader?.replace('Bearer ', '');
    return this.membersService.addBrandMember(token, brandId, body.userId, body.role);
  }

  /**
   * 브랜드 멤버 수정
   * PATCH /admin/members/brand/:brandId/:userId
   */
  @Patch('brand/:brandId/:userId')
  async updateBrandMember(
    @Headers('authorization') authHeader: string,
    @Param('brandId') brandId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateBrandMemberRequest,
  ) {
    const token = authHeader?.replace('Bearer ', '');
    return this.membersService.updateBrandMember(token, brandId, userId, dto);
  }

  /**
   * 브랜드 멤버 삭제
   * DELETE /admin/members/brand/:brandId/:userId
   */
  @Delete('brand/:brandId/:userId')
  async removeBrandMember(
    @Headers('authorization') authHeader: string,
    @Param('brandId') brandId: string,
    @Param('userId') userId: string,
  ) {
    const token = authHeader?.replace('Bearer ', '');
    return this.membersService.removeBrandMember(token, brandId, userId);
  }

  // ============================================================
  // Branch Members
  // ============================================================

  /**
   * 가게 멤버 목록 조회
   * GET /admin/members/branch/:branchId
   */
  @Get('branch/:branchId')
  async getBranchMembers(
    @Headers('authorization') authHeader: string,
    @Param('branchId') branchId: string,
  ) {
    const token = authHeader?.replace('Bearer ', '');
    return this.membersService.getBranchMembers(token, branchId);
  }

  /**
   * 가게 멤버 추가
   * POST /admin/members/branch
   */
  @Post('branch')
  async addBranchMember(
    @Headers('authorization') authHeader: string,
    @Body() dto: AddBranchMemberRequest,
  ) {
    const token = authHeader?.replace('Bearer ', '');
    return this.membersService.addBranchMember(token, dto);
  }

  /**
   * 가게 멤버 수정
   * PATCH /admin/members/branch/:branchId/:userId
   */
  @Patch('branch/:branchId/:userId')
  async updateBranchMember(
    @Headers('authorization') authHeader: string,
    @Param('branchId') branchId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateBranchMemberRequest,
  ) {
    const token = authHeader?.replace('Bearer ', '');
    return this.membersService.updateBranchMember(token, branchId, userId, dto);
  }

  /**
   * 가게 멤버 삭제
   * DELETE /admin/members/branch/:branchId/:userId
   */
  @Delete('branch/:branchId/:userId')
  async removeBranchMember(
    @Headers('authorization') authHeader: string,
    @Param('branchId') branchId: string,
    @Param('userId') userId: string,
  ) {
    const token = authHeader?.replace('Bearer ', '');
    return this.membersService.removeBranchMember(token, branchId, userId);
  }
}
