import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { ExportsQueue } from './exports.queue';

type OrderExportJobRow = {
  id: string;
  user_id: string;
  status: string;
  created_at?: string;
  updated_at?: string;
};

@Injectable()
export class ExportsService {
  private readonly logger = new Logger(ExportsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly exportsQueue: ExportsQueue,
  ) {}

  async createOrderExportJob(userId: string): Promise<OrderExportJobRow> {
    const sb = this.supabaseService.adminClient();
    const { data, error } = await sb
      .from('order_exports')
      .insert({
        user_id: userId,
        status: 'PENDING',
      })
      .select('id, user_id, status, created_at, updated_at')
      .single();

    if (error || !data) {
      this.logger.error('Failed to create order export job row', error?.message);
      throw new InternalServerErrorException('Failed to create export job');
    }

    try {
      await this.exportsQueue.enqueueOrderExport({
        jobId: data.id,
        userId: data.user_id,
      });
    } catch (error) {
      this.logger.error(
        `Failed to enqueue order export job ${data.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    return data;
  }

  async getOrderExportJob(jobId: string, userId: string): Promise<OrderExportJobRow> {
    const sb = this.supabaseService.adminClient();

    const { data, error } = await sb
      .from('order_exports')
      .select('id, user_id, status, created_at, updated_at')
      .eq('id', jobId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Export job not found');
    }

    return data;
  }
}
