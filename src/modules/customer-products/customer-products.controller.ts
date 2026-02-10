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
  ApiBody,
} from '@nestjs/swagger';
import type { AuthRequest } from '../../common/types/auth-request';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CustomerGuard } from '../../common/guards/customer.guard';
import { CustomerProductsService } from './customer-products.service';
import { CreateProductRequest } from '../../modules/products/dto/create-product.request';
import { UpdateProductRequest } from '../../modules/products/dto/update-product.request';
import { ReorderProductsRequest } from '../../modules/products/dto/reorder-products.request';
import {
  CreateCategoryRequest,
  UpdateCategoryRequest,
  ReorderCategoriesRequest,
} from '../../modules/products/dto/category-crud.request';

@ApiTags('customer-products')
@ApiBearerAuth()
@UseGuards(AuthGuard, CustomerGuard)
@Controller('customer/products')
export class CustomerProductsController {
  private readonly logger = new Logger(CustomerProductsController.name);

  constructor(private readonly productsService: CustomerProductsService) {}

  @Get()
  @ApiOperation({
    summary: '내 지점의 상품 목록 조회',
    description: '내가 멤버로 등록된 지점의 상품 목록을 조회합니다.',
  })
  @ApiQuery({ name: 'branchId', description: '지점 ID', required: true })
  @ApiResponse({ status: 200, description: '상품 목록 조회 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async getProducts(
    @Req() req: AuthRequest,
    @Query('branchId') branchId: string,
  ) {
    if (!req.user) throw new Error('Missing user');
    if (!branchId) {
      throw new BadRequestException('branchId is required');
    }

    this.logger.log(
      `User ${req.user.id} fetching products for branch ${branchId}`,
    );
    return this.productsService.getMyProducts(
      req.user.id,
      branchId,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }

  @Get('categories')
  @ApiOperation({
    summary: '지점의 상품 카테고리 목록 조회',
    description: '내가 멤버로 등록된 지점의 상품 카테고리 목록을 조회합니다.',
  })
  @ApiQuery({ name: 'branchId', description: '지점 ID', required: true })
  @ApiResponse({ status: 200, description: '카테고리 목록 조회 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async getCategories(
    @Req() req: AuthRequest,
    @Query('branchId') branchId: string,
  ) {
    if (!req.user) throw new Error('Missing user');
    if (!branchId) {
      throw new BadRequestException('branchId is required');
    }

    this.logger.log(
      `User ${req.user.id} fetching categories for branch ${branchId}`,
    );
    return this.productsService.getMyCategories(
      req.user.id,
      branchId,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }

  @Post('categories')
  @ApiOperation({
    summary: '카테고리 생성',
    description:
      '내가 OWNER 또는 ADMIN 권한을 가진 지점에 카테고리를 생성합니다.',
  })
  @ApiResponse({ status: 201, description: '카테고리 생성 성공' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async createCategory(
    @Req() req: AuthRequest,
    @Body() dto: CreateCategoryRequest,
  ) {
    if (!req.user) throw new Error('Missing user');
    if (!dto.branchId) {
      throw new BadRequestException('branchId is required');
    }

    this.logger.log(
      `User ${req.user.id} creating category for branch ${dto.branchId}`,
    );
    return this.productsService.createCategory(
      req.user.id,
      dto.branchId,
      dto.name,
      dto.sortOrder,
      dto.isActive,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }

  @Patch('categories/reorder')
  @ApiOperation({
    summary: '카테고리 정렬 순서 변경',
    description: '카테고리의 정렬 순서를 일괄 변경합니다.',
  })
  @ApiResponse({ status: 200, description: '카테고리 순서 변경 성공' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async reorderCategories(
    @Req() req: AuthRequest,
    @Body() dto: ReorderCategoriesRequest,
  ) {
    if (!req.user) throw new Error('Missing user');

    this.logger.log(
      `User ${req.user.id} reordering categories for branch ${dto.branchId}`,
    );
    return this.productsService.reorderCategories(
      req.user.id,
      dto.branchId,
      dto.items,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }

  @Patch('categories/:categoryId')
  @ApiOperation({
    summary: '카테고리 수정',
    description: '카테고리의 이름, 정렬순서, 활성상태를 수정합니다.',
  })
  @ApiParam({ name: 'categoryId', description: '카테고리 ID' })
  @ApiResponse({ status: 200, description: '카테고리 수정 성공' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  @ApiResponse({ status: 404, description: '카테고리를 찾을 수 없음' })
  async updateCategory(
    @Req() req: AuthRequest,
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateCategoryRequest,
  ) {
    if (!req.user) throw new Error('Missing user');

    this.logger.log(`User ${req.user.id} updating category ${categoryId}`);
    return this.productsService.updateCategory(
      req.user.id,
      categoryId,
      dto,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }

  @Delete('categories/:categoryId')
  @ApiOperation({
    summary: '카테고리 삭제',
    description:
      '카테고리를 삭제합니다. 해당 카테고리의 상품은 카테고리 없음 상태가 됩니다.',
  })
  @ApiParam({ name: 'categoryId', description: '카테고리 ID' })
  @ApiResponse({ status: 200, description: '카테고리 삭제 성공' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  @ApiResponse({ status: 404, description: '카테고리를 찾을 수 없음' })
  async deleteCategory(
    @Req() req: AuthRequest,
    @Param('categoryId') categoryId: string,
  ) {
    if (!req.user) throw new Error('Missing user');

    this.logger.log(`User ${req.user.id} deleting category ${categoryId}`);
    return this.productsService.deleteCategory(
      req.user.id,
      categoryId,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }

  @Patch('reorder')
  @ApiOperation({
    summary: '상품 정렬 순서 변경',
    description: '상품의 정렬 순서를 일괄 변경합니다.',
  })
  @ApiResponse({ status: 200, description: '상품 순서 변경 성공' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async reorderProducts(
    @Req() req: AuthRequest,
    @Body() dto: ReorderProductsRequest,
  ) {
    if (!req.user) throw new Error('Missing user');

    this.logger.log(
      `User ${req.user.id} reordering products for branch ${dto.branchId}`,
    );
    return this.productsService.reorderProducts(
      req.user.id,
      dto.branchId,
      dto.items,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }

  @Get(':productId')
  @ApiOperation({
    summary: '내 상품 상세 조회',
    description: '내가 멤버로 등록된 지점의 상품 상세 정보를 조회합니다.',
  })
  @ApiParam({ name: 'productId', description: '상품 ID' })
  @ApiResponse({ status: 200, description: '상품 상세 조회 성공' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  @ApiResponse({ status: 404, description: '상품을 찾을 수 없음' })
  async getProduct(
    @Req() req: AuthRequest,
    @Param('productId') productId: string,
  ) {
    if (!req.user) throw new Error('Missing user');

    this.logger.log(`User ${req.user.id} fetching product ${productId}`);
    return this.productsService.getMyProduct(
      req.user.id,
      productId,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }

  @Post()
  @ApiOperation({
    summary: '상품 생성',
    description:
      '내가 OWNER 또는 ADMIN 권한을 가진 지점에 새로운 상품을 생성합니다.',
  })
  @ApiBody({ type: CreateProductRequest })
  @ApiResponse({ status: 201, description: '상품 생성 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async createProduct(
    @Req() req: AuthRequest,
    @Body() dto: CreateProductRequest,
  ) {
    if (!req.user) throw new Error('Missing user');
    if (!dto.branchId) {
      throw new BadRequestException('branchId is required');
    }

    this.logger.log(
      `User ${req.user.id} creating product for branch ${dto.branchId}`,
    );
    return this.productsService.createMyProduct(
      req.user.id,
      dto,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }

  @Patch(':productId')
  @ApiOperation({
    summary: '상품 수정',
    description: '내가 OWNER 또는 ADMIN 권한을 가진 지점의 상품을 수정합니다.',
  })
  @ApiParam({ name: 'productId', description: '상품 ID' })
  @ApiBody({ type: UpdateProductRequest })
  @ApiResponse({ status: 200, description: '상품 수정 성공' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  @ApiResponse({ status: 404, description: '상품을 찾을 수 없음' })
  async updateProduct(
    @Req() req: AuthRequest,
    @Param('productId') productId: string,
    @Body() dto: UpdateProductRequest,
  ) {
    if (!req.user) throw new Error('Missing user');

    this.logger.log(`User ${req.user.id} updating product ${productId}`);
    return this.productsService.updateMyProduct(
      req.user.id,
      productId,
      dto,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }

  @Delete(':productId')
  @ApiOperation({
    summary: '상품 삭제',
    description: '내가 OWNER 또는 ADMIN 권한을 가진 지점의 상품을 삭제합니다.',
  })
  @ApiParam({ name: 'productId', description: '상품 ID' })
  @ApiResponse({ status: 200, description: '상품 삭제 성공' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  @ApiResponse({ status: 404, description: '상품을 찾을 수 없음' })
  async deleteProduct(
    @Req() req: AuthRequest,
    @Param('productId') productId: string,
  ) {
    if (!req.user) throw new Error('Missing user');

    this.logger.log(`User ${req.user.id} deleting product ${productId}`);
    return this.productsService.deleteMyProduct(
      req.user.id,
      productId,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }
}
