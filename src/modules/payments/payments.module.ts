import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import {
  PaymentsPublicController,
  PaymentsCustomerController,
} from './payments.controller';
import { SupabaseModule } from '../../infra/supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [PaymentsPublicController, PaymentsCustomerController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
