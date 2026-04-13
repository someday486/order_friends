import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { TossPaymentsClient } from '../payments/toss-payments.client';
import {
  BillingRecordStatus,
  BillingTier,
  SubscriptionStatus,
} from './billing.types';
import type {
  AdminBillingRecordQueryDto,
  AdminExtendSubscriptionRequest,
  AdminSubscriptionQueryDto,
  AdminUpdateSubscriptionStatusRequest,
  BillingKeyResponse,
  BillingRecordQueryDto,
  BillingRecordResponse,
  DeleteBillingKeyRequest,
  IssueBillingKeyRequest,
  RetryBillingRequest,
  UpdateBillingKeyRequest,
} from './dto/billing.dto';
import type {
  BillingSummaryQueryDto,
  BillingSummaryResponse,
  CancelSubscriptionRequest,
  ChangePlanRequest,
  ChangePlanResponse,
  SubscriptionQueryDto,
  SubscriptionResponse,
} from './dto/subscription.dto';

type BrandRow = {
  id: string;
  owner_user_id: string | null;
  billing_tier: BillingTier | null;
  is_active?: boolean | null;
  commission_rate?: number | null;
};

type PlanRow = {
  id: string;
  name: string;
  price: number;
  billing_interval: string;
  max_monthly_orders: number | null;
};

type StoredBillingToken = {
  billingKey: string;
  customerKey: string;
  card?: {
    company?: string | null;
    number?: string | null;
    owner?: string | null;
  } | null;
  issuedAt?: string | null;
};

type SubscriptionRow = {
  id: string;
  brand_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  next_billing_at: string;
  cancelled_at: string | null;
  payment_method_token: string | null;
  scheduled_plan_id?: string | null;
  scheduled_plan_effective_at?: string | null;
  plan?: PlanRow | PlanRow[] | null;
  scheduled_plan?: PlanRow | PlanRow[] | null;
};

