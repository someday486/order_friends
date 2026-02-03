import { CanActivate, ExecutionContext } from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
export declare class MembershipGuard implements CanActivate {
    private readonly supabase;
    constructor(supabase: SupabaseService);
    private normalizeId;
    private getRequestId;
    private mapBrandRole;
    private mapBranchRole;
    canActivate(ctx: ExecutionContext): Promise<boolean>;
}
