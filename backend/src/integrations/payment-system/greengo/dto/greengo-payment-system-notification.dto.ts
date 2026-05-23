import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GreengoPaymentSystemDepositNotificationDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: '23082899' })
  id: string;
}
