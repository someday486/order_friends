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
import { ProductsService } from './products.service';
import { CreateProductRequest } from './dto/create-product.request';
import { UpdateProductRequest } from './dto/update-product.request';

@Controller('admin/products')
@UseGuards(AuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /**
   * 상품 목록 조회
   * GET /admin/products?branchId=xxx
   */
  @Get()
  async getProducts(
    @Headers('authorization') authHeader: string,
    @Query('branchId') branchId: string,
  ) {
    const token = authHeader?.replace('Bearer ', '');
    return this.productsService.getProducts(token, branchId);
  }

  /**
   * 상품 상세 조회
   * GET /admin/products/:productId
   */
  @Get(':productId')
  async getProduct(
    @Headers('authorization') authHeader: string,
    @Param('productId') productId: string,
  ) {
    const token = authHeader?.replace('Bearer ', '');
    return this.productsService.getProduct(token, productId);
  }

  /**
   * 상품 생성
   * POST /admin/products
   */
  @Post()
  async createProduct(
    @Headers('authorization') authHeader: string,
    @Body() dto: CreateProductRequest,
  ) {
    const token = authHeader?.replace('Bearer ', '');
    return this.productsService.createProduct(token, dto);
  }

  /**
   * 상품 수정
   * PATCH /admin/products/:productId
   */
  @Patch(':productId')
  async updateProduct(
    @Headers('authorization') authHeader: string,
    @Param('productId') productId: string,
    @Body() dto: UpdateProductRequest,
  ) {
    const token = authHeader?.replace('Bearer ', '');
    return this.productsService.updateProduct(token, productId, dto);
  }

  /**
   * 상품 삭제
   * DELETE /admin/products/:productId
   */
  @Delete(':productId')
  async deleteProduct(
    @Headers('authorization') authHeader: string,
    @Param('productId') productId: string,
  ) {
    const token = authHeader?.replace('Bearer ', '');
    return this.productsService.deleteProduct(token, productId);
  }
}
