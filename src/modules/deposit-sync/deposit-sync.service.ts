import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import {
  getKstDayUtcRange,
  isIncomingDepositRow,
  normalizeDepositorName,
  parseSheetAmount,
  parseSheetDateTime,
} from './deposit-sync.util';

type SheetDepositRow = {
  branchId: string | null;
  spreadsheetId: string;
  sheetName: string;
  rowNumber: number;
  depositDate: string;
  depositedAt: string;
  amount: number;
  depositorName: string | null;
  depositorNameNormalized: string | null;
  sourceNumber: string | null;
  rawText: string | null;
};

type PendingDepositRow = {
  id: string;
  branch_id: string | null;
  spreadsheet_id: string;
  sheet_name: string;
  deposit_date: string;
  amount: number;
  depositor_name: string | null;
  depositor_name_normalized: string | null;
  row_number: number;
  match_status: string;
};

type CandidateOrder = {
  id: string;
  branch_id: string;
  status: string;
  customer_name: string | null;
};

type PaymentInfo = {
  method: string | null;
  status: string | null;
};

type DepositTarget = {
  spreadsheetId: string;
  sheetName: string;
  branchIds: string[];
};

@Injectable()
export class DepositSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DepositSyncService.name);
  private intervalId: NodeJS.Timeout | null = null;
  private syncInFlight = false;

  constructor(private readonly supabase: SupabaseService) {}

  onModuleInit() {
    if (!this.isEnabled()) {
      this.logger.log('Deposit sync is disabled.');
      return;
    }

    setTimeout(() => {
      void this.syncAndMatchOnce();
    }, 5000);

    const intervalMs = this.getPollIntervalMs();
    this.intervalId = setInterval(() => {
      void this.syncAndMatchOnce();
    }, intervalMs);

    this.logger.log(`Deposit sync enabled (poll=${intervalMs}ms).`);
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async syncAndMatchOnce(): Promise<void> {
    if (!this.isEnabled() || this.syncInFlight) {
      return;
    }

    this.syncInFlight = true;
    try {
      const targets = await this.getDepositTargets();
      if (targets.length === 0) {
        return;
      }

      const rows = await this.fetchDepositRows(targets);
      if (rows.length > 0) {
        await this.upsertDepositRows(rows);
      }
      await this.matchPendingDepositRows(targets);
    } catch (error) {
      this.logger.error('Deposit sync failed', error);
    } finally {
      this.syncInFlight = false;
    }
  }

  private isEnabled(): boolean {
    const flag = process.env.DEPOSIT_AUTO_MATCH_ENABLED;
    if (flag && ['false', '0', 'no'].includes(flag.trim().toLowerCase())) {
      return false;
    }

    return true;
  }

  private getPollIntervalMs(): number {
    const raw = Number(process.env.DEPOSIT_AUTO_MATCH_POLL_INTERVAL_MS);
    if (Number.isFinite(raw) && raw >= 10000) {
      return raw;
    }

    return 60000;
  }

  private async getDepositTargets(): Promise<DepositTarget[]> {
    const sb = this.supabase.adminClient();
    const { data, error } = await sb
      .from('branches')
      .select('id, deposit_sheet_name, deposit_sheet_url')
      .not('deposit_sheet_name', 'is', null);

    if (error) {
      throw new Error(
        `Failed to fetch branch deposit sheet settings: ${error.message}`,
      );
    }

    const deduped = new Map<string, DepositTarget>();
    for (const row of (data ?? []) as Array<{
      id: string;
      deposit_sheet_name?: string | null;
      deposit_sheet_url?: string | null;
    }>) {
      const sheetName = row.deposit_sheet_name?.trim();
      const spreadsheetId = this.extractSpreadsheetId(row.deposit_sheet_url);
      if (!sheetName || !spreadsheetId) {
        continue;
      }

      const dedupeKey = `${spreadsheetId}::${sheetName}`;
      const existing = deduped.get(dedupeKey);
      if (existing) {
        existing.branchIds.push(row.id);
        continue;
      }

      deduped.set(dedupeKey, {
        spreadsheetId,
        sheetName,
        branchIds: [row.id],
      });
    }

    for (const target of deduped.values()) {
      if (target.branchIds.length > 1) {
        this.logger.warn(
          `Shared deposit sheet mapping detected for "${target.sheetName}" in spreadsheet "${target.spreadsheetId}" across ${target.branchIds.length} branches. Deposit rows will be matched across those branches.`,
        );
      }
    }

    return Array.from(deduped.values());
  }

  private extractSpreadsheetId(url: string | null | undefined): string | null {
    const trimmed = url?.trim();
    if (!trimmed) {
      return null;
    }

    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match?.[1]) {
      return match[1];
    }

    if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
      return trimmed;
    }

    this.logger.warn(`Invalid deposit sheet URL configured: ${trimmed}`);
    return null;
  }

  private buildPublicSheetCsvUrl(
    spreadsheetId: string,
    sheetName: string,
  ): string {
    const params = new URLSearchParams({
      tqx: 'out:csv',
      sheet: sheetName,
    });

    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?${params.toString()}`;
  }

  private parseCsvRows(csvText: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;
    const normalized = csvText.replace(/^\uFEFF/, '');

    for (let i = 0; i < normalized.length; i += 1) {
      const char = normalized[i];
      const nextChar = normalized[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentCell += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === ',' && !inQuotes) {
        currentRow.push(currentCell);
        currentCell = '';
        continue;
      }

      if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i += 1;
        }
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
        continue;
      }

      currentCell += char;
    }

    if (currentCell.length > 0 || currentRow.length > 0) {
      currentRow.push(currentCell);
      rows.push(currentRow);
    }

    return rows
      .map((row) => row.map((cell) => cell.trim()))
      .filter((row) => row.some((cell) => cell.length > 0));
  }

  private async fetchDepositRows(
    targets: DepositTarget[],
  ): Promise<SheetDepositRow[]> {
    if (targets.length === 0) {
      return [];
    }

    const allRows: SheetDepositRow[] = [];

    for (const target of targets) {
      const response = await fetch(
        this.buildPublicSheetCsvUrl(target.spreadsheetId, target.sheetName),
      );

      if (!response.ok) {
        this.logger.warn(
          `Failed to fetch public deposit sheet (${response.status}) for ${target.sheetName}`,
        );
        continue;
      }

      const csvText = await response.text();
      const values = this.parseCsvRows(csvText);
      if (values.length === 0) {
        continue;
      }

      const parsedRows = values.slice(1).map((row, index) => {
        const dateInfo = parseSheetDateTime(row[0]);
        const amount = parseSheetAmount(row[3]);
        const rawText = row[2]?.trim() || null;

        if (!dateInfo || amount === null || !isIncomingDepositRow(rawText)) {
          return null;
        }

        return {
          branchId: target.branchIds.length === 1 ? target.branchIds[0] : null,
          spreadsheetId: target.spreadsheetId,
          sheetName: target.sheetName,
          rowNumber: index + 2,
          depositDate: dateInfo.depositDate,
          depositedAt: dateInfo.depositedAt,
          amount,
          depositorName: row[4]?.trim() || null,
          depositorNameNormalized: normalizeDepositorName(row[4]),
          sourceNumber: row[1]?.trim() || null,
          rawText,
        };
      });

      const validRows = parsedRows.filter(
        (row): row is SheetDepositRow => row !== null,
      );

      allRows.push(...validRows);
    }

    return allRows;
  }

  private async upsertDepositRows(rows: SheetDepositRow[]): Promise<void> {
    const sb = this.supabase.adminClient();
    const payload = rows.map((row) => ({
      branch_id: row.branchId,
      spreadsheet_id: row.spreadsheetId,
      sheet_name: row.sheetName,
      row_number: row.rowNumber,
      deposit_date: row.depositDate,
      deposited_at: row.depositedAt,
      amount: row.amount,
      depositor_name: row.depositorName,
      depositor_name_normalized: row.depositorNameNormalized,
      source_number: row.sourceNumber,
      raw_text: row.rawText,
    }));

    const { error } = await sb.from('deposit_match_rows').upsert(payload, {
      onConflict: 'spreadsheet_id,sheet_name,row_number',
    });

    if (error) {
      throw new Error(`Failed to upsert deposit rows: ${error.message}`);
    }
  }

  private buildSheetBranchIdsMap(
    targets: DepositTarget[],
  ): Map<string, string[]> {
    return new Map(
      targets.map((target) => [
        `${target.spreadsheetId}::${target.sheetName}`,
        [...target.branchIds],
      ]),
    );
  }

  private async matchPendingDepositRows(
    targets: DepositTarget[],
  ): Promise<void> {
    const sb = this.supabase.adminClient();
    const sheetBranchIdsMap = this.buildSheetBranchIdsMap(targets);
    const { data, error } = await sb
      .from('deposit_match_rows')
      .select(
        'id, branch_id, spreadsheet_id, sheet_name, row_number, deposit_date, amount, depositor_name, depositor_name_normalized, match_status',
      )
      .eq('match_status', 'PENDING')
      .order('deposit_date', { ascending: true })
      .order('row_number', { ascending: true })
      .limit(200);

    if (error) {
      throw new Error(`Failed to fetch pending deposit rows: ${error.message}`);
    }

    for (const row of (data ?? []) as PendingDepositRow[]) {
      await this.matchPendingRow(row, sheetBranchIdsMap);
    }
  }

  private async matchPendingRow(
    row: PendingDepositRow,
    sheetBranchIdsMap: Map<string, string[]>,
  ): Promise<void> {
    if (!row.depositor_name_normalized) {
      return;
    }

    const sheetKey = `${row.spreadsheet_id}::${row.sheet_name}`;
    const configuredBranchIds = sheetBranchIdsMap.get(sheetKey) ?? [];
    const candidateBranchIds = Array.from(
      new Set([
        ...configuredBranchIds,
        ...(row.branch_id ? [row.branch_id] : []),
      ]),
    );

    if (candidateBranchIds.length === 0) {
      return;
    }

    const candidates = await this.findCandidateOrders({
      branch_ids: candidateBranchIds,
      deposit_date: row.deposit_date,
      amount: row.amount,
      depositor_name_normalized: row.depositor_name_normalized,
    });

    if (candidates.length !== 1) {
      return;
    }

    const order = candidates[0];
    const sb = this.supabase.adminClient();
    const updatedOrder = await this.transitionOrderToPreparing(order);
    if (!updatedOrder) {
      this.logger.error(`Failed to auto-match deposit row ${row.row_number}`);
      return;
    }

    await this.markPaymentAsMatched(order.id);

    await sb.from('order_status_history').insert({
      order_id: order.id,
      from_status: order.status,
      to_status: 'PREPARING',
      note: `자동 입금 확인 매칭 (입금자: ${row.depositor_name ?? '-'}, 금액: ${row.amount})`,
    });

    const { error: rowUpdateError } = await sb
      .from('deposit_match_rows')
      .update({
        match_status: 'MATCHED',
        branch_id: order.branch_id,
        matched_order_id: order.id,
        matched_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('match_status', 'PENDING');

    if (rowUpdateError) {
      this.logger.error(
        `Failed to mark deposit row ${row.row_number} as matched`,
        rowUpdateError,
      );
      return;
    }

    this.logger.log(
      `Deposit row ${row.row_number} auto-matched to order ${order.id}`,
    );
  }

  private async transitionOrderToPreparing(order: CandidateOrder): Promise<{
    id: string;
    status: string;
  } | null> {
    let currentStatus = order.status;

    if (currentStatus === 'CREATED') {
      const confirmedOrder = await this.advanceOrderStatus(
        order.id,
        'CREATED',
        'CONFIRMED',
      );
      if (!confirmedOrder) {
        return null;
      }
      currentStatus = confirmedOrder.status;
    }

    if (currentStatus !== 'CONFIRMED') {
      this.logger.warn(
        `Skipping auto-match status transition for order ${order.id} with unexpected status ${currentStatus}`,
      );
      return null;
    }

    return this.advanceOrderStatus(order.id, 'CONFIRMED', 'PREPARING');
  }

  private async advanceOrderStatus(
    orderId: string,
    fromStatus: string,
    toStatus: string,
  ): Promise<{ id: string; status: string } | null> {
    const sb = this.supabase.adminClient();
    const { data, error } = await sb
      .from('orders')
      .update({
        status: toStatus,
      })
      .eq('id', orderId)
      .eq('status', fromStatus)
      .select('id, status')
      .maybeSingle();

    if (error) {
      this.logger.error(
        `Failed to transition order ${orderId} from ${fromStatus} to ${toStatus}`,
        error,
      );
      return null;
    }

    return data ?? null;
  }

  private async findCandidateOrders(row: {
    branch_ids: string[];
    deposit_date: string;
    amount: number;
    depositor_name_normalized: string;
  }): Promise<CandidateOrder[]> {
    const { from, to } = getKstDayUtcRange(row.deposit_date);
    const sb = this.supabase.adminClient();

    const { data, error } = await sb
      .from('orders')
      .select('id, branch_id, status, customer_name')
      .in('branch_id', row.branch_ids)
      .in('status', ['CREATED', 'CONFIRMED'])
      .eq('total_amount', row.amount)
      .gte('created_at', from)
      .lt('created_at', to);

    if (error) {
      this.logger.error(
        'Failed to fetch candidate orders for deposit match',
        error,
      );
      return [];
    }

    const paymentInfoMap = await this.getOrderPaymentInfoMap(
      ((data ?? []) as CandidateOrder[]).map((order) => order.id),
    );

    const sameNameCandidates = ((data ?? []) as CandidateOrder[])
      .filter((order) => {
        const paymentInfo = paymentInfoMap.get(order.id);
        if (!paymentInfo) {
          return false;
        }
        return (
          paymentInfo.method === 'TRANSFER' && paymentInfo.status === 'PENDING'
        );
      })
      .filter(
        (order) =>
          normalizeDepositorName(order.customer_name) ===
          row.depositor_name_normalized,
      );

    if (sameNameCandidates.length <= 1) {
      return sameNameCandidates;
    }

    const orderIds = sameNameCandidates.map((order) => order.id);
    const { data: existingMatches, error: existingMatchesError } = await sb
      .from('deposit_match_rows')
      .select('matched_order_id')
      .in('matched_order_id', orderIds)
      .eq('match_status', 'MATCHED');

    if (existingMatchesError) {
      this.logger.error(
        'Failed to fetch existing deposit matches for candidate orders',
        existingMatchesError,
      );
      return [];
    }

    const matchedOrderIds = new Set(
      (existingMatches ?? [])
        .map((match: { matched_order_id?: string | null }) =>
          String(match.matched_order_id ?? ''),
        )
        .filter(Boolean),
    );

    return sameNameCandidates.filter((order) => !matchedOrderIds.has(order.id));
  }

  private async getOrderPaymentInfoMap(
    orderIds: string[],
  ): Promise<Map<string, PaymentInfo>> {
    const map = new Map<string, PaymentInfo>();
    if (orderIds.length === 0) {
      return map;
    }

    const sb = this.supabase.adminClient();
    const { data, error } = await sb
      .from('payments')
      .select('order_id, payment_method, status')
      .in('order_id', orderIds);

    if (error) {
      this.logger.error(
        'Failed to fetch payment info for deposit match candidates',
        error,
      );
      return map;
    }

    for (const row of data ?? []) {
      const orderId = String(row?.order_id ?? '');
      if (!orderId || map.has(orderId)) {
        continue;
      }
      map.set(orderId, {
        method: row?.payment_method ?? null,
        status: row?.status ?? null,
      });
    }

    return map;
  }

  private async markPaymentAsMatched(orderId: string): Promise<void> {
    const sb = this.supabase.adminClient();
    const now = new Date().toISOString();
    const { data, error } = await sb
      .from('payments')
      .update({
        status: 'SUCCESS',
        paid_at: now,
      })
      .eq('order_id', orderId)
      .eq('status', 'PENDING')
      .select('id')
      .limit(1);

    if (error) {
      this.logger.error(
        `Failed to mark payment as matched for order ${orderId}`,
        error,
      );
      return;
    }

    if (!data || data.length === 0) {
      this.logger.warn(
        `No pending payment row found while auto-matching order ${orderId}`,
      );
    }
  }
}
