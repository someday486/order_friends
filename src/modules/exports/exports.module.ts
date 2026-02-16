import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../infra/supabase/supabase.module';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';

@Module({
  imports: [SupabaseModule],
  controllers: [ExportsController],
  providers: [ExportsService],
})
export class ExportsModule {}
