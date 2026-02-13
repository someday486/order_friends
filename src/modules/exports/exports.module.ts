import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../infra/supabase/supabase.module';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';
import { ExportsQueue } from './exports.queue';

@Module({
  imports: [SupabaseModule],
  controllers: [ExportsController],
  providers: [ExportsService, ExportsQueue],
})
export class ExportsModule {}
