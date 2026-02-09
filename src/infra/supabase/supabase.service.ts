import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);

  private supabaseUrl: string | null = null;
  private anonKey: string | null = null;
  private serviceRoleKey: string | null = null;

  private admin: SupabaseClient | null = null;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('SUPABASE_URL');
    const anon = this.config.get<string>('SUPABASE_ANON_KEY'); // publishable
    const service = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY'); // secret

    // ✅ dev 초기에는 env 없어도 서버 뜨게
    if (!url) {
      this.logger.warn(
        'Supabase env missing: SUPABASE_URL. Supabase is disabled.',
      );
      return;
    }

    this.supabaseUrl = url;
    this.anonKey = anon ?? null;
    this.serviceRoleKey = service ?? null;

    // admin client는 service role 키가 있을 때만 생성
    if (this.serviceRoleKey) {
      this.admin = createClient(this.supabaseUrl, this.serviceRoleKey);
    } else {
      this.logger.warn(
        'Supabase env missing: SUPABASE_SERVICE_ROLE_KEY. admin client disabled.',
      );
    }

    // anonKey 없어도 서버는 뜨게 두되(가드/유저클라 호출 시에만 필요)
    if (!this.anonKey) {
      this.logger.warn(
        'Supabase env missing: SUPABASE_ANON_KEY. user client may be limited.',
      );
    }
  }

  /**
   * 서버 내부용 (service role)
   */
  adminClient(): SupabaseClient {
    if (!this.admin) {
      throw new Error(
        'Supabase admin client is not initialized. Check SUPABASE_SERVICE_ROLE_KEY.',
      );
    }
    return this.admin;
  }

  /**
   * 사용자 토큰 기반 클라이언트 (AuthGuard에서 사용)
   * - anon key로 클라이언트를 만들고
   * - Authorization 헤더에 user token을 실어서 호출
   */
  userClient(userAccessToken: string): SupabaseClient {
    if (!this.supabaseUrl || !this.anonKey) {
      throw new Error(
        'Supabase user client is not initialized. Check SUPABASE_URL / SUPABASE_ANON_KEY.',
      );
    }

    return createClient(this.supabaseUrl, this.anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${userAccessToken}`,
        },
      },
    });
  }

  /**
   * 퍼블릭 클라이언트 (인증 없이 사용)
   * - anon key만으로 호출 (RLS 정책에 따라 접근 제한)
   */
  anonClient(): SupabaseClient {
    if (!this.supabaseUrl || !this.anonKey) {
      throw new Error(
        'Supabase anon client is not initialized. Check SUPABASE_URL / SUPABASE_ANON_KEY.',
      );
    }

    return createClient(this.supabaseUrl, this.anonKey);
  }
}
