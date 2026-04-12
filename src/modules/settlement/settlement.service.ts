import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { BillingTier, SettlementStatus } from '../billing/billing.types';
import type {
  AdminSettlementPeriodsQueryDto,
  CalculateSettlementRequest,
  CommissionTierDto,
  SettlementPeriodDetailResponse,
  SettlementPeriodResponse,
  SettlementSummaryQueryDto,
  SettlementSummaryResponse,
  SettlementPeriodsQueryDto,
  SettleSettlementPeriodRequest,
  SettlementLineItemResponse,
  UpsertCommissionTierRequest,
} from './dto/settlement.dto';

type BrandRow = {
  id: string;
  owner_user_id: string | null;
  billing_tier: BillingTier | null;
  commission_rate?: number | null;
};

type SettlementPeriodRow = {
  id: string;
  brand_id: string;
  period_start: string;
  period_end: string;
  total_sales: number;
  total_refunds: number;
  commission_rate: number;
  commission_amount: number;
  net_settlement: number;
  status: SettlementStatus;
  settled_at: string | null;
};

type SettlementLineItemRow = {
  id: string;
  payment_id: string;
  order_id: string;
  sale_amount: number;
  commission_amount: number;
  net_amount: number;
  created_at: string;
};

type CommissionTierRow = {
  id: string;
  name: string;
  min_monthly_sales: number;
  max_monthly_sales: number | null;
  commission_rate: number;
  sort_order: number;
  is_active: boolean;
};

@Injectable()
export class SettlementService {
  constructor(private readonly supabase: SupabaseService) {}

  async calculateMonthlySettlements(now = new Date()): Promise<number> {
    const { periodStart, periodEnd } = this.getPreviousMonthPeriod(now);
    const sb = this.supabase.adminClient();
    const { data: brands, error } = await sb
      .from('brands')
      .select('id')
      .eq('billing_tier', BillingTier.PG)
      .eq('is_active', true);

    if (error) {
      throw new BadRequestException(error.message);
    }

    let processed = 0;
    for (const brand of brands ?? []) {
      await this.calculateSettlementForBrand(
        String(brand.id),
        periodStart,
        periodEnd,
      );
      processed += 1;
    }
    return processed;
  }

  async calculateSettlementForBrand(
    brandId: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<SettlementPeriodResponse> {
    const brand = await this.getBrandOrThrow(brandId);
    const provisionalRate =
      brand.commission_rate ?? (await this.getDefaultCommissionRate());
    const period = await this.getOrCreateSettlementPeriod(
      brandId,
      periodStart,
      periodEnd,
      provisionalRate,
    );
    const sb = this.supabase.adminClient();

    const { data: items, error } = await sb
      .from('settlement_line_items')
      .select('sale_amount, commission_amount')
      .eq('settlement_period_id', period.id);

    if (error) {
      throw new BadRequestException(error.message);
    }

    const totalSales = (items ?? [])
      .filter((item) => Number(item.sale_amount ?? 0) > 0)
      .reduce((sum, item) => sum + Number(item.sale_amount ?? 0), 0);
    const totalRefunds = Math.abs(
      (items ?? [])
        .filter((item) => Number(item.sale_amount ?? 0) < 0)
        .reduce((sum, item) => sum + Number(item.sale_amount ?? 0), 0),
    );
    const lineCommission = (items ?? []).reduce(
      (sum, item) => sum + Number(item.commission_amount ?? 0),
      0,
    );
    const commissionRate = await this.resolveCommissionRate(brand, totalSales);
    const recomputedCommission = Math.round(
      (totalSales - totalRefunds) * commissionRate,
    );
    const commissionAmount =
      lineCommission === recomputedCommission
        ? lineCommission
        : recomputedCommission;
    const netSettlement = totalSales - totalRefunds - commissionAmount;

    const { data: updated, error: updateError } = await sb
      .from('settlement_periods')
      .update({
        total_sales: totalSales,
        total_refunds: totalRefunds,
        commission_rate: commissionRate,
        commission_amount: commissionAmount,
        net_settlement: netSettlement,
        status: SettlementStatus.CALCULATED,
        updated_at: new Date().toISOString(),
      })
      .eq('id', period.id)
      .select('*')
      .single();

    if (updateError || !updated) {
      throw new BadRequestException(
        updateError?.message ?? '정산 계산에 실패했습니다.',
      );
    }

    return this.toSettlementPeriodResponse(updated as SettlementPeriodRow);
  }

  async getPeriods(
    userId: string,
    query: SettlementPeriodsQueryDto,
    isAdmin = false,
  ): Promise<SettlementPeriodResponse[]> {
    await this.getAccessibleBrand(userId, query.brandId, isAdmin);
    const sb = this.supabase.adminClient();
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error } = await sb
      .from('settlement_periods')
      .select('*')
      .eq('brand_id', query.brandId)
      .order('period_start', { ascending: false })
      .range(from, to);

    if (error) {
      throw new BadRequestException(error.message);
    }

    return (data ?? []).map((row) =>
      this.toSettlementPeriodResponse(row as SettlementPeriodRow),
    );
  }

