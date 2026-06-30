import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CompleteTelegramLinkDto {
  @IsString()
  token: string;

  @IsString()
  telegramUserId: string;

  @IsOptional()
  @IsString()
  telegramUsername?: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}
