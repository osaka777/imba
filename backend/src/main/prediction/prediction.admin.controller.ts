import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PredictionEventStatus } from '@prisma/client';

import { AdminAuditService } from '~/main/admin/admin-audit.service';
import { AdminPermissionGuard } from '~/main/user/authentication/admin-permission.guard';
import { RequireAdminPermission } from '~/main/user/authentication/admin-permission.decorator';
import { SuperuserGuard } from '~/main/user/authentication/superuser.guard';

import { PredictionService } from './prediction.service';

class OutcomeDto {
  @IsString()
  key!: string;

  @IsString()
  label!: string;

  @IsOptional()
  @IsString()
  labelEn?: string;

  @IsNumber()
  @Min(1.01)
  odds!: number;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

class CreatePredictionEventDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  titleEn?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string | null;

  @IsOptional()
  @IsString()
  bannerUrl?: string | null;

  @IsOptional()
  @IsString()
  videoUrl?: string | null;

  @IsOptional()
  @IsString()
  resolveRule?: string;

  @IsOptional()
  @IsString()
  resolveRuleEn?: string;

  @IsOptional()
  @IsString()
  closesAt?: string;

  @IsOptional()
  @IsString()
  resolvesAt?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OutcomeDto)
  outcomes!: OutcomeDto[];

  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}

class UpdatePredictionEventDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  titleEn?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string | null;

  @IsOptional()
  @IsString()
  bannerUrl?: string | null;

  @IsOptional()
  @IsString()
  videoUrl?: string | null;

  @IsOptional()
  @IsString()
  resolveRule?: string;

  @IsOptional()
  @IsString()
  resolveRuleEn?: string;

  @IsOptional()
  @IsString()
  closesAt?: string | null;

  @IsOptional()
  @IsString()
  resolvesAt?: string | null;

  @IsOptional()
  @IsString()
  status?: PredictionEventStatus;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OutcomeDto)
  outcomes?: OutcomeDto[];
}

class SettleDto {
  @IsNumber()
  winningOutcomeId!: number;
}

@Controller('admin/prediction')
@UseGuards(SuperuserGuard, AdminPermissionGuard)
export class PredictionAdminController {
  constructor(
    private readonly prediction: PredictionService,
    private readonly auditService: AdminAuditService,
  ) {}

  private async log(
    req: any,
    action: string,
    entityId?: string | number,
    metadata?: Record<string, unknown>,
  ) {
    await this.auditService.log({
      actorRole: req?.adminRole || 'superadmin',
      actorToken: req?.adminToken,
      action,
      entityType: 'prediction',
      entityId: entityId ?? null,
      ip: req?.ip || null,
      userAgent: req?.headers?.['user-agent'] || null,
      metadata: metadata || {},
    });
  }

  @Get('events')
  @RequireAdminPermission('stats.read')
  list(
    @Query('status') status?: string,
    @Query('archived') archived?: '1' | '0' | 'all',
  ) {
    return this.prediction.adminList(status, archived);
  }

  @Post('events')
  @RequireAdminPermission('bonuses.manage')
  async create(@Req() req: any, @Body() body: CreatePredictionEventDto) {
    const event = await this.prediction.adminCreate(body);
    await this.log(req, 'prediction.create', event.id, {
      slug: event.slug,
      title: event.title,
      status: event.status,
    });
    return event;
  }

  @Patch('events/:id')
  @RequireAdminPermission('bonuses.manage')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdatePredictionEventDto,
  ) {
    const event = await this.prediction.adminUpdate(Number(id), body);
    await this.log(req, 'prediction.update', event.id, {
      status: event.status,
    });
    return event;
  }

  @Post('events/:id/publish')
  @RequireAdminPermission('bonuses.manage')
  async publish(@Req() req: any, @Param('id') id: string) {
    const event = await this.prediction.adminPublish(Number(id));
    await this.log(req, 'prediction.publish', event.id);
    return event;
  }

  @Post('events/:id/lock')
  @RequireAdminPermission('bonuses.manage')
  async lock(@Req() req: any, @Param('id') id: string) {
    const event = await this.prediction.adminLock(Number(id));
    await this.log(req, 'prediction.lock', event.id);
    return event;
  }

  @Post('events/:id/archive')
  @RequireAdminPermission('bonuses.manage')
  async archive(@Req() req: any, @Param('id') id: string) {
    const event = await this.prediction.adminArchive(Number(id));
    await this.log(req, 'prediction.archive', event.id);
    return event;
  }

  @Post('events/:id/unarchive')
  @RequireAdminPermission('bonuses.manage')
  async unarchive(@Req() req: any, @Param('id') id: string) {
    const event = await this.prediction.adminUnarchive(Number(id));
    await this.log(req, 'prediction.unarchive', event.id);
    return event;
  }

  @Post('events/:id/settle')
  @RequireAdminPermission('bonuses.manage')
  async settle(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: SettleDto,
  ) {
    const result = await this.prediction.adminSettle(
      Number(id),
      body.winningOutcomeId,
    );
    await this.log(req, 'prediction.settle', Number(id), {
      winningOutcomeId: body.winningOutcomeId,
      settledBets: result.settledBets,
      winners: result.winners,
    });
    return result;
  }

  @Post('events/:id/void')
  @RequireAdminPermission('bonuses.manage')
  async voidEvent(@Req() req: any, @Param('id') id: string) {
    const result = await this.prediction.adminVoid(Number(id));
    await this.log(req, 'prediction.void', Number(id), {
      voidedBets: result.voidedBets,
    });
    return result;
  }

  @Post('upload')
  @RequireAdminPermission('bonuses.manage')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads/prediction',
        filename: (_req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `prediction-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp|svg\+xml)$/)) {
          return cb(
            new BadRequestException('Only image files are allowed'),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const relative = file.path.replace(/^\.\//, '');
    const path = relative.startsWith('/') ? relative : `/${relative}`;
    return {
      filename: file.filename,
      path,
      originalName: file.originalname,
      size: file.size,
    };
  }
}
