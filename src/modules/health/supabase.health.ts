import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { SupabaseService } from '../../infra/supabase/supabase.service';

@Injectable()
export class SupabaseHealthIndicator extends HealthIndicator {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const client = this.supabase.adminClient();

      // 간단한 쿼리로 DB 연결 확인
      const { error } = await client
        .from('profiles')
        .select('id')
        .limit(1);

      if (error) {
        throw new Error(`Supabase connection failed: ${error.message}`);
      }

      return this.getStatus(key, true);
    } catch (error) {
      throw new HealthCheckError(
        'Supabase check failed',
        this.getStatus(key, false, { message: error.message }),
      );
    }
  }
}
