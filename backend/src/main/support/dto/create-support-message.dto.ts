import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class CreateSupportMessageDto {
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  pageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  pageTitle?: string;
}
