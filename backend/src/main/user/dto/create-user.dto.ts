import { IsEmail, IsNotEmpty, IsOptional } from 'class-validator';

import { Dto } from '~/common/types/dto';

export class CreateUserDto extends Dto<CreateUserDto> {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsNotEmpty()
  password?: string;

  @IsOptional()
  tag?: string;
}
