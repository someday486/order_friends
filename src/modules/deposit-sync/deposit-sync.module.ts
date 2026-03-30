import { Module } from '@nestjs/common';
import { DepositSyncService } from './deposit-sync.service';

@Module({
  providers: [DepositSyncService],
  exports: [DepositSyncService],
})
export class DepositSyncModule {}
