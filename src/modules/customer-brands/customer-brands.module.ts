import { Module } from '@nestjs/common';
import { CustomerBrandsController } from './customer-brands.controller';
import { CustomerBrandsService } from './customer-brands.service';
import { SupabaseModule } from '../../infra/supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [CustomerBrandsController],
  providers: [CustomerBrandsService],
  exports: [CustomerBrandsService],
})
export class CustomerBrandsModule {}
