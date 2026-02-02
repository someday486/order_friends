import { CanActivate, ExecutionContext } from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
export declare class AuthGuard implements CanActivate {
    private readonly supabase;
    constructor(supabase: SupabaseService);
    canActivate(ctx: ExecutionContext): Promise<boolean>;
}
