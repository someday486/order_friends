import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import {
  ORDER_EXPORT_JOB_NAME,
  ORDER_EXPORT_QUEUE_NAME,
  OrderExportQueuePayload,
} from './exports.constants';

type BullMqModule = {
  Queue: new (name: string, options: { connection: { url: string } }) => any;
  Worker: new (
    name: string,
    processor: (job: { data: OrderExportQueuePayload; id?: string }) => Promise<void>,
    options: { connection: { url: string } },
  ) => any;
};

@Injectable()
export class ExportsQueue implements OnModuleDestroy {
  private readonly logger = new Logger(ExportsQueue.name);
  private readonly queue: any;
  private readonly worker: any;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.logger.warn(
        'REDIS_URL is missing; order export queue and worker are disabled.',
      );
      this.queue = null;
      this.worker = null;
      return;
    }

    const bullmq = this.loadBullMq();
    if (!bullmq) {
      this.logger.warn(
        'bullmq package is not installed; order export queue and worker are disabled.',
      );
      this.queue = null;
      this.worker = null;
      return;
    }

    const connection = { url: redisUrl };
    this.queue = new bullmq.Queue(ORDER_EXPORT_QUEUE_NAME, { connection });

    this.worker = new bullmq.Worker(
      ORDER_EXPORT_QUEUE_NAME,
      async (job: { data: OrderExportQueuePayload }) => {
        const { error } = await this.supabaseService
          .adminClient()
          .from('order_exports')
          .update({ status: 'PROCESSING' })
          .eq('id', job.data.jobId)
          .eq('user_id', job.data.userId);

        if (error) {
          this.logger.error(
            `Failed to set order export ${job.data.jobId} to PROCESSING`,
            error.message,
          );
          throw new Error(error.message);
        }

        // TODO: Generate export file and upload to storage.
      },
      { connection },
    );

    this.worker.on('failed', (job: { id?: string } | undefined, error: Error) => {
      this.logger.error(
        `Order export job failed (${job?.id ?? 'unknown'})`,
        error.stack,
      );
    });
  }

  private loadBullMq(): BullMqModule | null {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('bullmq') as BullMqModule;
    } catch {
      return null;
    }
  }

  async enqueueOrderExport(payload: OrderExportQueuePayload): Promise<void> {
    if (!this.queue) {
      this.logger.warn(
        `Skipping enqueue for order export ${payload.jobId}: queue disabled.`,
      );
      return;
    }

    await this.queue.add(ORDER_EXPORT_JOB_NAME, payload, {
      removeOnComplete: 100,
      removeOnFail: 100,
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }

    if (this.queue) {
      await this.queue.close();
    }
  }
}
