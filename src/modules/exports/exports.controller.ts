import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../../common/guards/auth.guard';
import type { AuthRequest } from '../../common/types/auth-request';
import { CreateOrderExportDto } from './dto/create-order-export.dto';
import { ExportsService } from './exports.service';

@ApiTags('exports')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('exports')
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Post('orders')
  @ApiOperation({ summary: 'Create async export job for orders' })
  @ApiResponse({ status: 201, description: 'Export job created' })
  async createOrdersExport(
    @Req() req: AuthRequest,
    @Body() dto: CreateOrderExportDto,
  ): Promise<{ jobId: string }> {
    const userId = req.user?.id ?? req.userId ?? req.profile?.id;
    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user');
    }

    const job = await this.exportsService.createOrderExportJob(userId, dto);

    return { jobId: job.id };
  }

  @Get('orders/:jobId')
  @ApiOperation({ summary: 'Get async export job status for current user' })
  @ApiResponse({ status: 200, description: 'Export job status found' })
  async getOrdersExportStatus(
    @Req() req: AuthRequest,
    @Param('jobId') jobId: string,
  ) {
    const userId = req.user?.id ?? req.userId ?? req.profile?.id;
    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user');
    }

    if (!jobId || !jobId.trim()) {
      throw new BadRequestException('jobId is required');
    }

    const { job, downloadUrl } = await this.exportsService.getOrderExportJob(
      jobId,
      userId,
    );

    return {
      jobId: job.id,
      status: job.status,
      fileName: job.file_name ?? null,
      downloadUrl,
      error: job.error_message ?? null,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      completedAt: job.completed_at ?? null,
      rowCount: job.row_count ?? null,
    };
  }
}
