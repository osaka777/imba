import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateTelegramNotificationsDto {
  @IsOptional()
  @IsBoolean()
  deposit?: boolean;

  @IsOptional()
  @IsBoolean()
  withdraw?: boolean;

  @IsOptional()
  @IsBoolean()
  bets?: boolean;

  @IsOptional()
  @IsBoolean()
  promo?: boolean;

  @IsOptional()
  @IsBoolean()
  liveMatch?: boolean;

  @IsOptional()
  @IsBoolean()
  preMatch?: boolean;
}

export class UpdateTelegram2faDto {
  @IsBoolean()
  enabled: boolean;
}

export class TelegramBotCommandDto {
  @IsString()
  telegramUserId: string;

  @IsString()
  command: string;
}
