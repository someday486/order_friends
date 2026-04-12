import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SettlementService } from './settlement.service';

@Injectable()
export class SettlementScheduler {
  private readonly logger = new Logger(SettlementScheduler.name);

  constructor(private readonly settlementService: SettlementService) {}

  @Cron('0 0 1 1 * *', { timeZone: 'Asia/Seoul' })
  async runMonthlySettlement(): Promise<void> {
    const processed =
      await this.settlementService.calculateMonthlySettlements();
    this.logger.log(`Calculated ${processed} settlement periods`);
  }
}
