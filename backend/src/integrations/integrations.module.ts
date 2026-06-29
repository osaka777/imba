import { Module } from '@nestjs/common';

import { BetApiModule } from '~/integrations/betapi/betapi.module';
import { CybersportModule } from '~/integrations/cybersport/cybersport.module';
import { OddsCorpModule } from '~/integrations/odds-corp/odds-corp.module';
import { BovaPaymentSystemModule } from '~/integrations/payment-system/bova/bova-payment-system.module';
import { GreengoPaymentSystemModule } from '~/integrations/payment-system/greengo/greengo-payment-system.module';
import { PaylinkPaymentSystemModule } from '~/integrations/payment-system/paylink/paylink-payment-system.module';

import { WcOddsModule } from '~/integrations/wc-odds/wc-odds.module';

import { AAIOPaymentSystemModule } from './payment-system/aaio/aaio-payment-system.module';
import { CrocoPayPaymentSystemModule } from './payment-system/crocopay/crocopay-payment-system.module';
import { PaymentSystemModule } from './payment-system/payment-system.module';
import { NirvanaPayPayinModule } from './payment-system/nirvanapay-payin/nirvanapay-payin.module';

@Module({
  imports: [
    OddsCorpModule,
    PaymentSystemModule,
    BetApiModule,
    CybersportModule,
    AAIOPaymentSystemModule,
    PaylinkPaymentSystemModule,
    BovaPaymentSystemModule,
    GreengoPaymentSystemModule,
    CrocoPayPaymentSystemModule,
    NirvanaPayPayinModule,
    WcOddsModule,
  ],
})
export class IntegrationsModule { }
