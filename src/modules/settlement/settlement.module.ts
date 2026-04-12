import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../infra/supabase/supabase.module';
import {
  SettlementAdminController,
  SettlementController,
} from './settlement.controller';
import { SettlementScheduler } from './settlement.scheduler';
import { SettlementService } from './settlement.service';

@Module({
  imports: [SupabaseModule],
  controllers: [SettlementController, SettlementAdminController],
  providers: [SettlementService, SettlementScheduler],
  exports: [SettlementService],
})
export class SettlementModule {}
