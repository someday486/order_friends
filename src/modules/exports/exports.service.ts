import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';

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

  constructor(private readonly supabaseService: SupabaseService) {}

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

    await this.processOrderExport(data.id);

    return data;
  }

  async processOrderExport(exportId: string): Promise<void> {
    const sb = this.supabaseService.adminClient();

    const { data, error } = await sb
      .from('order_exports')
      .select('id, status')
      .eq('id', exportId)
      .maybeSingle<{ id: string; status: string }>();

    if (error) {
      this.logger.error(`Failed to load order export ${exportId}`, error.message);
      throw new InternalServerErrorException('Failed to process export job');
    }

    if (!data) {
      throw new NotFoundException('Export job not found');
    }

    const { error: processingError } = await sb
      .from('order_exports')
      .update({ status: 'PROCESSING' })
      .eq('id', exportId);

    if (processingError) {
      this.logger.error(
        `Failed to update order export ${exportId} to PROCESSING`,
        processingError.message,
      );
      throw new InternalServerErrorException('Failed to process export job');
    }

    // TODO: Generate export file and upload to storage.

    const { error: doneError } = await sb
      .from('order_exports')
      .update({ status: 'DONE' })
      .eq('id', exportId);

    if (doneError) {
      this.logger.error(`Failed to update order export ${exportId} to DONE`, doneError.message);
      throw new InternalServerErrorException('Failed to process export job');
    }
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
