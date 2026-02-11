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
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import type { AuthRequest } from '../../common/types/auth-request';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CustomerGuard } from '../../common/guards/customer.guard';
import { CustomerBranchesService } from './customer-branches.service';
import {
  CreateBranchRequest,
  UpdateBranchRequest,
} from '../../modules/branches/dto/branch.request';

@ApiTags('customer-branches')
@ApiBearerAuth()
@UseGuards(AuthGuard, CustomerGuard)
@Controller('customer/branches')
export class CustomerBranchesController {
  private readonly logger = new Logger(CustomerBranchesController.name);

  constructor(private readonly branchesService: CustomerBranchesService) {}

  @Get()
  @ApiOperation({
    summary: '내 브랜드의 지점 목록 조회',
    description:
      'brandId가 주어지면 해당 브랜드의 지점만, 없으면 접근 가능한 모든 지점을 반환합니다.',
  })
  @ApiQuery({ name: 'brandId', description: '브랜드 ID', required: false })
  @ApiResponse({ status: 200, description: '지점 목록 조회 성공' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async getBranches(
    @Req() req: AuthRequest,
    @Query('brandId') brandId?: string,
  ) {
    if (!req.user) throw new Error('Missing user');

    this.logger.log(
      `User ${req.user.id} fetching branches${brandId ? ` for brand ${brandId}` : ' (all)'}`,
    );
    return this.branchesService.getMyBranches(
      req.user.id,
      brandId,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }

  @Get(':branchId')
  @ApiOperation({
    summary: '내 지점 상세 조회',
    description: '내가 멤버로 등록된 지점의 상세 정보를 조회합니다.',
  })
  @ApiParam({ name: 'branchId', description: '지점 ID' })
  @ApiResponse({ status: 200, description: '지점 상세 조회 성공' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  @ApiResponse({ status: 404, description: '지점을 찾을 수 없음' })
  async getBranch(
    @Req() req: AuthRequest,
    @Param('branchId') branchId: string,
  ) {
    if (!req.user) throw new Error('Missing user');

    this.logger.log(`User ${req.user.id} fetching branch ${branchId}`);
    return this.branchesService.getMyBranch(
      req.user.id,
      branchId,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }

  @Post()
  @ApiOperation({
    summary: '지점 생성',
    description:
      '내가 OWNER 또는 ADMIN 권한을 가진 브랜드에 새로운 지점을 생성합니다.',
  })
  @ApiResponse({ status: 201, description: '지점 생성 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async createBranch(
    @Req() req: AuthRequest,
    @Body() dto: CreateBranchRequest,
  ) {
    if (!req.user) throw new Error('Missing user');
    if (!dto.brandId) {
      throw new BadRequestException('brandId is required');
    }

    this.logger.log(
      `User ${req.user.id} creating branch for brand ${dto.brandId}`,
    );
    return this.branchesService.createMyBranch(
      req.user.id,
      dto,
      req.brandMemberships || [],
    );
  }

  @Patch(':branchId')
  @ApiOperation({
    summary: '지점 수정',
    description: '내가 OWNER 또는 ADMIN 권한을 가진 지점을 수정합니다.',
  })
  @ApiParam({ name: 'branchId', description: '지점 ID' })
  @ApiResponse({ status: 200, description: '지점 수정 성공' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  @ApiResponse({ status: 404, description: '지점을 찾을 수 없음' })
  async updateBranch(
    @Req() req: AuthRequest,
    @Param('branchId') branchId: string,
    @Body() dto: UpdateBranchRequest,
  ) {
    if (!req.user) throw new Error('Missing user');

    this.logger.log(`User ${req.user.id} updating branch ${branchId}`);
    return this.branchesService.updateMyBranch(
      req.user.id,
      branchId,
      dto,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }

  @Delete(':branchId')
  @ApiOperation({
    summary: '지점 삭제',
    description: '내가 OWNER 또는 ADMIN 권한을 가진 지점을 삭제합니다.',
  })
  @ApiParam({ name: 'branchId', description: '지점 ID' })
  @ApiResponse({ status: 200, description: '지점 삭제 성공' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  @ApiResponse({ status: 404, description: '지점을 찾을 수 없음' })
  async deleteBranch(
    @Req() req: AuthRequest,
    @Param('branchId') branchId: string,
  ) {
    if (!req.user) throw new Error('Missing user');

    this.logger.log(`User ${req.user.id} deleting branch ${branchId}`);
    return this.branchesService.deleteMyBranch(
      req.user.id,
      branchId,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }
}
