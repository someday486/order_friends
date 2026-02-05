import {
  Controller,
  Post,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Body,
  BadRequestException,
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
import { AdminGuard } from '../../common/guards/admin.guard';
import { UploadService } from './upload.service';

@ApiTags('upload')
@ApiBearerAuth()
@Controller('upload')
@UseGuards(AuthGuard, AdminGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('image')
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
