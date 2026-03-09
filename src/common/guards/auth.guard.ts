import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import type { RequestUser } from '../decorators/current-user.decorator';
import {
  buildSystemAdminConfig,
  isConfiguredSystemAdmin,
  type SystemAdminConfig,
} from '../utils/system-admin.util';

const AUTH_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const AUTH_CACHE_MAX_SIZE = 1000;

type CachedAuth = {
  user: RequestUser;
  isAdmin: boolean;
  expiresAt: number;
};

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly systemAdminConfig: SystemAdminConfig;
  private readonly authCache = new Map<string, CachedAuth>();

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {
    this.systemAdminConfig = buildSystemAdminConfig((key) =>
      this.config.get<string>(key),
    );
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();

    const auth = req.headers['authorization'];
    if (!auth || typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    const token = auth.slice('Bearer '.length).trim();

    // Check auth cache first
    const now = Date.now();
    const cached = this.authCache.get(token);
    if (cached && now < cached.expiresAt) {
      req.user = cached.user;
      req.accessToken = token;
      req.isAdmin = cached.isAdmin;
      return true;
    }

    // Cache miss — validate with Supabase
    const sb = this.supabase.userClient(token);

    const { data, error } = await sb.auth.getUser();
    if (error || !data?.user) {
      this.authCache.delete(token);
      throw new UnauthorizedException('Invalid token');
    }

    const user: RequestUser = {
      id: data.user.id,
      email: data.user.email ?? undefined,
    };

    const { data: profile, error: profileError } = await sb
      .from('profiles')
      .select('is_system_admin')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError) {
      this.authCache.delete(token);
      throw new UnauthorizedException('Failed to verify admin permissions');
    }

    const isAdmin =
      Boolean(profile?.is_system_admin) ||
      isConfiguredSystemAdmin(
        this.systemAdminConfig,
        data.user.id,
        data.user.email ?? undefined,
      );

    // Store in cache
    this.evictExpiredEntries(now);
    this.authCache.set(token, {
      user,
      isAdmin,
      expiresAt: now + AUTH_CACHE_TTL_MS,
    });

    req.user = user;
    req.accessToken = token;
    req.isAdmin = isAdmin;
    return true;
  }

  private evictExpiredEntries(now: number): void {
    if (this.authCache.size < AUTH_CACHE_MAX_SIZE) return;
    for (const [key, entry] of this.authCache) {
      if (now >= entry.expiresAt) {
        this.authCache.delete(key);
      }
    }
    // Still over limit — remove oldest
    if (this.authCache.size >= AUTH_CACHE_MAX_SIZE) {
      const firstKey = this.authCache.keys().next().value as string;
      this.authCache.delete(firstKey);
    }
  }
}
