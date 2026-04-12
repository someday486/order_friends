import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../infra/supabase/supabase.module';
import {
  BillingAdminController,
  BillingController,
} from './billing.controller';
import { BillingScheduler } from './billing.scheduler';
import { BillingService } from './billing.service';

@Module({
  imports: [SupabaseModule],
  controllers: [BillingController, BillingAdminController],
  providers: [BillingService, BillingScheduler],
  exports: [BillingService],
})
export class BillingModule {}