  async getPeriodDetail(
    userId: string,
    periodId: string,
    brandId: string,
    isAdmin = false,
  ): Promise<SettlementPeriodDetailResponse> {
    await this.getAccessibleBrand(userId, brandId, isAdmin);
    return this.getAdminPeriodDetail(periodId);
  }

  async getSummary(
    userId: string,
    query: SettlementSummaryQueryDto,
    isAdmin = false,
  ): Promise<SettlementSummaryResponse> {
    await this.getAccessibleBrand(userId, query.brandId, isAdmin);
    const sb = this.supabase.adminClient();
    const months = query.months ?? 6;
    const since = new Date();
    since.setMonth(since.getMonth() - months);

    const { data, error } = await sb
      .from('settlement_periods')
      .select('total_sales, total_refunds, commission_amount, net_settlement')
      .eq('brand_id', query.brandId)
      .gte('period_start', since.toISOString().slice(0, 10));

    if (error) {
      throw new BadRequestException(error.message);
    }

    return (data ?? []).reduce(
      (acc, row) => ({
        totalSales: acc.totalSales + Number(row.total_sales ?? 0),
        totalRefunds: acc.totalRefunds + Number(row.total_refunds ?? 0),
        totalCommission:
          acc.totalCommission + Number(row.commission_amount ?? 0),
        totalNetSettlement:
          acc.totalNetSettlement + Number(row.net_settlement ?? 0),
      }),
      {
        totalSales: 0,
        totalRefunds: 0,
        totalCommission: 0,
        totalNetSettlement: 0,
      },
    );
  }

