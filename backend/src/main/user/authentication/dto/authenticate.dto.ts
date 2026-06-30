import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { Dto } from '~/common/types/dto';

export class AuthenticateDto {
  @IsNotEmpty()
  @IsString()
  email: string;

  @IsNotEmpty()
  password: string;
}

export class AuthenticateResultDto extends Dto<AuthenticateResultDto> {
  accessToken?: string;

  requires2fa?: boolean;

  twoFaToken?: string;
}

export class VerifyTelegram2faDto {
  @IsNotEmpty()
  @IsString()
  twoFaToken: string;

  @IsNotEmpty()
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  deviceId?: string;
}

export class UpdatePasswordDto {
  @IsNotEmpty()
  @IsString()
  newPassword: string;
  @IsString()
  @IsOptional()
  oldPassword?: string;
}
