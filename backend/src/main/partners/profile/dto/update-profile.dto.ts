import { Prisma } from '@prisma/client';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateProfileDto {
  @IsObject()
  meta: Prisma.InputJsonValue;

  @IsString()
  @IsOptional()
  password?: string;
}
