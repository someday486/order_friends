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
import { BrandsService } from './brands.service';
import { CreateBrandRequest, UpdateBrandRequest } from './dto/brand.dto';

@Controller('admin/brands')
@UseGuards(AuthGuard, AdminGuard)
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  /**
   * 브랜드 목록 조회
   * GET /admin/brands
   */
  @Get()
  async getMyBrands(@Req() req: AuthRequest) {
    if (!req.accessToken) throw new Error('Missing access token');
    return this.brandsService.getMyBrands(req.accessToken, req.isAdmin);
  }

  /**
   * 브랜드 상세 조회
   * GET /admin/brands/:brandId
   */
  @Get(':brandId')
  async getBrand(@Req() req: AuthRequest, @Param('brandId') brandId: string) {
    if (!req.accessToken) throw new Error('Missing access token');
    return this.brandsService.getBrand(req.accessToken, brandId, req.isAdmin);
  }

  /**
   * 브랜드 생성
   * POST /admin/brands
   */
  @Post()
  async createBrand(@Req() req: AuthRequest, @Body() dto: CreateBrandRequest) {
    if (!req.accessToken) throw new Error('Missing access token');
    return this.brandsService.createBrand(req.accessToken, dto, req.isAdmin);
  }

  /**
   * 브랜드 수정
   * PATCH /admin/brands/:brandId
   */
  @Patch(':brandId')
  async updateBrand(
    @Req() req: AuthRequest,
    @Param('brandId') brandId: string,
    @Body() dto: UpdateBrandRequest,
  ) {
    if (!req.accessToken) throw new Error('Missing access token');
    return this.brandsService.updateBrand(req.accessToken, brandId, dto, req.isAdmin);
  }

  /**
   * 브랜드 삭제
   * DELETE /admin/brands/:brandId
   */
  @Delete(':brandId')
  async deleteBrand(@Req() req: AuthRequest, @Param('brandId') brandId: string) {
    if (!req.accessToken) throw new Error('Missing access token');
    return this.brandsService.deleteBrand(req.accessToken, brandId, req.isAdmin);
  }
}
