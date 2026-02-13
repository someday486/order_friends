import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { CreateOrderExportDto } from './dto/create-order-export.dto';

type OrderExportJobRow = {
  id: string;
  user_id: string;
  status: string;
  file_path?: string | null;
  file_name?: string | null;
  error_message?: string | null;
  row_count?: number | null;
  created_at?: string;
  updated_at?: string;
  completed_at?: string | null;
};

type OrderExportSourceRow = {
  id: string;
  order_no?: string | null;
  status?: string | null;
  created_at?: string | null;
  total_amount?: number | null;
  branches?: { name?: string | null } | null;
};

@Injectable()
export class ExportsService {
  private readonly logger = new Logger(ExportsService.name);
  private static readonly EXPORT_BUCKET = 'exports';

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Normalize date inputs for storage/RPC usage.
   * - Date-only (YYYY-MM-DD): start -> 00:00:00.000Z, end -> 23:59:59.999Z
   * - ISO/other parseable strings: toISOString()
   * - null/invalid: null
   */
  private normalizeDateForRpc(value?: string | null, isEnd = false): string | null {
    if (!value) {
      return null;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const date = new Date(`${value}T00:00:00.000Z`);
      if (Number.isNaN(date.getTime())) {
        return null;
      }

      if (isEnd) {
        date.setUTCHours(23, 59, 59, 999);
      }

      return date.toISOString();
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toISOString();
  }

  async createOrderExportJob(
    userId: string,
    dto: CreateOrderExportDto,
  ): Promise<OrderExportJobRow> {
    const sb = this.supabaseService.adminClient();
    const format = dto.format?.toUpperCase();
    const dateStart = this.normalizeDateForRpc(dto.filters?.dateStart, false);
    const dateEnd = this.normalizeDateForRpc(dto.filters?.dateEnd, true);

    if (!['CSV', 'XLSX'].includes(format)) {
      throw new BadRequestException('Invalid format. Allowed values: csv, xlsx');
    }

    const { data, error } = await sb
      .from('order_exports')
      .insert({
        user_id: userId,
        type: 'ORDERS',
        scope: 'DETAIL',
        format,
        status: 'PENDING',
        params: {
          ...(dto.filters ?? {}),
          dateStart,
          dateEnd,
        },
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
      .select('id, user_id, status')
      .eq('id', exportId)
      .maybeSingle<{ id: string; user_id: string; status: string }>();

    if (error) {
      this.logger.error(`Failed to load order export ${exportId}`, error.message);
      throw new InternalServerErrorException('Failed to process export job');
    }

    if (!data) {
      throw new NotFoundException('Export job not found');
    }

    if (['DONE', 'FAILED'].includes(data.status)) {
      return;
    }

    await this.updateOrderExportRow(exportId, {
      status: 'PROCESSING',
      progress_done: 0,
      error_message: null,
    });

    try {
      const orders = await this.fetchOrderRowsForExport();
      const csvContent = this.buildOrdersCsv(orders);
      const timestamp = this.buildTimestamp();
      const fileName = `orders_${timestamp}.csv`;
      const filePath = `orders/${data.user_id}/${exportId}/${fileName}`;

      const { error: uploadError } = await sb.storage
        .from(ExportsService.EXPORT_BUCKET)
        .upload(filePath, Buffer.from(csvContent, 'utf8'), {
          contentType: 'text/csv',
          upsert: true,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      await this.updateOrderExportRow(exportId, {
        status: 'DONE',
        file_path: filePath,
        file_name: fileName,
        row_count: orders.length,
        completed_at: new Date().toISOString(),
      });
    } catch (exportError) {
      const message = exportError instanceof Error ? exportError.message : 'Unknown export error';
      this.logger.error(`Order export ${exportId} failed: ${message}`);

      await this.updateOrderExportRow(exportId, {
        status: 'FAILED',
        error_message: message,
        completed_at: new Date().toISOString(),
      });

      throw new InternalServerErrorException('Failed to process export job');
    }
  }

  async getOrderExportJob(jobId: string, userId: string): Promise<{
    job: OrderExportJobRow;
    downloadUrl: string | null;
  }> {
    const sb = this.supabaseService.adminClient();

    const { data, error } = await sb
      .from('order_exports')
      .select(
        'id, user_id, status, file_path, file_name, error_message, row_count, created_at, updated_at, completed_at',
      )
      .eq('id', jobId)
      .eq('user_id', userId)
      .single<OrderExportJobRow>();

    if (error || !data) {
      throw new NotFoundException('Export job not found');
    }

    let downloadUrl: string | null = null;
    if (data.status === 'DONE' && data.file_path) {
      const { data: signedData, error: signedUrlError } = await sb.storage
        .from(ExportsService.EXPORT_BUCKET)
        .createSignedUrl(data.file_path, 600);

      if (signedUrlError) {
        this.logger.error(
          `Failed to create signed URL for export ${jobId}`,
          signedUrlError.message,
        );
      } else {
        downloadUrl = signedData?.signedUrl ?? null;
      }
    }

    return { job: data, downloadUrl };
  }

  private async fetchOrderRowsForExport(): Promise<
    Array<{
      orderNo: string;
      branchName: string;
      orderedAt: string;
      status: string;
      totalAmount: number;
      itemsSummary: string;
    }>
  > {
    const sb = this.supabaseService.adminClient();

    const { data, error } = await sb
      .from('orders')
      .select('id, order_no, status, created_at, total_amount, branches(name)')
      .order('created_at', { ascending: false })
      .limit(5000);

    if (error) {
      throw new Error(`Failed to fetch orders: ${error.message}`);
    }

    const orderRows = (data ?? []) as OrderExportSourceRow[];
    const orderIds = orderRows.map((row) => row.id);

    const itemSummaryMap = new Map<string, string>();

    if (orderIds.length > 0) {
      const { data: itemsData, error: itemsError } = await sb
        .from('order_items')
        .select('order_id, product_name_snapshot, qty')
        .in('order_id', orderIds);

      if (itemsError) {
        throw new Error(`Failed to fetch order items: ${itemsError.message}`);
      }

      const groupedItems = new Map<
        string,
        Array<{ product_name_snapshot?: string | null; qty?: number | null }>
      >();

      for (const item of itemsData ?? []) {
        const existing = groupedItems.get(item.order_id);
        if (existing) {
          existing.push(item);
          continue;
        }
        groupedItems.set(item.order_id, [item]);
      }

      for (const [orderId, items] of groupedItems.entries()) {
        const summary = items
          .slice(0, 6)
          .map((item) => `${item.product_name_snapshot ?? ''} ${item.qty ?? 0}`.trim())
          .filter(Boolean)
          .join(', ');
        itemSummaryMap.set(orderId, summary);
      }
    }

    return orderRows.map((row) => ({
      orderNo: row.order_no ?? row.id,
      branchName: row.branches?.name ?? '',
      orderedAt: row.created_at ?? '',
      status: row.status ?? '',
      totalAmount: row.total_amount ?? 0,
      itemsSummary: itemSummaryMap.get(row.id) ?? '',
    }));
  }

  private buildOrdersCsv(
    rows: Array<{
      orderNo: string;
      branchName: string;
      orderedAt: string;
      status: string;
      totalAmount: number;
      itemsSummary: string;
    }>,
  ): string {
    const header = [
      'order_no_or_id',
      'branch_name',
      'ordered_at',
      'status',
      'total_amount',
      'items_summary',
    ];

    const lines = [
      this.toCsvLine(header),
      ...rows.map((row) =>
        this.toCsvLine([
          row.orderNo,
          row.branchName,
          row.orderedAt,
          row.status,
          row.totalAmount,
          row.itemsSummary,
        ]),
      ),
    ];

    const noticeLine =
      rows.length >= 5000
        ? '# 안내: 최대 5000건까지만 다운로드됩니다. 조건(기간/지점/검색)을 좁혀 다시 시도하세요.'
        : '';

    return `\uFEFF${[noticeLine, ...lines].filter(Boolean).join('\n')}`;
  }

  private toCsvLine(values: Array<string | number>): string {
    return values
      .map((value) => {
        const raw = String(value ?? '');
        const escaped = raw.replace(/"/g, '""');
        return `"${escaped}"`;
      })
      .join(',');
  }

  private buildTimestamp(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = `${now.getMonth() + 1}`.padStart(2, '0');
    const d = `${now.getDate()}`.padStart(2, '0');
    const hh = `${now.getHours()}`.padStart(2, '0');
    const mm = `${now.getMinutes()}`.padStart(2, '0');
    const ss = `${now.getSeconds()}`.padStart(2, '0');
    return `${y}${m}${d}_${hh}${mm}${ss}`;
  }

  private async updateOrderExportRow(
    exportId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const sb = this.supabaseService.adminClient();

    const { error } = await sb.from('order_exports').update(payload).eq('id', exportId);

    if (!error) {
      return;
    }

    if ('progress_done' in payload && error.message.includes('progress_done')) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.progress_done;

      const { error: fallbackError } = await sb
        .from('order_exports')
        .update(fallbackPayload)
        .eq('id', exportId);

      if (!fallbackError) {
        return;
      }

      throw new InternalServerErrorException(fallbackError.message);
    }

    throw new InternalServerErrorException(error.message);
  }
}
