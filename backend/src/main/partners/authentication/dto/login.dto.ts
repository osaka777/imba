import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class PartnersLoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
