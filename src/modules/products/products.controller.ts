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
import { AuthGuard } from '../../common/guards/auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import type { AuthRequest } from '../../common/types/auth-request';
import { ProductsService } from './products.service';
import { CreateProductRequest } from './dto/create-product.request';
import { UpdateProductRequest } from './dto/update-product.request';

@Controller('admin/products')
@UseGuards(AuthGuard, AdminGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /**
   * 상품 목록 조회
   * GET /admin/products?branchId=xxx
   */
  @Get()
  async getProducts(@Req() req: AuthRequest, @Query('branchId') branchId: string) {
    if (!req.accessToken) throw new Error('Missing access token');
    return this.productsService.getProducts(req.accessToken, branchId, req.isAdmin);
  }

  /**
   * 상품 상세 조회
   * GET /admin/products/:productId
   */
  @Get(':productId')
  async getProduct(@Req() req: AuthRequest, @Param('productId') productId: string) {
    if (!req.accessToken) throw new Error('Missing access token');
    return this.productsService.getProduct(req.accessToken, productId, req.isAdmin);
  }

  /**
   * 상품 생성
   * POST /admin/products
   */
  @Post()
  async createProduct(@Req() req: AuthRequest, @Body() dto: CreateProductRequest) {
    if (!req.accessToken) throw new Error('Missing access token');
    return this.productsService.createProduct(req.accessToken, dto, req.isAdmin);
  }

  /**
   * 상품 수정
   * PATCH /admin/products/:productId
   */
  @Patch(':productId')
  async updateProduct(
    @Req() req: AuthRequest,
    @Param('productId') productId: string,
    @Body() dto: UpdateProductRequest,
  ) {
    if (!req.accessToken) throw new Error('Missing access token');
    return this.productsService.updateProduct(req.accessToken, productId, dto, req.isAdmin);
  }

  /**
   * 상품 삭제
   * DELETE /admin/products/:productId
   */
  @Delete(':productId')
  async deleteProduct(@Req() req: AuthRequest, @Param('productId') productId: string) {
    if (!req.accessToken) throw new Error('Missing access token');
    return this.productsService.deleteProduct(req.accessToken, productId, req.isAdmin);
  }
}
