import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/decorators/current-user.decorator';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import {
  buildSystemAdminConfig,
  isConfiguredSystemAdmin,
  type SystemAdminConfig,
} from '../../common/utils/system-admin.util';

@Controller()
export class MeController {
  private readonly systemAdminConfig: SystemAdminConfig;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {
    this.systemAdminConfig = buildSystemAdminConfig((key) =>
      this.config.get<string>(key),
    );
  }

  private normalizeBrandRole(role: string | null | undefined): string {
    return role === 'MANAGER' ? 'ADMIN' : (role ?? 'MEMBER');
  }

  @Get('/me/profile')
  @UseGuards(AuthGuard)
  async getProfile(@CurrentUser() user: RequestUser) {
    const { data, error } = await this.supabase
      .adminClient()
      .from('profiles')
      .select('id, display_name')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      throw new Error(`[me.getProfile] ${error.message}`);
    }

    return {
      id: user.id,
      displayName: data?.display_name ?? null,
    };
  }

  @Patch('/me/profile')
  @UseGuards(AuthGuard)
  async updateProfile(
    @CurrentUser() user: RequestUser,
    @Body() body: { displayName?: string },
  ) {
    const displayName = body.displayName?.trim() ?? '';
    const normalizedDisplayName = displayName.length > 0 ? displayName : null;
    const admin = this.supabase.adminClient();
    const { data: userResult, error: getUserError } =
      await admin.auth.admin.getUserById(user.id);

    if (getUserError) {
      throw new Error(`[me.updateProfile] ${getUserError.message}`);
    }

    const currentMetadata =
      (userResult.user?.user_metadata as Record<string, unknown> | undefined) ??
      {};
    const { error: updateUserError } = await admin.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: {
          ...currentMetadata,
          display_name: normalizedDisplayName,
        },
      },
    );

    if (updateUserError) {
      throw new Error(`[me.updateProfile] ${updateUserError.message}`);
    }

    const { data, error } = await admin
      .from('profiles')
      .upsert(
        {
          id: user.id,
          display_name: normalizedDisplayName,
        },
        { onConflict: 'id' },
      )
      .select('id, display_name')
      .single();

    if (error) {
      throw new Error(`[me.updateProfile] ${error.message}`);
    }

    return {
      id: data.id,
      displayName: data.display_name ?? null,
    };
  }

  @Get('/me')
  @UseGuards(AuthGuard)
  async me(@CurrentUser() user: RequestUser) {
    const admin = this.supabase.adminClient();
    const [
      { data: profile, error: profileError },
      { data: brandMemberships, error: brandMembershipsError },
      { data: branchMemberships, error: branchMembershipsError },
      { data: ownedBrands, error: brandsError },
    ] = await Promise.all([
      admin
        .from('profiles')
        .select('is_system_admin')
        .eq('id', user.id)
        .maybeSingle(),
      admin
        .from('brand_members')
        .select('brand_id, role, status')
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE'),
      admin
        .from('branch_members')
        .select(
          `
          branch_id,
          role,
          status,
          branches:branch_id (
            brand_id
          )
        `,
        )
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE'),
      admin.from('brands').select('id, name').eq('owner_user_id', user.id),
    ]);

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
    }

    const isSystemAdmin =
      Boolean(profile?.is_system_admin) ||
      isConfiguredSystemAdmin(
        this.systemAdminConfig,
        user.id,
        user.email ?? undefined,
      );

    if (isSystemAdmin) {
      return {
        user: {
          id: user.id,
          email: user.email,
          role: 'system_admin',
        },
        memberships: [],
        ownedBrands: [],
        isSystemAdmin: true,
        canCreateBrand: false,
      };
    }

    if (brandMembershipsError) {
      console.error('Error fetching brand memberships:', brandMembershipsError);
    }

    if (branchMembershipsError) {
      console.error(
        'Error fetching branch memberships:',
        branchMembershipsError,
      );
    }

    if (brandsError) {
      console.error('Error fetching owned brands:', brandsError);
    }

    const normalizedBrandMemberships = (brandMemberships ?? []).map(
      (membership: any) => ({
        brandId: membership.brand_id,
        role: this.normalizeBrandRole(membership.role),
      }),
    );
    const normalizedBranchMemberships = (branchMemberships ?? []).map(
      (membership: any) => ({
        brandId: membership.branches?.brand_id ?? '',
        branchId: membership.branch_id,
        role: membership.role,
      }),
    );
    const memberships = [
      ...normalizedBrandMemberships,
      ...normalizedBranchMemberships,
    ];

    let primaryRole = 'customer';
    const brandRoles = new Set(
      normalizedBrandMemberships.map((membership) => membership.role),
    );
    const branchRoles = new Set(
      normalizedBranchMemberships.map((membership) => membership.role),
    );

    if (
      (ownedBrands ?? []).length > 0 ||
      brandRoles.has('OWNER') ||
      brandRoles.has('ADMIN')
    ) {
      primaryRole = 'brand_owner';
    } else if (
      branchRoles.has('BRANCH_OWNER') ||
      branchRoles.has('BRANCH_ADMIN')
    ) {
      primaryRole = 'branch_manager';
    } else if (branchRoles.has('STAFF')) {
      primaryRole = 'staff';
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        role: primaryRole,
      },
      memberships,
      ownedBrands: ownedBrands || [],
      isSystemAdmin: false,
      canCreateBrand: user.canCreateBrand === true,
    };
  }
}
