import { Module } from '@nestjs/common';
import { MeController } from './me.controller';
import { SupabaseModule } from '../../infra/supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [MeController],
})
export class AuthModule {}
