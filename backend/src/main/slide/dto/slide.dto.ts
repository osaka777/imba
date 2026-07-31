import { IsOptional, IsString, IsBoolean, IsInt, Min, Max, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateSlideDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  imagePath?: string;

  @IsOptional()
  @IsString()
  linkUrl?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Transform(({ value }) => (value === '' || value === null || value === undefined) ? undefined : parseInt(value))
  order?: number;

  // Позиционирование текста
  @IsOptional()
  @IsString()
  textPosition?: string;

  @IsOptional()
  @IsString()
  textVerticalPos?: string;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => (value === '' || value === null || value === undefined) ? undefined : parseInt(value))
  textOffsetX?: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => (value === '' || value === null || value === undefined) ? undefined : parseInt(value))
  textOffsetY?: number;

  // Стилизация текста
  @IsOptional()
  @IsString()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, { message: 'titleColor must be a valid hex color' })
  titleColor?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => (value === '' || value === null || value === undefined) ? undefined : parseInt(value))
  titleSize?: number;

  @IsOptional()
  @IsInt()
  @Min(8)
  @Max(120)
  @Transform(({ value }) => (value === '' || value === null || value === undefined) ? undefined : parseInt(value))
  titleMobileSize?: number;

  @IsOptional()
  @IsString()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, { message: 'descColor must be a valid hex color' })
  descColor?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => (value === '' || value === null || value === undefined) ? undefined : parseInt(value))
  descSize?: number;

  @IsOptional()
  @IsInt()
  @Min(8)
  @Max(80)
  @Transform(({ value }) => (value === '' || value === null || value === undefined) ? undefined : parseInt(value))
  descMobileSize?: number;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(32)
  @Transform(({ value }) => (value === '' || value === null || value === undefined) ? undefined : parseInt(value))
  buttonSize?: number;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(32)
  @Transform(({ value }) => (value === '' || value === null || value === undefined) ? undefined : parseInt(value))
  buttonMobileSize?: number;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  textShadow?: boolean;

  // Кнопка
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  showButton?: boolean;

  @IsOptional()
  @IsString()
  buttonText?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @Transform(({ value }) => (value === '' || value === null || value === undefined) ? undefined : parseInt(value))
  buttonPosXPct?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @Transform(({ value }) => (value === '' || value === null || value === undefined) ? undefined : parseInt(value))
  buttonPosYPct?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @Transform(({ value }) => (value === '' || value === null || value === undefined) ? undefined : parseInt(value))
  buttonMobilePosXPct?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @Transform(({ value }) => (value === '' || value === null || value === undefined) ? undefined : parseInt(value))
  buttonMobilePosYPct?: number;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  showTitle?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  showDesc?: boolean;

  // Независимые позиции (в процентах)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @Transform(({ value }) => (value === '' || value === null || value === undefined) ? undefined : parseInt(value))
  titlePosXPct?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @Transform(({ value }) => (value === '' || value === null || value === undefined) ? undefined : parseInt(value))
  titlePosYPct?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @Transform(({ value }) => (value === '' || value === null || value === undefined) ? undefined : parseInt(value))
  titleMobilePosXPct?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @Transform(({ value }) => (value === '' || value === null || value === undefined) ? undefined : parseInt(value))
  titleMobilePosYPct?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @Transform(({ value }) => (value === '' || value === null || value === undefined) ? undefined : parseInt(value))
  descPosXPct?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @Transform(({ value }) => (value === '' || value === null || value === undefined) ? undefined : parseInt(value))
  descPosYPct?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @Transform(({ value }) => (value === '' || value === null || value === undefined) ? undefined : parseInt(value))
  descMobilePosXPct?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @Transform(({ value }) => (value === '' || value === null || value === undefined) ? undefined : parseInt(value))
  descMobilePosYPct?: number;

  @IsOptional()
  @IsString()
  layoutMode?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  showSecondaryButton?: boolean;

  @IsOptional()
  @IsString()
  secondaryButtonText?: string;

  @IsOptional()
  @IsString()
  secondaryButtonLink?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, { message: 'buttonColor must be a valid hex color' })
  buttonColor?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, { message: 'buttonTextColor must be a valid hex color' })
  buttonTextColor?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, { message: 'secondaryButtonColor must be a valid hex color' })
  secondaryButtonColor?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, { message: 'secondaryButtonTextColor must be a valid hex color' })
  secondaryButtonTextColor?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @Transform(({ value }) => (value === '' || value === null || value === undefined) ? undefined : parseInt(value))
  secondaryButtonOpacity?: number;
}

export class UpdateSlideDto extends CreateSlideDto {}
