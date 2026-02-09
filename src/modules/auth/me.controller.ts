import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/decorators/current-user.decorator';
import { SupabaseService } from '../../infra/supabase/supabase.service';

@Controller()
export class MeController {
  constructor(private readonly supabase: SupabaseService) {}

  @Get('/me')
  @UseGuards(AuthGuard)
  async me(@CurrentUser() user: RequestUser) {
    // First, check if user is a system admin
    const { data: profile, error: profileError } = await this.supabase
      .adminClient()
      .from('profiles')
      .select('is_system_admin')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
    }

    // If user is system admin, return immediately with highest privileges
    if (profile?.is_system_admin) {
      return {
        user: {
          id: user.id,
          email: user.email,
          role: 'system_admin',
        },
        memberships: [],
        ownedBrands: [],
        isSystemAdmin: true,
      };
    }

    // Get user's memberships to determine their role and access
    const { data: memberships, error } = await this.supabase
      .adminClient()
      .from('members')
      .select(
        `
        id,
        role,
        branch_id,
        branches:branch_id (
          id,
          name,
          brand_id,
          brands:brand_id (
            id,
            name,
            owner_user_id
          )
        )
      `,
      )
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching user memberships:', error);
    }

    // Get brands owned by this user
    const { data: ownedBrands, error: brandsError } = await this.supabase
      .adminClient()
      .from('brands')
      .select('id, name')
      .eq('owner_user_id', user.id);

    if (brandsError) {
      console.error('Error fetching owned brands:', brandsError);
    }

    // Determine primary role (highest priority)
    let primaryRole = 'customer'; // default
    if (ownedBrands && ownedBrands.length > 0) {
      primaryRole = 'brand_owner';
    } else if (memberships && memberships.length > 0) {
      // Get the highest role from memberships
      const roles = memberships.map((m) => m.role);
      if (roles.includes('branch_manager')) {
        primaryRole = 'branch_manager';
      } else if (roles.includes('staff')) {
        primaryRole = 'staff';
      }
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        role: primaryRole,
      },
      memberships: memberships || [],
      ownedBrands: ownedBrands || [],
      isSystemAdmin: false,
    };
  }
}
