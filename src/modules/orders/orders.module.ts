import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PaymentsModule } from '../payments/payments.module';
import { CashReceiptsModule } from '../cash-receipts/cash-receipts.module';

@Module({
  imports: [PaymentsModule, CashReceiptsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
