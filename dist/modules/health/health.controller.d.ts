import { HealthCheckService } from '@nestjs/terminus';
import { SupabaseHealthIndicator } from './supabase.health';
export declare class HealthController {
    private health;
    private supabaseHealth;
    constructor(health: HealthCheckService, supabaseHealth: SupabaseHealthIndicator);
    check(): Promise<import("@nestjs/terminus").HealthCheckResult>;
}
