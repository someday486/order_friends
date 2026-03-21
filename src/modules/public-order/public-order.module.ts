import { Module } from '@nestjs/common';
import { PublicOrderController } from './public-order.controller';
import { PublicOrderService } from './public-order.service';
import { SupabaseModule } from '../../infra/supabase/supabase.module';
import { InventoryModule } from '../inventory/inventory.module';
import { StampsModule } from '../stamps/stamps.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [SupabaseModule, InventoryModule, StampsModule, NotificationsModule],
  controllers: [PublicOrderController],
  providers: [PublicOrderService],
})
export class PublicOrderModule {}
