import { Module, forwardRef } from '@nestjs/common';

import { CurrencyModule } from '~/main/currency/currency.module';
import { OperationModule } from '~/main/operation/operation.module';
import { PrismaModule } from '~/prisma/prisma.module';

import { PaymentSystemService } from './payment-system.service';

@Module({
  exports: [PaymentSystemService],
  imports: [
    PrismaModule, 
    forwardRef(() => OperationModule), 
    CurrencyModule, 
 
  ],
  providers: [PaymentSystemService],
})
export class PaymentSystemModule {}
