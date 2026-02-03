import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { Role } from '../../modules/auth/authorization/roles.enum';
import {
  BrandRole,
  BranchRole,
  MemberStatus,
} from '../../modules/members/dto/member.dto';

@Injectable()
export class MembershipGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  private normalizeId(value: unknown): string | undefined {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }

    if (Array.isArray(value) && typeof value[0] === 'string') {
      const trimmed = value[0].trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }

    return undefined;
  }

  private getRequestId(req: any, key: 'brandId' | 'branchId'): string | undefined {
    const fromParams = this.normalizeId(req?.params?.[key]);
    if (fromParams) return fromParams;

    const fromQuery = this.normalizeId(req?.query?.[key]);
    if (fromQuery) return fromQuery;

    const fromBody = this.normalizeId(req?.body?.[key]);
    if (fromBody) return fromBody;

    return undefined;
  }

  private mapBrandRole(role: BrandRole | null | undefined): Role {
    if (role === BrandRole.OWNER) return Role.OWNER;
    return Role.STAFF;
  }

  private mapBranchRole(role: BranchRole | null | undefined): Role {
    if (role === BranchRole.BRANCH_OWNER) return Role.OWNER;
    return Role.STAFF;
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();

    const userId = req?.user?.id as string | undefined;
    const accessToken = req?.accessToken as string | undefined;

    if (!userId || !accessToken) {
      throw new ForbiddenException('Missing user context');
    }

    if (req?.isAdmin) {
      const brandId = this.getRequestId(req, 'brandId');
      const branchId = this.getRequestId(req, 'branchId');

      if (brandId) req.brandId = brandId;
      if (branchId) req.branchId = branchId;

      req.role = Role.OWNER;
      return true;
    }

    const brandId = this.getRequestId(req, 'brandId');
    const branchId = this.getRequestId(req, 'branchId');

    // If no scope is specified, allow the request through.
    if (!brandId && !branchId) {
      // Try to infer a role for permission-guarded endpoints (e.g., dashboard).
      const sb = this.supabase.userClient(accessToken);
      const { data, error } = await sb
        .from('brand_members')
        .select('role')
        .eq('user_id', userId)
        .eq('status', MemberStatus.ACTIVE);

      if (!error && data && data.length > 0) {
        const hasOwner = data.some((row: any) => row.role === BrandRole.OWNER);
        req.role = hasOwner ? Role.OWNER : Role.STAFF;
      }

      return true;
    }

    const sb = this.supabase.userClient(accessToken);

    if (brandId) {
      const { data, error } = await sb
        .from('brand_members')
        .select('brand_id, role, status')
        .eq('brand_id', brandId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        throw new ForbiddenException('Brand membership check failed');
      }

      if (!data || data.status !== MemberStatus.ACTIVE) {
        throw new ForbiddenException('Brand membership required');
      }

      req.brandId = brandId;
      req.role = this.mapBrandRole(data.role as BrandRole);
      return true;
    }

    if (branchId) {
      const { data, error } = await sb
        .from('branch_members')
        .select('branch_id, role, status')
        .eq('branch_id', branchId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        throw new ForbiddenException('Branch membership check failed');
      }

      if (data && data.status === MemberStatus.ACTIVE) {
        req.branchId = branchId;
        req.role = this.mapBranchRole(data.role as BranchRole);
        return true;
      }

      // Fallback: resolve brand membership via branch lookup
      const { data: branchRow, error: branchError } = await sb
        .from('branches')
        .select('id, brand_id')
        .eq('id', branchId)
        .maybeSingle();

      if (branchError || !branchRow?.brand_id) {
        throw new ForbiddenException('Branch not found or not permitted');
      }

      const { data: brandMember, error: brandError } = await sb
        .from('brand_members')
        .select('brand_id, role, status')
        .eq('brand_id', branchRow.brand_id)
        .eq('user_id', userId)
        .maybeSingle();

      if (brandError) {
        throw new ForbiddenException('Brand membership check failed');
      }

      if (!brandMember || brandMember.status !== MemberStatus.ACTIVE) {
        throw new ForbiddenException('Branch membership required');
      }

      req.branchId = branchId;
      req.brandId = branchRow.brand_id;
      req.role = this.mapBrandRole(brandMember.role as BrandRole);
      return true;
    }

    return true;
  }
}
