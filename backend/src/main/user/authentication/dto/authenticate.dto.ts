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
  accessToken: string;
}

export class UpdatePasswordDto {
  @IsNotEmpty()
  @IsString()
  newPassword: string;
  @IsString()
  @IsOptional()
  oldPassword?: string;
}
