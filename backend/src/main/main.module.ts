import { Module } from '@nestjs/common';

import { AdminModule } from './admin/admin.module';
import { CurrencyModule } from './currency/currency.module';
import { DepositModule } from './deposit/deposit.module';
import { EventModule } from './event/event.module';
import { GameModule } from './game/game.module';
import { HealthModule } from './health/health.module';
import { OperationModule } from './operation/operation.module';
import { AuthenticationModule as PartnersAuthModule } from './partners/authentication/authentication.module';
import { PartnersModule } from './partners/partners.module';
import { ProfileModule } from './partners/profile/profile.module';
import { SubcategoryModule } from './subcategory/subcategory.module';
import { AuthenticationModule } from './user/authentication/authentication.module';
import { UserModule } from './user/user.module';
import { WithdrawalModule } from './withdrawal/withdrawal.module';
import { BonusBalanceModule } from './bonus-balance/bonus-balance.module';
import { BetApiModule } from '../integrations/betapi/betapi.module';
import { BannerModule } from './banner/banner.module';
import { SlideModule } from './slide/slide.module';
import { PromoModalModule } from './promo-modal/promo-modal.module';
import { PaymentSettingsModule } from './payment-settings/payment-settings.module';

@Module({
  imports: [
    UserModule,
    AuthenticationModule,
    ProfileModule,
    GameModule,
    EventModule,
    CurrencyModule,
    DepositModule,
    OperationModule,
    PartnersModule,
    PartnersAuthModule,
    SubcategoryModule,
    WithdrawalModule,
    BonusBalanceModule,
    HealthModule,
    AdminModule,
    BetApiModule,
    BannerModule,
    SlideModule,
    PaymentSettingsModule,
    PromoModalModule,
  ],
})
export class MainModule {}
