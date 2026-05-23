import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional, IsEmail, Min, ValidateIf, IsEnum } from 'class-validator';

export class CreateDepositDto {
  @ApiProperty({ description: 'Сумма депозита' })
  @IsNumber()
  @ValidateIf((o) => o.currency === 'KZT')
  @Min(3000, { message: 'Минимальная сумма для KZT: 3000' })
  amount: number;

  @ApiProperty({ description: 'Код валюты' })
  @IsString()
  currency: string;

  @ApiProperty({ description: 'Токен платежной системы', required: false })
  @IsOptional()
  @IsString()
  token?: string;



  @ApiProperty({ description: 'Email пользователя', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;
}