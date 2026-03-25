import { Module } from '@nestjs/common';
import { BrandsController } from './brands.controller';
import { BrandsService } from './brands.service';
import { SupabaseModule } from '../../infra/supabase/supabase.module';
import { CashReceiptsModule } from '../cash-receipts/cash-receipts.module';

@Module({
  imports: [SupabaseModule, CashReceiptsModule],
  controllers: [BrandsController],
  providers: [BrandsService],
  exports: [BrandsService],
})
export class BrandsModule {}
