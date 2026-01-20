import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly url: string;
  private readonly anonKey: string;
  private readonly serviceRoleKey: string;

  constructor(private readonly config: ConfigService) {
    this.url = this.mustGet('SUPABASE_URL');
    this.anonKey = this.mustGet('SUPABASE_ANON_KEY');
    this.serviceRoleKey = this.mustGet('SUPABASE_SERVICE_ROLE_KEY');
  }

  /** RLS 적용되는 유저 컨텍스트 */
  userClient(accessToken: string): SupabaseClient {
    return createClient(this.url, this.anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  /** 서버 권한 (관리자/배치용, 주의해서 사용) */
  serviceClient(): SupabaseClient {
    return createClient(this.url, this.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  private mustGet(key: string): string {
    const v = this.config.get<string>(key);
    if (!v) throw new Error(`Missing env: ${key}`);
    return v;
  }
}
