import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { SupabaseHealthIndicator } from './supabase.health';
import { SupabaseModule } from '../../infra/supabase/supabase.module';

@Module({
  imports: [TerminusModule, SupabaseModule],
  controllers: [HealthController],
  providers: [SupabaseHealthIndicator],
})
export class HealthModule {}
