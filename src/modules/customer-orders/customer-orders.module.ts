import { Module } from '@nestjs/common';
import { CustomerOrdersController } from './customer-orders.controller';
import { CustomerOrdersService } from './customer-orders.service';
import { SupabaseModule } from '../../infra/supabase/supabase.module';
import { PaymentsModule } from '../payments/payments.module';
import { CashReceiptsModule } from '../cash-receipts/cash-receipts.module';

@Module({
  imports: [SupabaseModule, PaymentsModule, CashReceiptsModule],
  controllers: [CustomerOrdersController],
  providers: [CustomerOrdersService],
  exports: [CustomerOrdersService],
})
export class CustomerOrdersModule {}
