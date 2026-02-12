import { CanActivate, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../infra/supabase/supabase.service';
export declare class AuthGuard implements CanActivate {
    private readonly supabase;
    private readonly config;
    private readonly adminEmails;
    private readonly adminUserIds;
    private readonly adminEmailDomains;
    private readonly adminBypassAll;
    private readonly authCache;
    constructor(supabase: SupabaseService, config: ConfigService);
    canActivate(ctx: ExecutionContext): Promise<boolean>;
    private evictExpiredEntries;
    private parseList;
    private parseBoolean;
    private normalizeDomains;
    private isAllowedDomain;
    private isAdminFromMetadata;
}
