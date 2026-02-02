import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BrandsService } from './brands.service';
import { CreateBrandRequest, UpdateBrandRequest } from './dto/brand.dto';

@Controller('admin/brands')
@UseGuards(AuthGuard)
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  /**
   * 내 브랜드 목록 조회
   * GET /admin/brands
   */
  @Get()
  async getMyBrands(@Headers('authorization') authHeader: string) {
    const token = authHeader?.replace('Bearer ', '');
    return this.brandsService.getMyBrands(token);
  }

  /**
   * 브랜드 상세 조회
   * GET /admin/brands/:brandId
   */
  @Get(':brandId')
  async getBrand(
    @Headers('authorization') authHeader: string,
    @Param('brandId') brandId: string,
  ) {
    const token = authHeader?.replace('Bearer ', '');
    return this.brandsService.getBrand(token, brandId);
  }

  /**
   * 브랜드 생성
   * POST /admin/brands
   */
  @Post()
  async createBrand(
    @Headers('authorization') authHeader: string,
    @Body() dto: CreateBrandRequest,
  ) {
    const token = authHeader?.replace('Bearer ', '');
    return this.brandsService.createBrand(token, dto);
  }

  /**
   * 브랜드 수정
   * PATCH /admin/brands/:brandId
   */
  @Patch(':brandId')
  async updateBrand(
    @Headers('authorization') authHeader: string,
    @Param('brandId') brandId: string,
    @Body() dto: UpdateBrandRequest,
  ) {
    const token = authHeader?.replace('Bearer ', '');
    return this.brandsService.updateBrand(token, brandId, dto);
  }

  /**
   * 브랜드 삭제
   * DELETE /admin/brands/:brandId
   */
  @Delete(':brandId')
  async deleteBrand(
    @Headers('authorization') authHeader: string,
    @Param('brandId') brandId: string,
  ) {
    const token = authHeader?.replace('Bearer ', '');
    return this.brandsService.deleteBrand(token, brandId);
  }
}
