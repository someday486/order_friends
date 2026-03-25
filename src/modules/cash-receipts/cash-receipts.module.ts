import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CashReceiptsService } from './cash-receipts.service';
import { PopbillCashReceiptsClient } from './popbill-cash-receipts.client';
import { CashReceiptOnboardingService } from './cash-receipt-onboarding.service';

@Module({
  imports: [ConfigModule],
  providers: [
    CashReceiptsService,
    PopbillCashReceiptsClient,
    CashReceiptOnboardingService,
  ],
  exports: [CashReceiptsService, CashReceiptOnboardingService],
})
export class CashReceiptsModule {}
