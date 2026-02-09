import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import type { AuthRequest } from '../../common/types/auth-request';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CustomerGuard } from '../../common/guards/customer.guard';
import { CustomerBrandsService } from './customer-brands.service';

@ApiTags('customer-brands')
@ApiBearerAuth()
@UseGuards(AuthGuard, CustomerGuard)
@Controller('customer/brands')
export class CustomerBrandsController {
  constructor(private readonly brandsService: CustomerBrandsService) {}

  @Get()
  @ApiOperation({
    summary: '내 브랜드 목록 조회',
    description: '본인이 멤버로 등록된 브랜드 목록을 조회합니다.',
  })
  @ApiResponse({ status: 200, description: '브랜드 목록 조회 성공' })
  async getMyBrands(@Req() req: AuthRequest) {
    if (!req.user) throw new Error('Missing user');
    return this.brandsService.getMyBrands(
      req.user.id,
      req.brandMemberships || [],
    );
  }

  @Get(':brandId')
  @ApiOperation({
    summary: '내 브랜드 상세 조회',
    description: '내가 멤버로 등록된 브랜드의 상세 정보를 조회합니다.',
  })
  @ApiParam({ name: 'brandId', description: '브랜드 ID' })
  @ApiResponse({ status: 200, description: '브랜드 상세 조회 성공' })
  @ApiResponse({
    status: 403,
    description: '권한 없음 - 해당 브랜드의 멤버가 아님',
  })
  @ApiResponse({ status: 404, description: '브랜드를 찾을 수 없음' })
  async getMyBrand(@Param('brandId') brandId: string, @Req() req: AuthRequest) {
    if (!req.user) throw new Error('Missing user');
    return this.brandsService.getMyBrand(
      brandId,
      req.user.id,
      req.brandMemberships || [],
    );
  }

  @Patch(':brandId')
  @ApiOperation({
    summary: '내 브랜드 수정',
    description: '내가 OWNER 또는 ADMIN 권한을 가진 브랜드를 수정합니다.',
  })
  @ApiParam({ name: 'brandId', description: '브랜드 ID' })
  @ApiResponse({ status: 200, description: '브랜드 수정 성공' })
  @ApiResponse({
    status: 403,
    description: '권한 없음 - OWNER/ADMIN 권한 필요',
  })
  @ApiResponse({ status: 404, description: '브랜드를 찾을 수 없음' })
  async updateMyBrand(
    @Param('brandId') brandId: string,
    @Body() updateData: any,
    @Req() req: AuthRequest,
  ) {
    if (!req.user) throw new Error('Missing user');
    return this.brandsService.updateMyBrand(
      brandId,
      updateData,
      req.user.id,
      req.brandMemberships || [],
    );
  }
}
