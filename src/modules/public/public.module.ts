import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';
import { SupabaseModule } from '../../infra/supabase/supabase.module';
import { StampsModule } from '../stamps/stamps.module';

@Module({
  imports: [SupabaseModule, StampsModule],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
