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
  @IsString()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, { message: 'descColor must be a valid hex color' })
  descColor?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => (value === '' || value === null || value === undefined) ? undefined : parseInt(value))
  descSize?: number;

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
  descPosXPct?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @Transform(({ value }) => (value === '' || value === null || value === undefined) ? undefined : parseInt(value))
  descPosYPct?: number;
}

export class UpdateSlideDto extends CreateSlideDto {}
