import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import type { RequestUser } from '../decorators/current-user.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly adminEmails: Set<string>;
  private readonly adminUserIds: Set<string>;
  private readonly adminEmailDomains: Set<string>;
  private readonly adminBypassAll: boolean;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {
    const rawEmails = this.parseList(this.config.get<string>('ADMIN_EMAILS'));
    const rawUserIds = this.parseList(this.config.get<string>('ADMIN_USER_IDS'));
    const rawDomains = this.parseList(this.config.get<string>('ADMIN_EMAIL_DOMAINS'));

    this.adminEmails = new Set(rawEmails.map((value) => value.toLowerCase()));
    this.adminUserIds = new Set(rawUserIds);
    this.adminEmailDomains = this.normalizeDomains(rawDomains);
    this.adminBypassAll = this.parseBoolean(this.config.get<string>('ADMIN_BYPASS'));
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();

    const auth = req.headers['authorization'];
    if (!auth || typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    const token = auth.slice('Bearer '.length).trim();
    const sb = this.supabase.userClient(token);

    const { data, error } = await sb.auth.getUser();
    if (error || !data?.user) {
      throw new UnauthorizedException('Invalid token');
    }

    const user: RequestUser = {
      id: data.user.id,
      email: data.user.email ?? undefined,
    };

    const email = data.user.email?.toLowerCase();
    const isAdmin =
      this.adminBypassAll ||
      this.adminUserIds.has(data.user.id) ||
      (email ? this.adminEmails.has(email) : false) ||
      (email ? this.isAllowedDomain(email) : false) ||
      this.isAdminFromMetadata(data.user as any);

    req.user = user;
    req.accessToken = token;
    req.isAdmin = isAdmin;
    return true;
  }

  private parseList(value?: string): string[] {
    if (!value) return [];
    return value
      .split(/[,;\s]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  private parseBoolean(value?: string): boolean {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }

  private normalizeDomains(values: string[]): Set<string> {
    const domains = values
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0)
      .map((value) => (value.startsWith('@') ? value.slice(1) : value));
    return new Set(domains);
  }

  private isAllowedDomain(email: string): boolean {
    if (this.adminEmailDomains.size === 0) return false;
    const domain = email.split('@')[1]?.trim().toLowerCase();
    if (!domain) return false;
    return this.adminEmailDomains.has(domain);
  }

  private isAdminFromMetadata(user: any): boolean {
    const appMetadata = user?.app_metadata ?? {};
    const userMetadata = user?.user_metadata ?? {};

    const appFlag = appMetadata?.is_admin;
    const userFlag = userMetadata?.is_admin;
    const appRole = appMetadata?.role;
    const userRole = userMetadata?.role;

    if (appFlag === true || userFlag === true) return true;
    if (typeof appRole === 'string' && appRole.toLowerCase() === 'admin') return true;
    if (typeof userRole === 'string' && userRole.toLowerCase() === 'admin') return true;

    return false;
  }
}
