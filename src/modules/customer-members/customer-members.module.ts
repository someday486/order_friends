import { Module } from '@nestjs/common';
import { CustomerMembersController } from './customer-members.controller';
import { CustomerMembersService } from './customer-members.service';
import { SupabaseModule } from '../../infra/supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [CustomerMembersController],
  providers: [CustomerMembersService],
  exports: [CustomerMembersService],
})
export class CustomerMembersModule {}
