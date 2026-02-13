import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/guards/auth.guard';
import type { AuthRequest } from '../../common/types/auth-request';
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
  async createOrdersExport(@Req() req: AuthRequest) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user');
    }

    return this.exportsService.createOrderExportJob(userId);
  }

  @Get('orders/:jobId')
  @ApiOperation({ summary: 'Get async export job status for current user' })
  @ApiResponse({ status: 200, description: 'Export job status found' })
  async getOrdersExportStatus(
    @Req() req: AuthRequest,
    @Param('jobId') jobId: string,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user');
    }

    if (!jobId || !jobId.trim()) {
      throw new BadRequestException('jobId is required');
    }

    return this.exportsService.getOrderExportJob(jobId, userId);
  }
}
