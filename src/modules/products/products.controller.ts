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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import type { AuthRequest } from '../../common/types/auth-request';
import { ProductsService } from './products.service';
import { CreateProductRequest } from './dto/create-product.request';
import { UpdateProductRequest } from './dto/update-product.request';

@ApiTags('products')
@ApiBearerAuth()
@Controller('admin/products')
@UseGuards(AuthGuard, AdminGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: '상품 목록 조회', description: '지점의 상품 목록을 조회합니다.' })
  @ApiQuery({ name: 'branchId', description: '지점 ID', required: true })
  @ApiResponse({ status: 200, description: '상품 목록 조회 성공' })
  async getProducts(@Req() req: AuthRequest, @Query('branchId') branchId: string) {
    if (!req.accessToken) throw new Error('Missing access token');
    return this.productsService.getProducts(req.accessToken, branchId, req.isAdmin);
  }

  @Get('categories')
  @ApiOperation({ summary: '상품 카테고리 목록 조회', description: '지점의 상품 카테고리 목록을 조회합니다.' })
  @ApiQuery({ name: 'branchId', description: '지점 ID', required: true })
  @ApiResponse({ status: 200, description: '카테고리 목록 조회 성공' })
  async getCategories(@Req() req: AuthRequest, @Query('branchId') branchId: string) {
    if (!req.accessToken) throw new Error('Missing access token');
    return this.productsService.getCategories(req.accessToken, branchId, req.isAdmin);
  }

  @Get(':productId')
  @ApiOperation({ summary: '상품 상세 조회', description: '특정 상품의 상세 정보를 조회합니다.' })
  @ApiParam({ name: 'productId', description: '상품 ID' })
  @ApiResponse({ status: 200, description: '상품 상세 조회 성공' })
  @ApiResponse({ status: 404, description: '상품을 찾을 수 없음' })
  async getProduct(@Req() req: AuthRequest, @Param('productId') productId: string) {
    if (!req.accessToken) throw new Error('Missing access token');
    return this.productsService.getProduct(req.accessToken, productId, req.isAdmin);
  }

  @Post()
  @ApiOperation({ summary: '상품 생성', description: '새로운 상품을 생성합니다.' })
  @ApiBody({ type: CreateProductRequest })
  @ApiResponse({ status: 201, description: '상품 생성 성공' })
  async createProduct(@Req() req: AuthRequest, @Body() dto: CreateProductRequest) {
    if (!req.accessToken) throw new Error('Missing access token');
    return this.productsService.createProduct(req.accessToken, dto, req.isAdmin);
  }

  @Patch(':productId')
  @ApiOperation({ summary: '상품 수정', description: '기존 상품 정보를 수정합니다.' })
  @ApiParam({ name: 'productId', description: '상품 ID' })
  @ApiBody({ type: UpdateProductRequest })
  @ApiResponse({ status: 200, description: '상품 수정 성공' })
  @ApiResponse({ status: 404, description: '상품을 찾을 수 없음' })
  async updateProduct(
    @Req() req: AuthRequest,
    @Param('productId') productId: string,
    @Body() dto: UpdateProductRequest,
  ) {
    if (!req.accessToken) throw new Error('Missing access token');
    return this.productsService.updateProduct(req.accessToken, productId, dto, req.isAdmin);
  }

  @Delete(':productId')
  @ApiOperation({ summary: '상품 삭제', description: '상품을 삭제합니다.' })
  @ApiParam({ name: 'productId', description: '상품 ID' })
  @ApiResponse({ status: 200, description: '상품 삭제 성공' })
  @ApiResponse({ status: 404, description: '상품을 찾을 수 없음' })
  async deleteProduct(@Req() req: AuthRequest, @Param('productId') productId: string) {
    if (!req.accessToken) throw new Error('Missing access token');
    return this.productsService.deleteProduct(req.accessToken, productId, req.isAdmin);
  }
}
