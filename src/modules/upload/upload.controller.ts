import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Req,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Body,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '../../common/guards/auth.guard';
import { UploadService } from './upload.service';
import { UserRateLimit } from '../../common/decorators/user-rate-limit.decorator';
import type { AuthRequest } from '../../common/types/auth-request';
import {
  CreateBusinessOrderImportBatchDto,
  UpdateBusinessOrderImportBatchStatusDto,
} from './dto/business-order-import.dto';

@ApiTags('upload')
@ApiBearerAuth()
@Controller('upload')
@UseGuards(AuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Get('business-order-imports')
  @UserRateLimit({ points: 60, duration: 60 })
  @ApiOperation({
    summary: '업로드한 B2B 주문서 목록 조회',
    description:
      '현재 로그인한 사용자의 주문서 업로드 배치를 최신순으로 조회합니다.',
  })
  @ApiResponse({ status: 200, description: '주문서 목록 조회 성공' })
  async listBusinessOrderImports(@Req() req: AuthRequest) {
    const userId = req.user?.id ?? req.userId ?? req.profile?.id;
    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user');
    }

    return this.uploadService.listBusinessOrderImportBatches(userId);
  }

  @Get('business-order-imports/:batchId')
  @UserRateLimit({ points: 60, duration: 60 })
  @ApiOperation({
    summary: '업로드한 B2B 주문서 상세 조회',
    description: '현재 로그인한 사용자의 특정 주문서 업로드 배치를 조회합니다.',
  })
  @ApiResponse({ status: 200, description: '주문서 상세 조회 성공' })
  async getBusinessOrderImport(
    @Req() req: AuthRequest,
    @Param('batchId') batchId: string,
  ) {
    const userId = req.user?.id ?? req.userId ?? req.profile?.id;
    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user');
    }

    if (!batchId?.trim()) {
      throw new BadRequestException('batchId is required');
    }

    return this.uploadService.getBusinessOrderImportBatch(userId, batchId);
  }

  @Post('business-order-imports')
  @UserRateLimit({ points: 20, duration: 60 })
  @ApiOperation({
    summary: 'B2B 주문서 업로드 배치 저장',
    description:
      '엑셀/CSV 검증 완료 후 주문서 업로드 결과를 서버에 저장합니다.',
  })
  @ApiResponse({ status: 201, description: '주문서 업로드 저장 성공' })
  async createBusinessOrderImport(
    @Req() req: AuthRequest,
    @Body() dto: CreateBusinessOrderImportBatchDto,
  ) {
    const userId = req.user?.id ?? req.userId ?? req.profile?.id;
    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user');
    }

    return this.uploadService.createBusinessOrderImportBatch(userId, dto);
  }

  @Patch('business-order-imports/:batchId/status')
  @UserRateLimit({ points: 30, duration: 60 })
  @ApiOperation({
    summary: 'B2B 주문서 업로드 상태 변경',
    description: '주문서 초안의 진행 상태를 변경합니다.',
  })
  @ApiResponse({ status: 200, description: '주문서 상태 변경 성공' })
  async updateBusinessOrderImportStatus(
    @Req() req: AuthRequest,
    @Param('batchId') batchId: string,
    @Body() dto: UpdateBusinessOrderImportBatchStatusDto,
  ) {
    const userId = req.user?.id ?? req.userId ?? req.profile?.id;
    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user');
    }

    if (!batchId?.trim()) {
      throw new BadRequestException('batchId is required');
    }

    return this.uploadService.updateBusinessOrderImportBatchStatus(
      userId,
      batchId,
      dto.status,
    );
  }

  @Delete('business-order-imports/:batchId')
  @UserRateLimit({ points: 20, duration: 60 })
  @ApiOperation({
    summary: 'B2B 주문서 업로드 배치 삭제',
    description: '현재 로그인한 사용자의 주문서 업로드 배치를 삭제합니다.',
  })
  @ApiResponse({ status: 200, description: '주문서 삭제 성공' })
  async deleteBusinessOrderImport(
    @Req() req: AuthRequest,
    @Param('batchId') batchId: string,
  ) {
    const userId = req.user?.id ?? req.userId ?? req.profile?.id;
    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user');
    }

    if (!batchId?.trim()) {
      throw new BadRequestException('batchId is required');
    }

    await this.uploadService.deleteBusinessOrderImportBatch(userId, batchId);
    return { message: 'Business order import deleted successfully' };
  }

  @Post('image')
  @UserRateLimit({ points: 20, duration: 60 }) // 20 uploads per minute
  @ApiOperation({
    summary: '이미지 업로드',
    description: '단일 이미지를 업로드합니다.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        folder: {
          type: 'string',
          description: '저장할 폴더 (선택사항)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: '이미지 업로드 성공',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        path: { type: 'string' },
        bucket: { type: 'string' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('folder') folder?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return this.uploadService.uploadImage(file, folder || 'general');
  }

  @Post('images')
  @UserRateLimit({ points: 10, duration: 60 }) // 10 batch uploads per minute
  @ApiOperation({
    summary: '다중 이미지 업로드',
    description: '여러 이미지를 한번에 업로드합니다.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
        folder: {
          type: 'string',
          description: '저장할 폴더 (선택사항)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: '이미지 업로드 성공',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          path: { type: 'string' },
          bucket: { type: 'string' },
        },
      },
    },
  })
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadMultipleImages(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('folder') folder?: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    return this.uploadService.uploadMultipleImages(files, folder || 'general');
  }

  @Delete('image')
  @UserRateLimit({ points: 30, duration: 60 }) // 30 deletes per minute
  @ApiOperation({
    summary: '이미지 삭제',
    description: '업로드된 이미지를 삭제합니다.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '삭제할 이미지 경로',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: '이미지 삭제 성공' })
  async deleteImage(@Body('path') path: string) {
    if (!path) {
      throw new BadRequestException('Image path is required');
    }

    await this.uploadService.deleteImage(path);
    return { message: 'Image deleted successfully' };
  }

  @Delete('images')
  @UserRateLimit({ points: 10, duration: 60 }) // 10 batch deletes per minute
  @ApiOperation({
    summary: '다중 이미지 삭제',
    description: '여러 이미지를 한번에 삭제합니다.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        paths: {
          type: 'array',
          items: { type: 'string' },
          description: '삭제할 이미지 경로 배열',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: '이미지 삭제 성공' })
  async deleteMultipleImages(@Body('paths') paths: string[]) {
    if (!paths || paths.length === 0) {
      throw new BadRequestException('Image paths are required');
    }

    await this.uploadService.deleteMultipleImages(paths);
    return { message: `${paths.length} images deleted successfully` };
  }
}
