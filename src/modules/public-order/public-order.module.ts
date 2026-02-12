import { Module } from '@nestjs/common';
import { PublicOrderController } from './public-order.controller';
import { PublicOrderService } from './public-order.service';
import { SupabaseModule } from '../../infra/supabase/supabase.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [SupabaseModule, InventoryModule],
  controllers: [PublicOrderController],
  providers: [PublicOrderService],
})
export class PublicOrderModule {}
