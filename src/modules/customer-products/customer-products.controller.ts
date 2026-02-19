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
  BulkCreateCategoriesRequest,
  UpdateCategoryRequest,
  ReorderCategoriesRequest,
} from '../../modules/products/dto/category-crud.request';
import {
  ApplyBrandProductTemplateRequest,
  BulkUpdateBrandProductTemplateRequest,
  CreateBrandProductTemplateRequest,
  UpdateBrandProductTemplateRequest,
} from './dto/brand-product-template.request';

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

  @Post('categories/bulk-create')
  @ApiOperation({
    summary: '카테고리 일괄 생성',
    description:
      '선택한 여러 매장에 같은 카테고리를 한 번에 생성합니다. 이미 같은 이름이 있으면 해당 매장은 건너뜁니다.',
  })
  @ApiBody({ type: BulkCreateCategoriesRequest })
  @ApiResponse({ status: 201, description: '카테고리 일괄 생성 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async bulkCreateCategories(
    @Req() req: AuthRequest,
    @Body() dto: BulkCreateCategoriesRequest,
  ) {
    if (!req.user) throw new Error('Missing user');
    if (!dto.branchIds?.length) {
      throw new BadRequestException('branchIds is required');
    }
    if (!dto.name?.trim()) {
      throw new BadRequestException('name is required');
    }

    this.logger.log(
      `User ${req.user.id} bulk creating category "${dto.name}" for ${dto.branchIds.length} branches`,
    );
    return this.productsService.bulkCreateCategories(
      req.user.id,
      dto,
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

  @Patch('bulk-status')
  @ApiOperation({
    summary: '상품 일괄 상태 변경',
    description: '여러 상품의 판매 상태를 일괄 변경합니다.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        branchId: { type: 'string' },
        productIds: { type: 'array', items: { type: 'string' } },
        isActive: { type: 'boolean' },
      },
      required: ['branchId', 'productIds', 'isActive'],
    },
  })
  @ApiResponse({ status: 200, description: '상품 상태 일괄 변경 성공' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async bulkUpdateProductStatus(
    @Req() req: AuthRequest,
    @Body() dto: { branchId: string; productIds: string[]; isActive: boolean },
  ) {
    if (!req.user) throw new Error('Missing user');
    if (!dto.branchId || !dto.productIds?.length) {
      throw new BadRequestException('branchId and productIds are required');
    }

    this.logger.log(
      `User ${req.user.id} bulk updating ${dto.productIds.length} products status`,
    );
    return this.productsService.bulkUpdateProductStatus(
      req.user.id,
      dto.branchId,
      dto.productIds,
      dto.isActive,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }

  @Patch('categories/bulk-status')
  @ApiOperation({
    summary: '카테고리 일괄 활성화/비활성화',
    description: '여러 카테고리의 활성 상태를 일괄 변경합니다.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        branchId: { type: 'string' },
        categoryIds: { type: 'array', items: { type: 'string' } },
        isActive: { type: 'boolean' },
      },
      required: ['branchId', 'categoryIds', 'isActive'],
    },
  })
  @ApiResponse({ status: 200, description: '카테고리 상태 일괄 변경 성공' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async bulkUpdateCategoryStatus(
    @Req() req: AuthRequest,
    @Body() dto: { branchId: string; categoryIds: string[]; isActive: boolean },
  ) {
    if (!req.user) throw new Error('Missing user');
    if (!dto.branchId || !dto.categoryIds?.length) {
      throw new BadRequestException('branchId and categoryIds are required');
    }

    this.logger.log(
      `User ${req.user.id} bulk updating ${dto.categoryIds.length} categories status`,
    );
    return this.productsService.bulkUpdateCategoryStatus(
      req.user.id,
      dto.branchId,
      dto.categoryIds,
      dto.isActive,
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

  @Get('brand-templates')
  @ApiOperation({
    summary: '브랜드 메뉴 템플릿 조회',
    description:
      '브랜드 단위 메뉴 템플릿을 조회하고 지점별 적용 여부를 함께 확인합니다.',
  })
  @ApiQuery({ name: 'brandId', description: '브랜드 ID', required: true })
  @ApiQuery({
    name: 'branchId',
    description: '적용 여부를 확인할 지점 ID',
    required: false,
  })
  @ApiResponse({ status: 200, description: '브랜드 메뉴 템플릿 조회 성공' })
  async getBrandTemplates(
    @Req() req: AuthRequest,
    @Query('brandId') brandId: string,
    @Query('branchId') branchId?: string,
  ) {
    if (!req.user) throw new Error('Missing user');
    if (!brandId) {
      throw new BadRequestException('brandId is required');
    }

    return this.productsService.getBrandProductTemplates(
      req.user.id,
      brandId,
      branchId,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }

  @Post('brand-templates')
  @ApiOperation({
    summary: '브랜드 메뉴 템플릿 생성',
    description: '브랜드 단위 메뉴를 등록합니다.',
  })
  @ApiBody({ type: CreateBrandProductTemplateRequest })
  @ApiResponse({ status: 201, description: '브랜드 메뉴 템플릿 생성 성공' })
  async createBrandTemplate(
    @Req() req: AuthRequest,
    @Body() dto: CreateBrandProductTemplateRequest,
  ) {
    if (!req.user) throw new Error('Missing user');
    if (!dto.brandId) {
      throw new BadRequestException('brandId is required');
    }

    return this.productsService.createBrandProductTemplate(
      req.user.id,
      dto,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }

  @Patch('brand-templates/:templateId')
  @ApiOperation({
    summary: '브랜드 메뉴 템플릿 수정',
    description: '브랜드 단위 메뉴 템플릿을 수정합니다.',
  })
  @ApiParam({ name: 'templateId', description: '브랜드 메뉴 템플릿 ID' })
  @ApiBody({ type: UpdateBrandProductTemplateRequest })
  @ApiResponse({ status: 200, description: '브랜드 메뉴 템플릿 수정 성공' })
  async updateBrandTemplate(
    @Req() req: AuthRequest,
    @Param('templateId') templateId: string,
    @Body() dto: UpdateBrandProductTemplateRequest,
  ) {
    if (!req.user) throw new Error('Missing user');

    return this.productsService.updateBrandProductTemplate(
      req.user.id,
      templateId,
      dto,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }

  @Patch('brand-templates/bulk/update')
  @ApiOperation({
    summary: '브랜드 메뉴 일괄 수정',
    description:
      '선택한 브랜드 메뉴들의 활성 상태 또는 매장 체크 상태를 한 번에 변경합니다.',
  })
  @ApiBody({ type: BulkUpdateBrandProductTemplateRequest })
  @ApiResponse({ status: 200, description: '브랜드 메뉴 일괄 수정 성공' })
  async bulkUpdateBrandTemplates(
    @Req() req: AuthRequest,
    @Body() dto: BulkUpdateBrandProductTemplateRequest,
  ) {
    if (!req.user) throw new Error('Missing user');
    if (!dto.brandId) {
      throw new BadRequestException('brandId is required');
    }
    if (!dto.templateIds?.length) {
      throw new BadRequestException('templateIds is required');
    }

    return this.productsService.bulkUpdateBrandProductTemplates(
      req.user.id,
      dto,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }

  @Delete('brand-templates/:templateId')
  @ApiOperation({
    summary: '브랜드 메뉴 템플릿 비활성화',
    description:
      '브랜드 메뉴 템플릿을 비활성화하고 연결된 지점 메뉴를 숨김 처리합니다.',
  })
  @ApiParam({ name: 'templateId', description: '브랜드 메뉴 템플릿 ID' })
  @ApiResponse({ status: 200, description: '브랜드 메뉴 템플릿 비활성화 성공' })
  async deleteBrandTemplate(
    @Req() req: AuthRequest,
    @Param('templateId') templateId: string,
  ) {
    if (!req.user) throw new Error('Missing user');

    return this.productsService.deleteBrandProductTemplate(
      req.user.id,
      templateId,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }

  @Post('brand-templates/:templateId/apply')
  @ApiOperation({
    summary: '브랜드 메뉴를 지점에 적용',
    description: '선택한 브랜드 메뉴 템플릿을 지점 상품으로 등록합니다.',
  })
  @ApiParam({ name: 'templateId', description: '브랜드 메뉴 템플릿 ID' })
  @ApiBody({ type: ApplyBrandProductTemplateRequest })
  @ApiResponse({ status: 200, description: '브랜드 메뉴 지점 적용 성공' })
  async applyBrandTemplateToBranch(
    @Req() req: AuthRequest,
    @Param('templateId') templateId: string,
    @Body() dto: ApplyBrandProductTemplateRequest,
  ) {
    if (!req.user) throw new Error('Missing user');
    if (!dto.branchId) {
      throw new BadRequestException('branchId is required');
    }

    return this.productsService.applyBrandTemplateToBranch(
      req.user.id,
      templateId,
      dto.branchId,
      req.brandMemberships || [],
      req.branchMemberships || [],
    );
  }

  @Post('brand-templates/:templateId/unapply')
  @ApiOperation({
    summary: '브랜드 메뉴를 지점에서 해제',
    description: '선택한 브랜드 메뉴 템플릿을 해당 지점에서 숨김 처리합니다.',
  })
  @ApiParam({ name: 'templateId', description: '브랜드 메뉴 템플릿 ID' })
  @ApiBody({ type: ApplyBrandProductTemplateRequest })
  @ApiResponse({ status: 200, description: '브랜드 메뉴 지점 해제 성공' })
  async unapplyBrandTemplateFromBranch(
    @Req() req: AuthRequest,
    @Param('templateId') templateId: string,
    @Body() dto: ApplyBrandProductTemplateRequest,
  ) {
    if (!req.user) throw new Error('Missing user');
    if (!dto.branchId) {
      throw new BadRequestException('branchId is required');
    }

    return this.productsService.unapplyBrandTemplateFromBranch(
      req.user.id,
      templateId,
      dto.branchId,
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
