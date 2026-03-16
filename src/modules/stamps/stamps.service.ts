import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import type {
  BrandMembership,
  BranchMembership,
} from '../../common/types/auth-request';
import { UpsertStampCardConfigDto } from './dto/stamp-card-config.dto';

const BRAND_MANAGE_ROLES = new Set(['OWNER', 'ADMIN']);
const BRANCH_MANAGE_ROLES = new Set(['BRANCH_OWNER', 'BRANCH_ADMIN']);

export type StampCardConfig = {
  id: string;
  branchId: string;
  isActive: boolean;
  stampsPerOrder: number;
  rewardThreshold: number;
  rewardDescription: string;
};

export type CustomerStampInfo = {
  config: StampCardConfig | null;
  currentStamps: number;
  totalEarned: number;
  totalRedeemed: number;
  rewardsAvailable: number;
};

function rowToConfig(row: Record<string, unknown>): StampCardConfig {
  return {
    id: row.id as string,
    branchId: row.branch_id as string,
    isActive: row.is_active as boolean,
    stampsPerOrder: row.stamps_per_order as number,
    rewardThreshold: row.reward_threshold as number,
    rewardDescription: row.reward_description as string,
  };
}

@Injectable()
export class StampsService {
  private readonly logger = new Logger(StampsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  // ── Admin: get or create config for branch ──────────────────
  async getConfig(branchId: string): Promise<StampCardConfig | null> {
    const client = this.supabase.adminClient();
    const { data, error } = await client
      .from('stamp_card_configs')
      .select('*')
      .eq('branch_id', branchId)
      .maybeSingle();

    if (error) {
      this.logger.error('getConfig error', error);
      return null;
    }
    return data ? rowToConfig(data as Record<string, unknown>) : null;
  }

  async canManageConfig(
    branchId: string,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ): Promise<boolean> {
    const branchMembership = branchMemberships.find(
      (membership) => membership.branch_id === branchId,
    );
    if (branchMembership && BRANCH_MANAGE_ROLES.has(branchMembership.role)) {
      return true;
    }

    const client = this.supabase.adminClient();
    const { data: branch, error } = await client
      .from('branches')
      .select('brand_id')
      .eq('id', branchId)
      .maybeSingle();

    if (error || !branch?.brand_id) {
      this.logger.warn(
        `canManageConfig branch lookup failed for ${branchId}: ${error?.message ?? 'not found'}`,
      );
      return false;
    }

    return brandMemberships.some(
      (membership) =>
        membership.brand_id === branch.brand_id &&
        BRAND_MANAGE_ROLES.has(membership.role),
    );
  }

  // ── Admin: upsert config ──────────────────────────────────────
  async upsertConfig(
    branchId: string,
    dto: UpsertStampCardConfigDto,
  ): Promise<StampCardConfig> {
    const client = this.supabase.adminClient();
    const payload = {
      branch_id: branchId,
      is_active: dto.isActive,
      stamps_per_order: dto.stampsPerOrder,
      reward_threshold: dto.rewardThreshold,
      reward_description: dto.rewardDescription ?? '스탬프 적립 완료 보상',
    };

    const { data, error } = await client
      .from('stamp_card_configs')
      .upsert(payload, { onConflict: 'branch_id' })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`스탬프 설정 저장 실패: ${error?.message}`);
    }
    return rowToConfig(data as Record<string, unknown>);
  }

  // ── Public: get stamp info for customer phone ─────────────────
  async getPublicStampInfo(
    branchId: string,
    customerPhone: string,
  ): Promise<CustomerStampInfo> {
    const client = this.supabase.adminClient();

    const [configResult, stampResult] = await Promise.all([
      client
        .from('stamp_card_configs')
        .select('*')
        .eq('branch_id', branchId)
        .eq('is_active', true)
        .maybeSingle(),
      client
        .from('customer_stamps')
        .select('total_earned, total_redeemed')
        .eq('branch_id', branchId)
        .eq('customer_phone', customerPhone)
        .maybeSingle(),
    ]);

    const config = configResult.data
      ? rowToConfig(configResult.data as Record<string, unknown>)
      : null;

    const totalEarned = (stampResult.data?.total_earned as number) ?? 0;
    const totalRedeemed = (stampResult.data?.total_redeemed as number) ?? 0;
    const currentStamps = totalEarned - totalRedeemed;
    const rewardsAvailable = config
      ? Math.floor(currentStamps / config.rewardThreshold)
      : 0;

    return {
      config,
      currentStamps,
      totalEarned,
      totalRedeemed,
      rewardsAvailable,
    };
  }

  // ── Internal: earn stamps after order ─────────────────────────
  async earnStamps(params: {
    branchId: string;
    customerPhone: string;
    orderId: string;
  }): Promise<void> {
    const { branchId, customerPhone, orderId } = params;
    if (!customerPhone?.trim()) return;

    const client = this.supabase.adminClient();

    // Check if stamp card is active
    const { data: config } = await client
      .from('stamp_card_configs')
      .select('stamps_per_order')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .maybeSingle();

    if (!config) return; // stamp card not active for this branch

    const qty = (config.stamps_per_order as number) ?? 1;

    // Upsert customer_stamps balance
    const { error: upsertError } = await client.rpc('earn_stamps', {
      p_branch_id: branchId,
      p_customer_phone: customerPhone.trim(),
      p_qty: qty,
      p_order_id: orderId,
    });

    if (upsertError) {
      // Non-fatal: log and continue
      this.logger.warn(`earnStamps RPC failed: ${upsertError.message}`);
      // Fallback: manual upsert
      await this.earnStampsFallback(
        client,
        branchId,
        customerPhone.trim(),
        qty,
        orderId,
      );
    }
  }

  private async earnStampsFallback(
    client: ReturnType<SupabaseService['adminClient']>,
    branchId: string,
    customerPhone: string,
    qty: number,
    orderId: string,
  ): Promise<void> {
    try {
      // Upsert stamp balance
      const { data: existing } = await client
        .from('customer_stamps')
        .select('id, total_earned')
        .eq('branch_id', branchId)
        .eq('customer_phone', customerPhone)
        .maybeSingle();

      if (existing) {
        await client
          .from('customer_stamps')
          .update({ total_earned: (existing.total_earned as number) + qty })
          .eq('id', existing.id);
      } else {
        await client.from('customer_stamps').insert({
          branch_id: branchId,
          customer_phone: customerPhone,
          total_earned: qty,
          total_redeemed: 0,
        });
      }

      // Record transaction
      await client.from('stamp_transactions').insert({
        branch_id: branchId,
        customer_phone: customerPhone,
        order_id: orderId,
        transaction_type: 'EARN',
        qty,
      });
    } catch (err) {
      this.logger.error('earnStampsFallback error', err);
    }
  }
}
