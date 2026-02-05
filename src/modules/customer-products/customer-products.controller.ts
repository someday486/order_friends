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
