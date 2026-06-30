import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class CreatePartnerPromoDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Za-z0-9]{4,20}$/)
  code: string;

  @IsIn(['DIRECT_BONUS', 'DEPOSIT_BONUS'])
  bonusType: 'DIRECT_BONUS' | 'DEPOSIT_BONUS';

  @IsOptional()
  @IsInt()
  @Min(1)
  amount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  percentage?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minDeposit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  available?: number;

  @IsOptional()
  @IsString()
  currencyCode?: string;
}