  async listAdminPeriods(
    query: AdminSettlementPeriodsQueryDto,
  ): Promise<SettlementPeriodResponse[]> {
    const sb = this.supabase.adminClient();
    let periodQuery = sb.from('settlement_periods').select('*');

    if (query.brandId) {
      periodQuery = periodQuery.eq('brand_id', query.brandId);
    }
    if (query.status) {
      periodQuery = periodQuery.eq('status', query.status);
    }

    const { data, error } = await periodQuery.order('period_start', {
      ascending: false,
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return (data ?? []).map((row) =>
      this.toSettlementPeriodResponse(row as SettlementPeriodRow),
    );
  }

  async getAdminPeriodDetail(
    periodId: string,
  ): Promise<SettlementPeriodDetailResponse> {
    const sb = this.supabase.adminClient();
    const { data: period, error: periodError } = await sb
      .from('settlement_periods')
      .select('*')
      .eq('id', periodId)
      .maybeSingle();

    if (periodError) {
      throw new BadRequestException(periodError.message);
    }
    if (!period) {
      throw new NotFoundException('정산 기간을 찾을 수 없습니다.');
    }

    const { data: lineItems, error: lineItemError } = await sb
      .from('settlement_line_items')
      .select(
        'id, payment_id, order_id, sale_amount, commission_amount, net_amount, created_at',
      )
      .eq('settlement_period_id', periodId)
      .order('created_at', { ascending: true });

    if (lineItemError) {
      throw new BadRequestException(lineItemError.message);
    }

    return {
      ...this.toSettlementPeriodResponse(period as SettlementPeriodRow),
      lineItems: (lineItems ?? []).map((item) =>
        this.toSettlementLineItemResponse(item as SettlementLineItemRow),
      ),
    };
  }

  async settlePeriod(
    periodId: string,
    dto: SettleSettlementPeriodRequest,
  ): Promise<SettlementPeriodResponse> {
    void dto;
    const sb = this.supabase.adminClient();
    const { data: existing, error } = await sb
      .from('settlement_periods')
      .select('*')
      .eq('id', periodId)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(error.message);
    }
    if (!existing) {
      throw new NotFoundException('정산 기간을 찾을 수 없습니다.');
    }

    const period = existing as SettlementPeriodRow;
    if (period.status === SettlementStatus.PENDING) {
      await this.calculateSettlementForBrand(
        period.brand_id,
        period.period_start,
        period.period_end,
      );
    }

    const { data: updated, error: updateError } = await sb
      .from('settlement_periods')
      .update({
        status: SettlementStatus.SETTLED,
        settled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', periodId)
      .select('*')
      .single();

    if (updateError || !updated) {
      throw new BadRequestException(
        updateError?.message ?? '정산 완료 처리에 실패했습니다.',
      );
    }

    return this.toSettlementPeriodResponse(updated as SettlementPeriodRow);
  }

  async triggerCalculation(
    dto: CalculateSettlementRequest,
  ): Promise<{ processed: number }> {
    const baseDate = dto.targetDate ? new Date(dto.targetDate) : new Date();
    if (Number.isNaN(baseDate.getTime())) {
      throw new BadRequestException('유효한 날짜를 입력해 주세요.');
    }

    const processed = await this.calculateMonthlySettlements(baseDate);
    return { processed };
  }

  async listCommissionTiers(): Promise<CommissionTierDto[]> {
    const sb = this.supabase.adminClient();
    const { data, error } = await sb
      .from('commission_tiers')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('min_monthly_sales', { ascending: true });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return (data ?? []).map((row) =>
      this.toCommissionTierDto(row as CommissionTierRow),
    );
  }

  async createCommissionTier(
    dto: UpsertCommissionTierRequest,
  ): Promise<CommissionTierDto> {
    const sb = this.supabase.adminClient();
    const { data, error } = await sb
      .from('commission_tiers')
      .insert({
        name: dto.name,
        min_monthly_sales: dto.minMonthlySales,
        max_monthly_sales: dto.maxMonthlySales ?? null,
        commission_rate: dto.commissionRate,
        sort_order: dto.sortOrder ?? 0,
        is_active: dto.isActive ?? true,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new BadRequestException(
        error?.message ?? '수수료 구간을 생성하지 못했습니다.',
      );
    }

    return this.toCommissionTierDto(data as CommissionTierRow);
  }

  async updateCommissionTier(
    id: string,
    dto: UpsertCommissionTierRequest,
  ): Promise<CommissionTierDto> {
    const sb = this.supabase.adminClient();
    const { data, error } = await sb
      .from('commission_tiers')
      .update({
        name: dto.name,
        min_monthly_sales: dto.minMonthlySales,
        max_monthly_sales: dto.maxMonthlySales ?? null,
        commission_rate: dto.commissionRate,
        sort_order: dto.sortOrder ?? 0,
        is_active: dto.isActive ?? true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) {
      throw new BadRequestException(
        error?.message ?? '수수료 구간을 수정하지 못했습니다.',
      );
    }

    return this.toCommissionTierDto(data as CommissionTierRow);
  }

  async deleteCommissionTier(id: string): Promise<{ success: true }> {
    const sb = this.supabase.adminClient();
    const { data, error } = await sb
      .from('commission_tiers')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (error) {
      throw new BadRequestException(error.message);
    }
    if (!data) {
      throw new NotFoundException('수수료 구간을 찾을 수 없습니다.');
    }

    return { success: true };
  }

  private getPreviousMonthPeriod(now: Date): {
    periodStart: string;
    periodEnd: string;
  } {
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfPreviousMonth = new Date(
      startOfCurrentMonth.getTime() - 86400000,
    );
    const startOfPreviousMonth = new Date(
      endOfPreviousMonth.getFullYear(),
      endOfPreviousMonth.getMonth(),
      1,
    );

    return {
      periodStart: this.formatDateOnly(startOfPreviousMonth),
      periodEnd: this.formatDateOnly(endOfPreviousMonth),
    };
  }

  private formatDateOnly(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private async resolveCommissionRate(
    brand: BrandRow,
    monthlySales: number,
  ): Promise<number> {
    if (brand.commission_rate !== null && brand.commission_rate !== undefined) {
      return Number(brand.commission_rate);
    }

    const tiers = await this.getActiveCommissionTiers();
    const matchedTier = tiers.find(
      (tier) =>
        monthlySales >= Number(tier.min_monthly_sales ?? 0) &&
        (tier.max_monthly_sales === null ||
          tier.max_monthly_sales === undefined ||
          monthlySales < Number(tier.max_monthly_sales)),
    );

    if (matchedTier) {
      return Number(matchedTier.commission_rate);
    }

    return Number(tiers[0]?.commission_rate ?? 0.035);
  }

  private async getDefaultCommissionRate(): Promise<number> {
    const tiers = await this.getActiveCommissionTiers();
    return Number(tiers[0]?.commission_rate ?? 0.035);
  }

  private async getActiveCommissionTiers(): Promise<CommissionTierRow[]> {
    const sb = this.supabase.adminClient();
    const { data, error } = await sb
      .from('commission_tiers')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('min_monthly_sales', { ascending: true });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return (data ?? []) as CommissionTierRow[];
  }

  private async getOrCreateSettlementPeriod(
    brandId: string,
    periodStart: string,
    periodEnd: string,
    commissionRate: number,
  ): Promise<SettlementPeriodRow> {
    const sb = this.supabase.adminClient();
    const { data: existing, error: existingError } = await sb
      .from('settlement_periods')
      .select('*')
      .eq('brand_id', brandId)
      .eq('period_start', periodStart)
      .maybeSingle();

    if (existingError) {
      throw new BadRequestException(existingError.message);
    }
    if (existing) {
      return existing as SettlementPeriodRow;
    }

    const { data: created, error: createError } = await sb
      .from('settlement_periods')
      .insert({
        brand_id: brandId,
        period_start: periodStart,
        period_end: periodEnd,
        commission_rate: commissionRate,
        status: SettlementStatus.PENDING,
      })
      .select('*')
      .single();

    if (!createError && created) {
      return created as SettlementPeriodRow;
    }

    if (createError?.code === '23505') {
      const { data: retried, error: retryError } = await sb
        .from('settlement_periods')
        .select('*')
        .eq('brand_id', brandId)
        .eq('period_start', periodStart)
        .maybeSingle();

      if (retryError) {
        throw new BadRequestException(retryError.message);
      }
      if (retried) {
        return retried as SettlementPeriodRow;
      }
    }

    throw new BadRequestException(
      createError?.message ?? '정산 기간을 생성하지 못했습니다.',
    );
  }

  private async getBrandOrThrow(brandId: string): Promise<BrandRow> {
    const sb = this.supabase.adminClient();
    const { data, error } = await sb
      .from('brands')
      .select('id, owner_user_id, billing_tier, commission_rate')
      .eq('id', brandId)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('브랜드를 찾을 수 없습니다.');
    return data as BrandRow;
  }

  private async getAccessibleBrand(
    userId: string,
    brandId: string,
    isAdmin: boolean,
  ): Promise<BrandRow> {
    const brand = await this.getBrandOrThrow(brandId);
    if (isAdmin) {
      return brand;
    }
    if (brand.owner_user_id !== userId) {
      const hasMembershipAccess = await this.hasBrandManagementMembership(
        userId,
        brandId,
      );
      if (!hasMembershipAccess) {
        throw new ForbiddenException('??? ?????? ?????????????.');
      }
    }
    return brand;
  }

  private async hasBrandManagementMembership(
    userId: string,
    brandId: string,
  ): Promise<boolean> {
    const sb = this.supabase.adminClient();
    const { data, error } = await sb
      .from('brand_members')
      .select('role')
      .eq('brand_id', brandId)
      .eq('user_id', userId)
      .eq('status', 'ACTIVE')
      .in('role', ['OWNER', 'ADMIN', 'MANAGER'])
      .maybeSingle();

    if (error) {
      throw new BadRequestException(error.message);
    }

    return Boolean(data);
  }

  private toSettlementPeriodResponse(
    row: SettlementPeriodRow,
  ): SettlementPeriodResponse {
    return {
      id: row.id,
      brandId: row.brand_id,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      totalSales: Number(row.total_sales ?? 0),
      totalRefunds: Number(row.total_refunds ?? 0),
      commissionRate: Number(row.commission_rate ?? 0),
      commissionAmount: Number(row.commission_amount ?? 0),
      netSettlement: Number(row.net_settlement ?? 0),
      status: row.status,
      settledAt: row.settled_at ?? null,
    };
  }

  private toSettlementLineItemResponse(
    row: SettlementLineItemRow,
  ): SettlementLineItemResponse {
    return {
      id: row.id,
      paymentId: row.payment_id,
      orderId: row.order_id,
      saleAmount: Number(row.sale_amount ?? 0),
      commissionAmount: Number(row.commission_amount ?? 0),
      netAmount: Number(row.net_amount ?? 0),
      createdAt: row.created_at,
    };
  }

  private toCommissionTierDto(row: CommissionTierRow): CommissionTierDto {
    return {
      id: row.id,
      name: row.name,
      minMonthlySales: Number(row.min_monthly_sales ?? 0),
      maxMonthlySales:
        row.max_monthly_sales === null || row.max_monthly_sales === undefined
          ? null
          : Number(row.max_monthly_sales),
      commissionRate: Number(row.commission_rate ?? 0),
      sortOrder: Number(row.sort_order ?? 0),
      isActive: Boolean(row.is_active),
    };
  }
}
