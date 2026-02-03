import { SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
export declare class SupabaseService {
    private readonly config;
    private readonly logger;
    private supabaseUrl;
    private anonKey;
    private serviceRoleKey;
    private admin;
    constructor(config: ConfigService);
    adminClient(): SupabaseClient;
    userClient(userAccessToken: string): SupabaseClient;
    anonClient(): SupabaseClient;
}
