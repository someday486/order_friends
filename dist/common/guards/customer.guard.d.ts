import { CanActivate, ExecutionContext } from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
export declare class CustomerGuard implements CanActivate {
    private readonly supabase;
    private readonly logger;
    private readonly membershipCache;
    constructor(supabase: SupabaseService);
    canActivate(context: ExecutionContext): Promise<boolean>;
    private evictExpired;
}