type BillingRecordRow = {
  id: string;
  brand_id: string;
  subscription_id: string;
  amount: number;
  status: BillingRecordStatus;
  provider: string;
  provider_payment_key: string | null;
  billing_period_start: string;
  billing_period_end: string;
  attempted_at: string | null;
  paid_at: string | null;
  failure_reason: string | null;
  retry_count: number;
  created_at: string;
};

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly tossClient: TossPaymentsClient;
  private readonly encryptionSecret: string;
  private readonly retryScheduleDays = [0, 2, 5, 7] as const;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {
    const tossSecretKey = this.config.get<string>('TOSS_SECRET_KEY') ?? '';
    const tossBaseUrl =
      this.config.get<string>('TOSS_API_BASE_URL') ??
      'https://api.tosspayments.com/v1';
    const tossTimeoutMs = Number(this.config.get('TOSS_TIMEOUT_MS') ?? 15000);
    const tossWebhookSecret =
      this.config.get<string>('TOSS_WEBHOOK_SECRET') ?? '';
    const tossWebhookSignatureHeader =
      this.config.get<string>('TOSS_WEBHOOK_SIGNATURE_HEADER') ??
      'toss-signature';

    this.tossClient = new TossPaymentsClient(
      tossSecretKey,
      tossBaseUrl,
      Number.isFinite(tossTimeoutMs) ? tossTimeoutMs : 15000,
      tossWebhookSecret,
      tossWebhookSignatureHeader,
    );

    this.encryptionSecret =
      this.config.get<string>('BILLING_TOKEN_ENCRYPTION_KEY') ??
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ??
      tossSecretKey;
  }

  async issueBillingKey(
    userId: string,
    dto: IssueBillingKeyRequest,
    isAdmin = false,
  ): Promise<BillingKeyResponse> {
    const brand = await this.getAccessibleNonPgBrand(
      userId,
      dto.brandId,
      isAdmin,
    );
    const plan = await this.getStarterSubscriptionPlan();
    const issued = await this.tossClient.issueBillingKey(
      dto.customerKey,
      dto.authKey,
    );
    const existingSubscription = await this.getSubscriptionByBrandId(
      brand.id,
      true,
    );

    const token = this.encryptBillingToken({
      billingKey: String(issued.billingKey ?? ''),
      customerKey: dto.customerKey,
      card: this.extractCardSummary(issued.card),
      issuedAt: new Date().toISOString(),
    });

    const currentPeriodStart = new Date();
    const currentPeriodEnd =
      existingSubscription &&
      existingSubscription.status !== SubscriptionStatus.CANCELLED
        ? new Date(existingSubscription.current_period_end)
        : this.addDays(currentPeriodStart, 14);

    const shouldStartTrial =
      !existingSubscription ||
      existingSubscription.status === SubscriptionStatus.CANCELLED;
    const subscription = await this.upsertSubscription(brand.id, {
      planId: shouldStartTrial ? plan.id : existingSubscription.plan_id,
      paymentMethodToken: token,
      status: shouldStartTrial
        ? SubscriptionStatus.TRIAL
        : existingSubscription.status,
      currentPeriodStart: currentPeriodStart.toISOString(),
      currentPeriodEnd: currentPeriodEnd.toISOString(),
      nextBillingAt: currentPeriodEnd.toISOString(),
      cancelledAt: null,
      scheduledPlanId: null,
      scheduledPlanEffectiveAt: null,
    });

    return this.toBillingKeyResponse(
      brand.billing_tier ?? BillingTier.NON_PG,
      subscription,
    );
  }

  async replaceBillingKey(
    userId: string,
    dto: UpdateBillingKeyRequest,
    isAdmin = false,
  ): Promise<BillingKeyResponse> {
    const brand = await this.getAccessibleNonPgBrand(
      userId,
      dto.brandId,
      isAdmin,
    );
    const subscription = this.requireSubscription(
      await this.getSubscriptionByBrandId(brand.id),
    );
    const issued = await this.tossClient.issueBillingKey(
      dto.customerKey,
      dto.authKey,
    );

    const token = this.encryptBillingToken({
      billingKey: String(issued.billingKey ?? ''),
      customerKey: dto.customerKey,
      card: this.extractCardSummary(issued.card),
      issuedAt: new Date().toISOString(),
    });

    const updated = await this.upsertSubscription(brand.id, {
      planId: subscription.plan_id,
      paymentMethodToken: token,
      status: subscription.status,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      nextBillingAt: subscription.next_billing_at,
      cancelledAt: subscription.cancelled_at,
      scheduledPlanId: subscription.scheduled_plan_id ?? null,
      scheduledPlanEffectiveAt:
        subscription.scheduled_plan_effective_at ?? null,
    });

    return this.toBillingKeyResponse(
      brand.billing_tier ?? BillingTier.NON_PG,
      updated,
    );
  }

  async deleteBillingKey(
    userId: string,
    dto: DeleteBillingKeyRequest,
    isAdmin = false,
  ): Promise<{ success: true }> {
    const brand = await this.getAccessibleNonPgBrand(
      userId,
      dto.brandId,
      isAdmin,
    );
    const sb = this.supabase.adminClient();

    const { error } = await sb
      .from('brand_subscriptions')
      .update({
        payment_method_token: null,
        status: SubscriptionStatus.CANCELLED,
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('brand_id', brand.id);

    if (error) {
      throw new BadRequestException(error.message);
    }

    return { success: true };
  }

  async getSubscription(
    userId: string,
    query: SubscriptionQueryDto,
    isAdmin = false,
  ): Promise<SubscriptionResponse> {
    const brand = await this.getAccessibleBrand(userId, query.brandId, isAdmin);
    const subscription = this.requireSubscription(
      await this.getSubscriptionByBrandId(brand.id),
    );
    return this.toDetailedSubscriptionResponse(brand, subscription);
  }

  async getBillingRecords(
    userId: string,
    query: BillingRecordQueryDto,
    isAdmin = false,
  ): Promise<BillingRecordResponse[]> {
    await this.getAccessibleBrand(userId, query.brandId, isAdmin);
    return this.listBillingRecords({
      brandId: query.brandId,
      page: query.page,
      limit: query.limit,
    });
  }

  async getBillingSummary(
    userId: string,
    query: BillingSummaryQueryDto,
    isAdmin = false,
  ): Promise<BillingSummaryResponse> {
    await this.getAccessibleBrand(userId, query.brandId, isAdmin);
    const sb = this.supabase.adminClient();
    const months = query.months ?? 6;
    const since = new Date();
    since.setMonth(since.getMonth() - months);

    const { data, error } = await sb
      .from('billing_records')
      .select('amount, status, paid_at')
      .eq('brand_id', query.brandId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(error.message);
    }

    const totalSuccessAmount = (data ?? [])
      .filter((row) => row.status === BillingRecordStatus.SUCCESS)
      .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    const totalFailedCount = (data ?? []).filter(
      (row) => row.status === BillingRecordStatus.FAILED,
    ).length;
    const lastPaidAt =
      (data ?? []).find((row) => row.status === BillingRecordStatus.SUCCESS)
        ?.paid_at ?? null;
    const subscription = this.requireSubscription(
      await this.getSubscriptionByBrandId(query.brandId),
    );

    return {
      totalSuccessAmount,
      totalFailedCount,
      lastPaidAt,
      nextBillingAt: subscription.next_billing_at,
    };
  }

  async cancelSubscription(
    userId: string,
    dto: CancelSubscriptionRequest,
    isAdmin = false,
  ): Promise<SubscriptionResponse> {
    const brand = await this.getAccessibleBrand(userId, dto.brandId, isAdmin);
    const sb = this.supabase.adminClient();
    const now = new Date().toISOString();
    await this.getSubscriptionByBrandId(brand.id);

    const { error } = await sb
      .from('brand_subscriptions')
      .update({
        status: SubscriptionStatus.CANCELLED,
        cancelled_at: now,
        scheduled_plan_id: null,
        scheduled_plan_effective_at: null,
        updated_at: now,
      })
      .eq('brand_id', brand.id);

    if (error) {
      throw new BadRequestException(error.message);
    }

    return this.toDetailedSubscriptionResponse(
      brand,
      this.requireSubscription(await this.getSubscriptionByBrandId(brand.id)),
    );
  }

  async changePlan(
    userId: string,
    dto: ChangePlanRequest,
    isAdmin = false,
  ): Promise<ChangePlanResponse> {
    const brand = await this.getAccessibleNonPgBrand(
      userId,
      dto.brandId,
      isAdmin,
    );
    const subscription = this.requireSubscription(
      await this.getSubscriptionByBrandId(brand.id),
    );
    const currentPlan = await this.getPlanOrThrow(subscription.plan_id);
    const newPlan = await this.getPlanOrThrow(dto.planId);

    if (currentPlan.id === newPlan.id) {
      throw new BadRequestException('동일한 플랜으로는 변경할 수 없습니다.');
    }

    const now = new Date();
    const sb = this.supabase.adminClient();

    if (Number(newPlan.price) > Number(currentPlan.price)) {
      const proratedAmount = this.calculateProratedUpgradeAmount(
        currentPlan,
        newPlan,
        subscription,
        now,
      );

      if (proratedAmount > 0) {
        await this.chargeProratedUpgrade(
          brand,
          subscription,
          currentPlan,
          newPlan,
          proratedAmount,
          now,
        );
      }

      const { error } = await sb
        .from('brand_subscriptions')
        .update({
          plan_id: newPlan.id,
          scheduled_plan_id: null,
          scheduled_plan_effective_at: null,
          updated_at: now.toISOString(),
        })
        .eq('id', subscription.id);

      if (error) {
        throw new BadRequestException(error.message);
      }

      return {
        effectiveDate: now.toISOString(),
        proratedAmount,
        newPlan: this.toPlanOptionResponse(newPlan, true),
      };
    }

    const effectiveDate = subscription.current_period_end;
    const { error } = await sb
      .from('brand_subscriptions')
      .update({
        scheduled_plan_id: newPlan.id,
        scheduled_plan_effective_at: effectiveDate,
        updated_at: now.toISOString(),
      })
      .eq('id', subscription.id);

    if (error) {
      throw new BadRequestException(error.message);
    }

    return {
      effectiveDate,
      newPlan: this.toPlanOptionResponse(newPlan, false),
    };
  }

  async retryBilling(dto: RetryBillingRequest): Promise<{ success: true }> {
    const sb = this.supabase.adminClient();

    if (!dto.billingRecordId && !dto.brandId) {
      throw new BadRequestException(
        'billingRecordId 또는 brandId 중 하나는 필요합니다.',
      );
    }

    if (dto.billingRecordId) {
      const { data, error } = await sb
        .from('billing_records')
        .select('subscription_id')
        .eq('id', dto.billingRecordId)
        .maybeSingle();

      if (error) {
        throw new BadRequestException(error.message);
      }
      if (!data?.subscription_id) {
        throw new NotFoundException('빌링 기록을 찾을 수 없습니다.');
      }

      await this.processSubscriptionBilling(data.subscription_id);
      return { success: true };
    }

    const subscription = this.requireSubscription(
      await this.getSubscriptionByBrandId(dto.brandId!),
    );
    await this.processSubscriptionBilling(subscription.id);
    return { success: true };
  }

  async listSubscriptions(
    query: AdminSubscriptionQueryDto,
  ): Promise<SubscriptionResponse[]> {
    const sb = this.supabase.adminClient();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let subscriptionQuery = sb.from('brand_subscriptions').select(`
      id,
      brand_id,
      plan_id,
      status,
      current_period_start,
      current_period_end,
      next_billing_at,
      cancelled_at,
      payment_method_token,
      scheduled_plan_id,
      scheduled_plan_effective_at,
      plan:subscription_plans!brand_subscriptions_plan_id_fkey(id, name, price, billing_interval, max_monthly_orders),
      scheduled_plan:subscription_plans!brand_subscriptions_scheduled_plan_id_fkey(id, name, price, billing_interval, max_monthly_orders)
    `);

    if (query.status) {
      subscriptionQuery = subscriptionQuery.eq('status', query.status);
    }

    const { data, error } = await subscriptionQuery
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw new BadRequestException(error.message);
    }

    const brandIds = Array.from(
      new Set((data ?? []).map((row) => String(row.brand_id))),
    );
    const brands = await this.getBrandsByIds(brandIds);

    return (data ?? []).map((row) => {
      const brand = brands.get(String(row.brand_id));
      if (!brand) {
        throw new NotFoundException('브랜드 정보를 찾을 수 없습니다.');
      }

      return this.toSubscriptionResponse(brand, row as SubscriptionRow);
    });
  }

  async getAdminSubscription(brandId: string): Promise<SubscriptionResponse> {
    const brand = await this.getBrandOrThrow(brandId);
    const subscription = this.requireSubscription(
      await this.getSubscriptionByBrandId(brandId),
    );
    return this.toDetailedSubscriptionResponse(brand, subscription);
  }

  async updateSubscriptionStatus(
    brandId: string,
    dto: AdminUpdateSubscriptionStatusRequest,
  ): Promise<SubscriptionResponse> {
    const brand = await this.getBrandOrThrow(brandId);
    const sb = this.supabase.adminClient();
    const now = new Date().toISOString();

    const { error } = await sb
      .from('brand_subscriptions')
      .update({
        status: dto.status,
        cancelled_at: dto.status === SubscriptionStatus.CANCELLED ? now : null,
        updated_at: now,
      })
      .eq('brand_id', brandId);

    if (error) {
      throw new BadRequestException(error.message);
    }

    if (dto.status === SubscriptionStatus.CANCELLED) {
      await sb.from('brands').update({ is_active: false }).eq('id', brandId);
    }

    if (dto.status === SubscriptionStatus.ACTIVE) {
      await sb.from('brands').update({ is_active: true }).eq('id', brandId);
    }

    return this.toSubscriptionResponse(
      brand,
      this.requireSubscription(await this.getSubscriptionByBrandId(brandId)),
    );
  }

  async extendSubscription(
    brandId: string,
    dto: AdminExtendSubscriptionRequest,
  ): Promise<SubscriptionResponse> {
    const brand = await this.getBrandOrThrow(brandId);
    const subscription = this.requireSubscription(
      await this.getSubscriptionByBrandId(brandId),
    );
    const nextBillingAt = new Date(subscription.next_billing_at);
    nextBillingAt.setDate(nextBillingAt.getDate() + dto.days);
    const sb = this.supabase.adminClient();

    const { error } = await sb
      .from('brand_subscriptions')
      .update({
        next_billing_at: nextBillingAt.toISOString(),
        status: SubscriptionStatus.ACTIVE,
        updated_at: new Date().toISOString(),
      })
      .eq('brand_id', brandId);

    if (error) {
      throw new BadRequestException(error.message);
    }

    await sb.from('brands').update({ is_active: true }).eq('id', brandId);

    return this.toSubscriptionResponse(
      brand,
      this.requireSubscription(await this.getSubscriptionByBrandId(brandId)),
    );
  }

  async listAllBillingRecords(
    query: AdminBillingRecordQueryDto,
  ): Promise<BillingRecordResponse[]> {
    return this.listBillingRecords(query);
  }

  async processDueSubscriptions(now = new Date()): Promise<number> {
    const sb = this.supabase.adminClient();
    const { data, error } = await sb
      .from('brand_subscriptions')
      .select('id')
      .in('status', [
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.PAST_DUE,
        SubscriptionStatus.TRIAL,
      ])
      .lte('next_billing_at', now.toISOString());

    if (error) {
      throw new BadRequestException(error.message);
    }

    let processed = 0;
    for (const subscription of data ?? []) {
      try {
        await this.processSubscriptionBilling(subscription.id, now);
        processed += 1;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown billing error';
        this.logger.error(
          `Failed to process subscription billing for ${subscription.id}: ${message}`,
        );
      }
    }

    return processed;
  }

  async processSubscriptionBilling(
    subscriptionId: string,
    now = new Date(),
  ): Promise<void> {
    const subscription = await this.getSubscriptionById(subscriptionId);
    const brand = await this.getBrandOrThrow(subscription.brand_id);
    const currentPlan = await this.getPlanOrThrow(subscription.plan_id);
    const scheduledPlan = subscription.scheduled_plan_id
      ? await this.getPlanOrThrow(subscription.scheduled_plan_id)
      : null;
    const shouldApplyScheduledPlan =
      Boolean(subscription.scheduled_plan_id) &&
      Boolean(subscription.scheduled_plan_effective_at) &&
      new Date(subscription.scheduled_plan_effective_at as string) <= now;
    const plan =
      shouldApplyScheduledPlan && scheduledPlan ? scheduledPlan : currentPlan;

    if (brand.billing_tier !== BillingTier.NON_PG) {
      return;
    }

    const priorFailures = await this.getRetryAttemptCount(subscription.id);
    if (
      subscription.status === SubscriptionStatus.PAST_DUE &&
      priorFailures >= this.retryScheduleDays.length
    ) {
      await this.deactivateBrandForOverdue(brand.id, subscription.id, now);
      return;
    }

    const sb = this.supabase.adminClient();
    const { data: record, error: recordError } = await sb
      .from('billing_records')
      .insert({
        brand_id: brand.id,
        subscription_id: subscription.id,
        amount: plan.price,
        status: BillingRecordStatus.PENDING,
        provider: 'TOSS',
        billing_period_start: subscription.current_period_start,
        billing_period_end: subscription.current_period_end,
        attempted_at: now.toISOString(),
        retry_count: priorFailures,
      })
      .select('id')
      .single();

    if (recordError || !record?.id) {
      throw new BadRequestException(
        recordError?.message ?? '빌링 기록을 생성하지 못했습니다.',
      );
    }

    try {
      const token = this.decryptBillingToken(subscription.payment_method_token);
      if (!token?.billingKey || !token.customerKey) {
        throw new BadRequestException('등록된 빌링키가 없습니다.');
      }

      const charge = await this.tossClient.chargeBillingKey(
        token.billingKey,
        plan.price,
        token.customerKey,
        `sub-${subscription.id}-${Date.now()}`,
        `${brand.id} ${plan.name} 이용료`,
      );

      const currentPeriodEnd = new Date(subscription.current_period_end);
      const nextPeriodEnd = this.addMonths(currentPeriodEnd, 1);

      await sb
        .from('billing_records')
        .update({
          status: BillingRecordStatus.SUCCESS,
          paid_at: now.toISOString(),
          provider_payment_key:
            typeof charge.paymentKey === 'string'
              ? charge.paymentKey
              : typeof charge.mId === 'string'
                ? charge.mId
                : '',
          failure_reason: null,
          updated_at: now.toISOString(),
        })
        .eq('id', record.id);

      await sb
        .from('brand_subscriptions')
        .update({
          plan_id: plan.id,
          current_period_start: subscription.current_period_end,
          current_period_end: nextPeriodEnd.toISOString(),
          next_billing_at: nextPeriodEnd.toISOString(),
          status: SubscriptionStatus.ACTIVE,
          cancelled_at: null,
          scheduled_plan_id: shouldApplyScheduledPlan
            ? null
            : (subscription.scheduled_plan_id ?? null),
          scheduled_plan_effective_at: shouldApplyScheduledPlan
            ? null
            : (subscription.scheduled_plan_effective_at ?? null),
          updated_at: now.toISOString(),
        })
        .eq('id', subscription.id);

      await sb.from('brands').update({ is_active: true }).eq('id', brand.id);
    } catch (error) {
      const failureReason =
        error instanceof Error ? error.message : '구독 결제에 실패했습니다.';
      const nextBillingAt = this.resolveRetrySchedule(priorFailures + 1, now);

      await sb
        .from('billing_records')
        .update({
          status: BillingRecordStatus.FAILED,
          failure_reason: failureReason,
          retry_count: priorFailures + 1,
          updated_at: now.toISOString(),
        })
        .eq('id', record.id);

      await sb
        .from('brand_subscriptions')
        .update({
          status:
            priorFailures + 1 >= 2
              ? SubscriptionStatus.PAST_DUE
              : subscription.status,
          next_billing_at: nextBillingAt.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('id', subscription.id);

      this.logger.warn(
        `Subscription ${subscription.id} billing failed (${priorFailures + 1}): ${failureReason}`,
      );
    }
  }

  private resolveRetrySchedule(attempt: number, now: Date): Date {
    const next = new Date(now);
    const offset =
      this.retryScheduleDays[
        Math.min(attempt, this.retryScheduleDays.length - 1)
      ];
    next.setDate(next.getDate() + offset);
    return next;
  }

  private addMonths(date: Date, months: number): Date {
    const next = new Date(date);
    next.setMonth(next.getMonth() + months);
    return next;
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private toBillingKeyResponse(
    billingTier: BillingTier,
    subscription: SubscriptionRow,
  ): BillingKeyResponse {
    const token = this.decryptBillingToken(subscription.payment_method_token);
    return {
      billingTier,
      subscriptionStatus: subscription.status,
      customerKey: token?.customerKey ?? '',
      cardCompany: token?.card?.company ?? null,
      cardNumber: token?.card?.number ?? null,
      cardOwner: token?.card?.owner ?? null,
      issuedAt: token?.issuedAt ?? null,
    };
  }

  private toSubscriptionResponse(
    brand: BrandRow,
    subscription: SubscriptionRow,
  ): SubscriptionResponse {
    const token = this.decryptBillingToken(subscription.payment_method_token);
    const plan = this.normalizePlan(subscription.plan);
    const scheduledPlan = this.normalizePlan(subscription.scheduled_plan);

    return {
      id: subscription.id,
      brandId: subscription.brand_id,
      planId: subscription.plan_id,
      status: subscription.status,
      billingTier: brand.billing_tier ?? BillingTier.NON_PG,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      nextBillingAt: subscription.next_billing_at,
      cancelledAt: subscription.cancelled_at ?? null,
      planName: plan?.name ?? 'Unknown',
      planPrice: Number(plan?.price ?? 0),
      planMaxMonthlyOrders:
        plan?.max_monthly_orders === null ||
        plan?.max_monthly_orders === undefined
          ? null
          : Number(plan.max_monthly_orders),
      hasPaymentMethod: Boolean(subscription.payment_method_token),
      currentOrderCount: 0,
      hasExceededLimit: false,
      availablePlans: [],
      scheduledPlanId: subscription.scheduled_plan_id ?? null,
      scheduledPlanName: scheduledPlan?.name ?? null,
      scheduledPlanPrice:
        scheduledPlan?.price === null || scheduledPlan?.price === undefined
          ? null
          : Number(scheduledPlan.price),
      scheduledPlanMaxMonthlyOrders:
        scheduledPlan?.max_monthly_orders === null ||
        scheduledPlan?.max_monthly_orders === undefined
          ? null
          : Number(scheduledPlan.max_monthly_orders),
      scheduledPlanEffectiveAt:
        subscription.scheduled_plan_effective_at ?? null,
      cardCompany: token?.card?.company ?? null,
      cardNumber: token?.card?.number ?? null,
      cardOwner: token?.card?.owner ?? null,
    };
  }

  private async toDetailedSubscriptionResponse(
    brand: BrandRow,
    subscription: SubscriptionRow,
  ): Promise<SubscriptionResponse> {
    const base = this.toSubscriptionResponse(brand, subscription);
    const plan = this.normalizePlan(subscription.plan);
    const usage = await this.getCurrentUsageSnapshot(
      brand.id,
      subscription,
      plan,
    );
    const plans = await this.listActivePlans();

    return {
      ...base,
      currentOrderCount: usage.currentOrderCount,
      hasExceededLimit: usage.hasExceededLimit,
      availablePlans: plans.map((candidate) =>
        this.toPlanOptionResponse(
          candidate,
          candidate.id === subscription.plan_id,
        ),
      ),
    };
  }

  private toPlanOptionResponse(
    plan: PlanRow,
    isCurrent: boolean,
  ): ChangePlanResponse['newPlan'] {
    return {
      id: plan.id,
      name: plan.name,
      price: Number(plan.price ?? 0),
      maxMonthlyOrders:
        plan.max_monthly_orders === null ||
        plan.max_monthly_orders === undefined
          ? null
          : Number(plan.max_monthly_orders),
      isCurrent,
    };
  }

  private async listActivePlans(): Promise<PlanRow[]> {
    const sb = this.supabase.adminClient();
    const { data, error } = await sb
      .from('subscription_plans')
      .select('id, name, price, billing_interval, max_monthly_orders')
      .eq('is_active', true)
      .eq('billing_interval', 'MONTHLY')
      .order('price', { ascending: true });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return (data ?? []) as PlanRow[];
  }

  private async getCurrentUsageSnapshot(
    brandId: string,
    subscription: SubscriptionRow,
    plan: PlanRow | null,
  ): Promise<{
    currentOrderCount: number;
    hasExceededLimit: boolean;
  }> {
    const currentOrderCount = await this.countBrandOrdersInPeriod(
      brandId,
      subscription.current_period_start,
      subscription.current_period_end,
    );
    const limit =
      plan?.max_monthly_orders === null ||
      plan?.max_monthly_orders === undefined
        ? null
        : Number(plan.max_monthly_orders);

    return {
      currentOrderCount,
      hasExceededLimit: limit !== null ? currentOrderCount > limit : false,
    };
  }

  private async countBrandOrdersInPeriod(
    brandId: string,
    start: string,
    end: string,
  ): Promise<number> {
    const sb = this.supabase.adminClient();
    const { data: branches, error: branchError } = await sb
      .from('branches')
      .select('id')
      .eq('brand_id', brandId);

    if (branchError) {
      throw new BadRequestException(branchError.message);
    }

    const branchIds = (branches ?? [])
      .map((row: any) => String(row.id ?? ''))
      .filter(Boolean);

    if (branchIds.length === 0) {
      return 0;
    }

    const { count, error } = await sb
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('branch_id', branchIds)
      .gte('created_at', start)
      .lt('created_at', end);

    if (error) {
      throw new BadRequestException(error.message);
    }

    return Number(count ?? 0);
  }

  private calculateProratedUpgradeAmount(
    currentPlan: PlanRow,
    newPlan: PlanRow,
    subscription: SubscriptionRow,
    now: Date,
  ): number {
    const priceDelta =
      Number(newPlan.price ?? 0) - Number(currentPlan.price ?? 0);
    if (priceDelta <= 0) {
      return 0;
    }

    const currentPeriodStart = new Date(subscription.current_period_start);
    const currentPeriodEnd = new Date(subscription.current_period_end);
    const totalMs = currentPeriodEnd.getTime() - currentPeriodStart.getTime();
    const remainingMs = Math.max(currentPeriodEnd.getTime() - now.getTime(), 0);

    if (totalMs <= 0 || remainingMs <= 0) {
      return 0;
    }

    return Math.round((remainingMs / totalMs) * priceDelta);
  }

  private async chargeProratedUpgrade(
    brand: BrandRow,
    subscription: SubscriptionRow,
    currentPlan: PlanRow,
    newPlan: PlanRow,
    amount: number,
    now: Date,
  ): Promise<void> {
    const token = this.decryptBillingToken(subscription.payment_method_token);
    if (!token?.billingKey || !token.customerKey) {
      throw new BadRequestException('등록된 결제 수단이 없습니다.');
    }

    const sb = this.supabase.adminClient();
    const { data: record, error: recordError } = await sb
      .from('billing_records')
      .insert({
        brand_id: brand.id,
        subscription_id: subscription.id,
        amount,
        status: BillingRecordStatus.PENDING,
        provider: 'TOSS',
        billing_period_start: subscription.current_period_start,
        billing_period_end: subscription.current_period_end,
        attempted_at: now.toISOString(),
        retry_count: 0,
      })
      .select('id')
      .single();

    if (recordError || !record?.id) {
      throw new BadRequestException(
        recordError?.message ?? '일할 업그레이드 청구를 시작하지 못했습니다.',
      );
    }

    try {
      const charge = await this.tossClient.chargeBillingKey(
        token.billingKey,
        amount,
        token.customerKey,
        `sub-upgrade-${subscription.id}-${Date.now()}`,
        `${brand.id} ${currentPlan.name} → ${newPlan.name} 차액`,
      );

      const { error } = await sb
        .from('billing_records')
        .update({
          status: BillingRecordStatus.SUCCESS,
          paid_at: now.toISOString(),
          provider_payment_key:
            typeof charge.paymentKey === 'string'
              ? charge.paymentKey
              : typeof charge.mId === 'string'
                ? charge.mId
                : '',
          failure_reason: null,
          updated_at: now.toISOString(),
        })
        .eq('id', record.id);

      if (error) {
        throw new BadRequestException(error.message);
      }
    } catch (error) {
      const failureReason =
        error instanceof Error
          ? error.message
          : '일할 업그레이드 청구에 실패했습니다.';

      await sb
        .from('billing_records')
        .update({
          status: BillingRecordStatus.FAILED,
          failure_reason: failureReason,
          retry_count: 1,
          updated_at: now.toISOString(),
        })
        .eq('id', record.id);

      throw new BadRequestException(failureReason);
    }
  }

  private toBillingRecordResponse(
    record: BillingRecordRow,
  ): BillingRecordResponse {
    return {
      id: record.id,
      brandId: record.brand_id,
      subscriptionId: record.subscription_id,
      amount: Number(record.amount ?? 0),
      status: record.status,
      provider: record.provider,
      providerPaymentKey: record.provider_payment_key ?? null,
      billingPeriodStart: record.billing_period_start,
      billingPeriodEnd: record.billing_period_end,
      attemptedAt: record.attempted_at ?? null,
      paidAt: record.paid_at ?? null,
      failureReason: record.failure_reason ?? null,
      retryCount: Number(record.retry_count ?? 0),
      createdAt: record.created_at,
    };
  }

  private extractCardSummary(card: unknown): StoredBillingToken['card'] {
    if (!card || typeof card !== 'object' || Array.isArray(card)) {
      return null;
    }

    const raw = card as Record<string, unknown>;
    return {
      company: typeof raw.company === 'string' ? raw.company : null,
      number: typeof raw.number === 'string' ? raw.number : null,
      owner:
        typeof raw.ownerType === 'string'
          ? raw.ownerType
          : typeof raw.cardType === 'string'
            ? raw.cardType
            : null,
    };
  }

  private encryptBillingToken(payload: StoredBillingToken): string {
    if (!this.encryptionSecret) {
      throw new BadRequestException('빌링 토큰 암호화 키가 없습니다.');
    }

    const iv = randomBytes(16);
    const key = createHash('sha256').update(this.encryptionSecret).digest();
    const cipher = createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(payload), 'utf8'),
      cipher.final(),
    ]);
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  }

  private decryptBillingToken(
    token?: string | null,
  ): StoredBillingToken | null {
    if (!token) return null;
    if (!this.encryptionSecret) {
      throw new BadRequestException('빌링 토큰 복호화 키가 없습니다.');
    }

    const [ivHex, payloadHex] = token.split(':');
    if (!ivHex || !payloadHex) return null;

    const key = createHash('sha256').update(this.encryptionSecret).digest();
    const decipher = createDecipheriv(
      'aes-256-cbc',
      key,
      Buffer.from(ivHex, 'hex'),
    );
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payloadHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');

    return JSON.parse(decrypted) as StoredBillingToken;
  }

  private async upsertSubscription(
    brandId: string,
    params: {
      planId: string;
      paymentMethodToken: string;
      status: SubscriptionStatus;
      currentPeriodStart: string;
      currentPeriodEnd: string;
      nextBillingAt: string;
      cancelledAt: string | null;
      scheduledPlanId: string | null;
      scheduledPlanEffectiveAt: string | null;
    },
  ): Promise<SubscriptionRow> {
    const existing = await this.getSubscriptionByBrandId(brandId, true);
    const sb = this.supabase.adminClient();
    const payload = {
      plan_id: params.planId,
      payment_method_token: params.paymentMethodToken,
      status: params.status,
      current_period_start: params.currentPeriodStart,
      current_period_end: params.currentPeriodEnd,
      next_billing_at: params.nextBillingAt,
      cancelled_at: params.cancelledAt,
      scheduled_plan_id: params.scheduledPlanId,
      scheduled_plan_effective_at: params.scheduledPlanEffectiveAt,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { data, error } = await sb
        .from('brand_subscriptions')
        .update(payload)
        .eq('brand_id', brandId)
        .select(
          `
          id,
          brand_id,
          plan_id,
          status,
          current_period_start,
          current_period_end,
          next_billing_at,
          cancelled_at,
          payment_method_token,
          scheduled_plan_id,
          scheduled_plan_effective_at,
          plan:subscription_plans!brand_subscriptions_plan_id_fkey(id, name, price, billing_interval, max_monthly_orders),
          scheduled_plan:subscription_plans!brand_subscriptions_scheduled_plan_id_fkey(id, name, price, billing_interval, max_monthly_orders)
        `,
        )
        .single();

      if (error || !data) {
        throw new BadRequestException(
          error?.message ?? '구독 정보를 갱신하지 못했습니다.',
        );
      }

      return data as SubscriptionRow;
    }

    const { data, error } = await sb
      .from('brand_subscriptions')
      .insert({
        brand_id: brandId,
        ...payload,
      })
      .select(
        `
        id,
        brand_id,
        plan_id,
        status,
        current_period_start,
        current_period_end,
        next_billing_at,
        cancelled_at,
        payment_method_token,
        scheduled_plan_id,
        scheduled_plan_effective_at,
        plan:subscription_plans!brand_subscriptions_plan_id_fkey(id, name, price, billing_interval, max_monthly_orders),
        scheduled_plan:subscription_plans!brand_subscriptions_scheduled_plan_id_fkey(id, name, price, billing_interval, max_monthly_orders)
      `,
      )
      .single();

    if (error || !data) {
      throw new BadRequestException(
        error?.message ?? '구독 정보를 생성하지 못했습니다.',
      );
    }

    return data as SubscriptionRow;
  }

  private async getBrandOrThrow(brandId: string): Promise<BrandRow> {
    const sb = this.supabase.adminClient();
    const { data, error } = await sb
      .from('brands')
      .select('id, owner_user_id, billing_tier, is_active, commission_rate')
      .eq('id', brandId)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(error.message);
    }
    if (!data) {
      throw new NotFoundException('브랜드를 찾을 수 없습니다.');
    }
    return data as BrandRow;
  }

  private async getBrandsByIds(
    brandIds: string[],
  ): Promise<Map<string, BrandRow>> {
    if (brandIds.length === 0) {
      return new Map();
    }

    const sb = this.supabase.adminClient();
    const { data, error } = await sb
      .from('brands')
      .select('id, owner_user_id, billing_tier, is_active, commission_rate')
      .in('id', brandIds);

    if (error) {
      throw new BadRequestException(error.message);
    }

    return new Map(
      (data ?? []).map((brand) => [String(brand.id), brand as BrandRow]),
    );
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
        throw new ForbiddenException('브랜드 접근 권한이 없습니다.');
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

  private async getAccessibleNonPgBrand(
    userId: string,
    brandId: string,
    isAdmin: boolean,
  ): Promise<BrandRow> {
    const brand = await this.getAccessibleBrand(userId, brandId, isAdmin);
    if (brand.billing_tier !== BillingTier.NON_PG) {
      throw new BadRequestException('NON_PG 브랜드에서만 사용할 수 있습니다.');
    }
    return brand;
  }

  private async getActiveSubscriptionPlan(): Promise<PlanRow> {
    const sb = this.supabase.adminClient();
    const { data, error } = await sb
      .from('subscription_plans')
      .select('id, name, price, billing_interval, max_monthly_orders')
      .eq('is_active', true)
      .eq('billing_interval', 'MONTHLY')
      .order('price', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(error.message);
    }
    if (!data) {
      throw new NotFoundException('활성 구독 플랜이 없습니다.');
    }
    return data as PlanRow;
  }

  private async getStarterSubscriptionPlan(): Promise<PlanRow> {
    const sb = this.supabase.adminClient();
    const { data, error } = await sb
      .from('subscription_plans')
      .select('id, name, price, billing_interval, max_monthly_orders')
      .eq('is_active', true)
      .eq('billing_interval', 'MONTHLY')
      .eq('name', 'Starter')
      .maybeSingle();

    if (error) {
      throw new BadRequestException(error.message);
    }
    if (data) {
      return data as PlanRow;
    }

    return this.getActiveSubscriptionPlan();
  }

  private async getPlanOrThrow(planId: string): Promise<PlanRow> {
    const sb = this.supabase.adminClient();
    const { data, error } = await sb
      .from('subscription_plans')
      .select('id, name, price, billing_interval, max_monthly_orders')
      .eq('id', planId)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(error.message);
    }
    if (!data) {
      throw new NotFoundException('구독 플랜을 찾을 수 없습니다.');
    }
    return data as PlanRow;
  }

  private async getSubscriptionByBrandId(
    brandId: string,
    allowMissing = false,
  ): Promise<SubscriptionRow | null> {
    const sb = this.supabase.adminClient();
    const { data, error } = await sb
      .from('brand_subscriptions')
      .select(
        `
        id,
        brand_id,
        plan_id,
        status,
        current_period_start,
        current_period_end,
        next_billing_at,
        cancelled_at,
        payment_method_token,
        scheduled_plan_id,
        scheduled_plan_effective_at,
        plan:subscription_plans!brand_subscriptions_plan_id_fkey(id, name, price, billing_interval, max_monthly_orders),
        scheduled_plan:subscription_plans!brand_subscriptions_scheduled_plan_id_fkey(id, name, price, billing_interval, max_monthly_orders)
      `,
      )
      .eq('brand_id', brandId)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(error.message);
    }
    if (!data && !allowMissing) {
      throw new NotFoundException('브랜드 구독 정보를 찾을 수 없습니다.');
    }

    return (data as SubscriptionRow | null) ?? null;
  }

  private async getSubscriptionById(
    subscriptionId: string,
  ): Promise<SubscriptionRow> {
    const sb = this.supabase.adminClient();
    const { data, error } = await sb
      .from('brand_subscriptions')
      .select(
        `
        id,
        brand_id,
        plan_id,
        status,
        current_period_start,
        current_period_end,
        next_billing_at,
        cancelled_at,
        payment_method_token,
        scheduled_plan_id,
        scheduled_plan_effective_at,
        plan:subscription_plans!brand_subscriptions_plan_id_fkey(id, name, price, billing_interval, max_monthly_orders),
        scheduled_plan:subscription_plans!brand_subscriptions_scheduled_plan_id_fkey(id, name, price, billing_interval, max_monthly_orders)
      `,
      )
      .eq('id', subscriptionId)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(error.message);
    }
    if (!data) {
      throw new NotFoundException('구독 정보를 찾을 수 없습니다.');
    }
    return data as SubscriptionRow;
  }

  private async getRetryAttemptCount(subscriptionId: string): Promise<number> {
    const sb = this.supabase.adminClient();
    const { data, error } = await sb
      .from('billing_records')
      .select('retry_count, status')
      .eq('subscription_id', subscriptionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(error.message);
    }
    if (!data || data.status === BillingRecordStatus.SUCCESS) {
      return 0;
    }
    return Number(data.retry_count ?? 0);
  }

  private async deactivateBrandForOverdue(
    brandId: string,
    subscriptionId: string,
    now: Date,
  ): Promise<void> {
    const sb = this.supabase.adminClient();
    await sb.from('brands').update({ is_active: false }).eq('id', brandId);
    await sb
      .from('brand_subscriptions')
      .update({
        status: SubscriptionStatus.PAST_DUE,
        updated_at: now.toISOString(),
      })
      .eq('id', subscriptionId);
  }

  async processOverageChecks(now = new Date()): Promise<number> {
    const sb = this.supabase.adminClient();
    const { data, error } = await sb
      .from('brand_subscriptions')
      .select('brand_id')
      .in('status', [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL])
      .not('scheduled_plan_id', 'is', null);

    if (error) {
      throw new BadRequestException(error.message);
    }

    const alreadyScheduledBrandIds = new Set(
      (data ?? [])
        .map((row: any) => String(row.brand_id ?? ''))
        .filter(Boolean),
    );

    const { data: dueBrands, error: dueError } = await sb
      .from('brand_subscriptions')
      .select('brand_id')
      .in('status', [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL]);

    if (dueError) {
      throw new BadRequestException(dueError.message);
    }

    let processed = 0;
    for (const row of dueBrands ?? []) {
      const brandId = String((row as any).brand_id ?? '');
      if (!brandId || alreadyScheduledBrandIds.has(brandId)) {
        continue;
      }

      const upgraded = await this.checkOverageAndAutoUpgrade(brandId, now);
      if (upgraded) {
        processed += 1;
      }
    }

    return processed;
  }

  async checkOverageAndAutoUpgrade(
    brandId: string,
    now = new Date(),
  ): Promise<boolean> {
    const brand = await this.getBrandOrThrow(brandId);
    if (brand.billing_tier !== BillingTier.NON_PG) {
      return false;
    }

    const subscription = await this.getSubscriptionByBrandId(brandId, true);
    if (!subscription) {
      return false;
    }

    if (subscription.scheduled_plan_id) {
      return false;
    }

    const currentPlan = this.normalizePlan(subscription.plan);
    if (!currentPlan?.max_monthly_orders) {
      return false;
    }

    const activePlans = await this.listActivePlans();
    const nextPlan = activePlans.find(
      (plan) => Number(plan.price ?? 0) > Number(currentPlan.price ?? 0),
    );
    if (!nextPlan) {
      return false;
    }

    const periods = this.getRecentBillingPeriods(subscription, 3, now);
    const overLimit = await Promise.all(
      periods.map(async (period) => {
        const count = await this.countBrandOrdersInPeriod(
          brandId,
          period.start,
          period.end,
        );
        return count > Number(currentPlan.max_monthly_orders ?? 0);
      }),
    );

    if (!overLimit.every(Boolean)) {
      return false;
    }

    const sb = this.supabase.adminClient();
    const effectiveAt = subscription.next_billing_at;
    const { error } = await sb
      .from('brand_subscriptions')
      .update({
        scheduled_plan_id: nextPlan.id,
        scheduled_plan_effective_at: effectiveAt,
        updated_at: now.toISOString(),
      })
      .eq('id', subscription.id);

    if (error) {
      throw new BadRequestException(error.message);
    }

    this.logger.warn(
      `Brand ${brandId} exceeded monthly order limit for 3 consecutive periods. Scheduled ${nextPlan.name} from ${effectiveAt}.`,
    );

    return true;
  }

  private getRecentBillingPeriods(
    subscription: SubscriptionRow,
    months: number,
    now: Date,
  ): Array<{ start: string; end: string }> {
    return Array.from({ length: months }, (_, index) => {
      const start = this.addMonths(
        new Date(subscription.current_period_start),
        -index,
      );
      const endBase = this.addMonths(
        new Date(subscription.current_period_end),
        -index,
      );
      const end =
        index === 0 && endBase.getTime() > now.getTime() ? now : endBase;
      return {
        start: start.toISOString(),
        end: end.toISOString(),
      };
    });
  }

  private async listBillingRecords(params: {
    brandId?: string;
    status?: BillingRecordStatus;
    page?: number;
    limit?: number;
  }): Promise<BillingRecordResponse[]> {
    const sb = this.supabase.adminClient();
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = sb.from('billing_records').select('*');
    if (params.brandId) {
      query = query.eq('brand_id', params.brandId);
    }
    if (params.status) {
      query = query.eq('status', params.status);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw new BadRequestException(error.message);
    }
    return (data ?? []).map((row) =>
      this.toBillingRecordResponse(row as BillingRecordRow),
    );
  }

  private normalizePlan(plan?: PlanRow | PlanRow[] | null): PlanRow | null {
    if (!plan) {
      return null;
    }
    return Array.isArray(plan) ? (plan[0] ?? null) : plan;
  }

  private requireSubscription(
    subscription: SubscriptionRow | null,
  ): SubscriptionRow {
    if (!subscription) {
      throw new NotFoundException('구독 정보를 찾을 수 없습니다.');
    }
    return subscription;
  }
}
