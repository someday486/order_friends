import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import {
  PaymentsPublicController,
  PaymentsCustomerController,
} from './payments.controller';
import { SupabaseModule } from '../../infra/supabase/supabase.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [SupabaseModule, NotificationsModule],
  controllers: [PaymentsPublicController, PaymentsCustomerController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
