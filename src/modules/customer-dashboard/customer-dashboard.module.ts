import { Module } from '@nestjs/common';
import { CustomerDashboardController } from './customer-dashboard.controller';
import { CustomerDashboardService } from './customer-dashboard.service';
import { SupabaseModule } from '../../infra/supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [CustomerDashboardController],
  providers: [CustomerDashboardService],
  exports: [CustomerDashboardService],
})
export class CustomerDashboardModule {}
