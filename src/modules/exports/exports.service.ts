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
  format?: string;
  params?: Record<string, any>;
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
      throw new BadRequestException(
        'Invalid format. Allowed values: csv, xlsx',
      );
    }

    // XLSX not supported yet
    if (format === 'XLSX') {
      throw new BadRequestException(
        'XLSX format not supported yet. Please use CSV.',
      );
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
      this.logger.error(
        'Failed to create order export job row',
        error?.message,
      );
      throw new InternalServerErrorException('Failed to create export job');
    }

    await this.processOrderExport(data.id);

    return data;
  }

  async processOrderExport(exportId: string): Promise<void> {
    const sb = this.supabaseService.adminClient();

    // Load full export row including params and format
    const { data, error } = await sb
      .from('order_exports')
      .select('id, user_id, status, format, params')
      .eq('id', exportId)
      .maybeSingle<OrderExportJobRow>();

    if (error) {
      this.logger.error(
        `Failed to load order export ${exportId}`,
        error.message,
      );
      throw new InternalServerErrorException('Failed to process export job');
    }

    if (!data) {
      throw new NotFoundException('Export job not found');
    }

    if (['DONE', 'FAILED'].includes(data.status)) {
      return;
    }

    // Check format - only CSV supported
    if (data.format === 'XLSX') {
      await this.updateOrderExportRow(exportId, {
        status: 'FAILED',
        error_message: 'XLSX format not supported yet',
        completed_at: new Date().toISOString(),
      });
      throw new BadRequestException('XLSX format not supported yet');
    }

    await this.updateOrderExportRow(exportId, {
      status: 'PROCESSING',
      progress_done: 0,
      error_message: null,
    });

    try {
      // Extract filters from params
      const filters = data.params ?? {};
      const {
        branchId,
        status: statusFilter,
        dateStart,
        dateEnd,
        search,
        sort,
      } = filters;

      // Get accessible branch IDs
      const accessibleBranchIds = await this.getAccessibleBranchIds(
        data.user_id,
      );

      // Filter branches if branchId specified
      let targetBranchIds = accessibleBranchIds;
      if (branchId) {
        if (accessibleBranchIds.includes(branchId)) {
          targetBranchIds = [branchId];
        } else {
          throw new Error('User does not have access to specified branch');
        }
      }

      // Prepare RPC parameters
      const rpcParams = {
        p_branch_ids: targetBranchIds,
        p_status: statusFilter ?? null,
        p_date_start: dateStart ?? null,
        p_date_end: dateEnd ?? null,
        p_search: search ?? null,
        p_sort: sort ?? 'DESC',
        p_limit: 5000,
        p_offset: 0,
      };

      this.logger.log(
        `Calling export_orders_detail RPC with params: ${JSON.stringify(rpcParams)}`,
      );

      // Call RPC export_orders_detail
      const { data: rpcData, error: rpcError } = await sb.rpc(
        'export_orders_detail',
        rpcParams,
      );

      if (rpcError) {
        throw new Error(`RPC export_orders_detail failed: ${rpcError.message}`);
      }

      const orders = (rpcData ?? []) as any[];
      this.logger.log(`RPC returned ${orders.length} orders`);

      // Generate CSV
      const csvContent = this.buildFullDetailCsv(orders);
      const timestamp = this.buildTimestamp();
      const fileName = `orders_detail_${timestamp}.csv`;
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
      const message =
        exportError instanceof Error
          ? exportError.message
          : 'Unknown export error';
      this.logger.error(`Order export ${exportId} failed: ${message}`);

      await this.updateOrderExportRow(exportId, {
        status: 'FAILED',
        error_message: message,
        completed_at: new Date().toISOString(),
      });

      throw new InternalServerErrorException('Failed to process export job');
    }
  }

  async getOrderExportJob(
    jobId: string,
    userId: string,
  ): Promise<{
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

  /**
   * Get all accessible branch IDs for a user
   * Includes direct branch memberships and all branches from brand memberships
   */
  private async getAccessibleBranchIds(userId: string): Promise<string[]> {
    const sb = this.supabaseService.adminClient();

    // Get user's profile to check if system admin
    const { data: profile } = await sb
      .from('profiles')
      .select('is_system_admin')
      .eq('id', userId)
      .single();

    // System admins have access to all branches
    if (profile?.is_system_admin) {
      const { data: allBranches } = await sb.from('branches').select('id');
      return (allBranches ?? []).map((b) => b.id);
    }

    const branchIds = new Set<string>();

    // Get direct branch memberships
    const { data: branchMembers } = await sb
      .from('branch_members')
      .select('branch_id')
      .eq('user_id', userId);

    if (branchMembers) {
      for (const m of branchMembers) {
        branchIds.add(m.branch_id);
      }
    }

    // Get brand memberships (brand owners)
    const { data: brands } = await sb
      .from('brands')
      .select('id')
      .eq('owner_user_id', userId);

    if (brands && brands.length > 0) {
      const brandIds = brands.map((b) => b.id);
      const { data: brandBranches } = await sb
        .from('branches')
        .select('id')
        .in('brand_id', brandIds);

      if (brandBranches) {
        for (const b of brandBranches) {
          branchIds.add(b.id);
        }
      }
    }

    return Array.from(branchIds);
  }

  /**
   * Format timestamp to YYYY-MM-DD HH:mm
   */
  private formatYmdHm(value?: string | null): string {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 16).replace('T', ' ');
  }

  /**
   * Build 20-column CSV for full detail export with Korean headers
   */
  private buildFullDetailCsv(rows: any[]): string {
    const headers = [
      '주문번호',
      '주문ID',
      '지점명',
      '지점ID',
      '주문일시',
      '상태',
      '총액',
      '상품금액',
      '배송비',
      '할인',
      '결제수단',
      '고객명',
      '연락처',
      '이메일',
      '수령방식',
      '요청시간',
      '주소',
      '우편번호',
      '요청사항',
      '상품상세',
    ];

    const lines: string[] = [];
    lines.push(this.toCsvLine(headers));

    for (const r of rows ?? []) {
      const orderId = r.order_id ?? r.id ?? '';
      const orderNo =
        r.order_no ??
        r.order_number ??
        (typeof orderId === 'string' && orderId ? orderId.slice(0, 8) : '');

      const record = [
        orderNo, // 1 주문번호
        orderId, // 2 주문ID
        r.branch_name ?? '', // 3 지점명
        r.branch_id ?? '', // 4 지점ID
        this.formatYmdHm(r.created_at ?? null), // 5 주문일시
        r.status ?? '', // 6 상태
        r.total_amount ?? '', // 7 총액
        r.subtotal ?? '', // 8 상품금액
        r.delivery_fee ?? '', // 9 배송비
        r.discount_total ?? '', // 10 할인
        r.payment_method ?? '', // 11 결제수단
        r.customer_name ?? '', // 12 고객명
        r.customer_phone ?? '', // 13 연락처
        r.customer_email ?? '', // 14 이메일
        r.fulfillment_type ?? '', // 15 수령방식
        this.formatYmdHm(r.requested_time ?? null), // 16 요청시간
        r.delivery_address ?? '', // 17 주소
        r.delivery_postcode ?? '', // 18 우편번호
        r.delivery_memo ?? '', // 19 요청사항
        r.items_summary ?? '', // 20 상품상세
      ];

      lines.push(this.toCsvLine(record));
    }

    return `\uFEFF${lines.join('\n')}`;
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
          .map((item) =>
            `${item.product_name_snapshot ?? ''} ${item.qty ?? 0}`.trim(),
          )
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

    const { error } = await sb
      .from('order_exports')
      .update(payload)
      .eq('id', exportId);

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
