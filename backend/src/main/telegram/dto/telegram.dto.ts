import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
  @IsNotEmpty()
  newPassword: string;
}
