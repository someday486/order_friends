import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HealthCheckService, HealthCheck } from '@nestjs/terminus';
import { SupabaseHealthIndicator } from './supabase.health';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private supabaseHealth: SupabaseHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: '헬스체크' })
  check() {
    return this.health.check([() => this.supabaseHealth.isHealthy('supabase')]);
  }
}
