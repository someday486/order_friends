import { Module } from '@nestjs/common';
import { CustomerBranchesController } from './customer-branches.controller';
import { CustomerBranchesService } from './customer-branches.service';
import { SupabaseModule } from '../../infra/supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [CustomerBranchesController],
  providers: [CustomerBranchesService],
  exports: [CustomerBranchesService],
})
export class CustomerBranchesModule {}
