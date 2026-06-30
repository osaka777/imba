import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';

export class AffiliateSubsDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  sub1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  sub2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  sub3?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  sub4?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  sub5?: string;
}
