import { Module } from '@nestjs/common';
import { CustomerBrandsController } from './customer-brands.controller';
import { CustomerBrandsService } from './customer-brands.service';
import { SupabaseModule } from '../../infra/supabase/supabase.module';
import { CashReceiptsModule } from '../cash-receipts/cash-receipts.module';

@Module({
  imports: [SupabaseModule, CashReceiptsModule],
  controllers: [CustomerBrandsController],
  providers: [CustomerBrandsService],
  exports: [CustomerBrandsService],
})
export class CustomerBrandsModule {}
