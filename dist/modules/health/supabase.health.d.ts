import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { SupabaseService } from '../../infra/supabase/supabase.service';
export declare class SupabaseHealthIndicator extends HealthIndicator {
    private readonly supabase;
    constructor(supabase: SupabaseService);
    isHealthy(key: string): Promise<HealthIndicatorResult>;
}
