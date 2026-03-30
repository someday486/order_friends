import { Module } from '@nestjs/common';
import { PublicOrderController } from './public-order.controller';
import { PublicOrderService } from './public-order.service';
import { MeOrdersController } from './me-orders.controller';
import { MeOrdersService } from './me-orders.service';
import { SupabaseModule } from '../../infra/supabase/supabase.module';
import { InventoryModule } from '../inventory/inventory.module';
import { StampsModule } from '../stamps/stamps.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    SupabaseModule,
    InventoryModule,
    StampsModule,
    NotificationsModule,
    PaymentsModule,
  ],
  controllers: [PublicOrderController, MeOrdersController],
  providers: [PublicOrderService, MeOrdersService],
})
export class PublicOrderModule {}
