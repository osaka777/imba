import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class PaylinkPaymentSystemSpbBanksResponseDto {
  @IsArray()
  @ApiProperty({
    example: [
      {
        bankName: 'ИШБАНК',
        logoURL: 'https://qr.nspk.ru/proxyapp/logo/bank100000000199.png',
        package_name: 'com.bifit.pmobile.isbank',
        schema: 'bank100000000199',
      },
    ],
  })
  dictionary: {
    bankName: string;
    logoURL: string;
    package_name: string;
    schema: string;
  }[];

  @IsString()
  @ApiProperty({
    example: '1.0',
  })
  version: string;
}
