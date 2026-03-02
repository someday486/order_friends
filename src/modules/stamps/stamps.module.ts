import { Module } from '@nestjs/common';
import { StampsController } from './stamps.controller';
import { StampsService } from './stamps.service';
import { SupabaseModule } from '../../infra/supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [StampsController],
  providers: [StampsService],
  exports: [StampsService],
})
export class StampsModule {}
