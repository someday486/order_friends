import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BillingService } from './billing.service';

@Injectable()
export class BillingScheduler {
  private readonly logger = new Logger(BillingScheduler.name);

  constructor(private readonly billingService: BillingService) {}

  @Cron('0 0 9 * * *', { timeZone: 'Asia/Seoul' })
  async runDailyBilling(): Promise<void> {
    const processed = await this.billingService.processDueSubscriptions();
    this.logger.log(`Processed ${processed} due subscriptions`);
  }
}
