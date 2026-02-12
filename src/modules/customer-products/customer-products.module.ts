import { Module } from '@nestjs/common';
import { CustomerProductsController } from './customer-products.controller';
import { CustomerProductsService } from './customer-products.service';
import { SupabaseModule } from '../../infra/supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [CustomerProductsController],
  providers: [CustomerProductsService],
  exports: [CustomerProductsService],
})
export class CustomerProductsModule {}
