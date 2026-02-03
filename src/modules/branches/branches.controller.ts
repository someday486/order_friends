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
import { BranchesService } from './branches.service';
import { CreateBranchRequest, UpdateBranchRequest } from './dto/branch.request';

@Controller('admin/branches')
@UseGuards(AuthGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  /**
   * 가게 목록 조회
   * GET /admin/branches?brandId=xxx
   */
  @Get()
  async getBranches(
    @Headers('authorization') authHeader: string,
    @Query('brandId') brandId: string,
  ) {
    const token = authHeader?.replace('Bearer ', '');
    return this.branchesService.getBranches(token, brandId);
  }

  /**
   * 가게 상세 조회
   * GET /admin/branches/:branchId
   */
  @Get(':branchId')
  async getBranch(
    @Headers('authorization') authHeader: string,
    @Param('branchId') branchId: string,
  ) {
    const token = authHeader?.replace('Bearer ', '');
    return this.branchesService.getBranch(token, branchId);
  }

  /**
   * 가게 생성
   * POST /admin/branches
   */
  @Post()
  async createBranch(
    @Headers('authorization') authHeader: string,
    @Body() dto: CreateBranchRequest,
  ) {
    const token = authHeader?.replace('Bearer ', '');
    return this.branchesService.createBranch(token, dto);
  }

  /**
   * 가게 수정
   * PATCH /admin/branches/:branchId
   */
  @Patch(':branchId')
  async updateBranch(
    @Headers('authorization') authHeader: string,
    @Param('branchId') branchId: string,
    @Body() dto: UpdateBranchRequest,
  ) {
    const token = authHeader?.replace('Bearer ', '');
    return this.branchesService.updateBranch(token, branchId, dto);
  }

  /**
   * 가게 삭제
   * DELETE /admin/branches/:branchId
   */
  @Delete(':branchId')
  async deleteBranch(
    @Headers('authorization') authHeader: string,
    @Param('branchId') branchId: string,
  ) {
    const token = authHeader?.replace('Bearer ', '');
    return this.branchesService.deleteBranch(token, branchId);
  }
}
