import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class RegisterPushDto {
  @IsString()
  @MaxLength(512)
  fcmToken!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  appVersion?: string;

  @IsOptional()
  @IsBoolean()
  notifyBets?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyDeposit?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyWithdraw?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyPromo?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyLiveMatch?: boolean;
}

export class UpdatePushNotificationsDto {
  @IsOptional()
  @IsBoolean()
  bets?: boolean;

  @IsOptional()
  @IsBoolean()
  deposit?: boolean;

  @IsOptional()
  @IsBoolean()
  withdraw?: boolean;

  @IsOptional()
  @IsBoolean()
  promo?: boolean;

  @IsOptional()
  @IsBoolean()
  liveMatch?: boolean;
}
