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
  Req,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { BranchesService } from './branches.service';
import { CreateBranchRequest, UpdateBranchRequest } from './dto/branch.request';
import type { AuthRequest } from '../../common/types/auth-request';

@Controller('admin/branches')
@UseGuards(AuthGuard, AdminGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  /**
   * 가게 목록 조회
   * GET /admin/branches?brandId=xxx
   */
  @Get()
  async getBranches(
    @Req() req: AuthRequest,
    @Query('brandId') brandId: string,
  ) {
    if (!req.accessToken) throw new Error('Missing access token');
    return this.branchesService.getBranches(
      req.accessToken,
      brandId,
      req.isAdmin,
    );
  }

  /**
   * 가게 상세 조회
   * GET /admin/branches/:branchId
   */
  @Get(':branchId')
  async getBranch(
    @Req() req: AuthRequest,
    @Param('branchId') branchId: string,
  ) {
    if (!req.accessToken) throw new Error('Missing access token');
    return this.branchesService.getBranch(
      req.accessToken,
      branchId,
      req.isAdmin,
    );
  }

  /**
   * 가게 생성
   * POST /admin/branches
   */
  @Post()
  async createBranch(
    @Body() dto: CreateBranchRequest,
    @Req() req: AuthRequest,
  ) {
    const brandId =
      dto.brandId ?? req.brandId ?? (req.query?.brandId as string | undefined);

    if (!brandId) {
      throw new BadRequestException('brandId is required');
    }
    if (!dto?.name || !dto?.slug) {
      throw new BadRequestException('name and slug are required');
    }

    if (!req.accessToken) throw new Error('Missing access token');
    return this.branchesService.createBranch(
      req.accessToken,
      { ...dto, brandId },
      req.isAdmin,
    );
  }

  /**
   * 가게 수정
   * PATCH /admin/branches/:branchId
   */
  @Patch(':branchId')
  async updateBranch(
    @Req() req: AuthRequest,
    @Param('branchId') branchId: string,
    @Body() dto: UpdateBranchRequest,
  ) {
    if (!req.accessToken) throw new Error('Missing access token');
    return this.branchesService.updateBranch(
      req.accessToken,
      branchId,
      dto,
      req.isAdmin,
    );
  }

  /**
   * 가게 삭제
   * DELETE /admin/branches/:branchId
   */
  @Delete(':branchId')
  async deleteBranch(
    @Req() req: AuthRequest,
    @Param('branchId') branchId: string,
  ) {
    if (!req.accessToken) throw new Error('Missing access token');
    return this.branchesService.deleteBranch(
      req.accessToken,
      branchId,
      req.isAdmin,
    );
  }
}
