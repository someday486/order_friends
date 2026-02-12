import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { UserNotificationsService } from './user-notifications.service';
import { UserNotificationsController } from './user-notifications.controller';
import { SupabaseModule } from '../../infra/supabase/supabase.module';

@Module({
  imports: [ConfigModule, SupabaseModule],
  controllers: [UserNotificationsController],
  providers: [NotificationsService, UserNotificationsService],
  exports: [NotificationsService, UserNotificationsService],
})
export class NotificationsModule {}
