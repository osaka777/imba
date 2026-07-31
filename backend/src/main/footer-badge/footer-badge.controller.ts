import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Patch,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { FooterBadgeService } from './footer-badge.service';
import { CreateFooterBadgeDto, UpdateFooterBadgeDto } from './dto/footer-badge.dto';
import { SuperuserGuard } from '../user/authentication/superuser.guard';

const uploadDir = './uploads/footer-badges';
mkdirSync(uploadDir, { recursive: true });

@Controller('admin/footer-badges')
@UseGuards(SuperuserGuard)
export class FooterBadgeController {
  constructor(private readonly service: FooterBadgeService) {}

  @Get()
  getAll() {
    return this.service.getAll();
  }

  @Get(':id')
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.service.getById(id);
  }

  @Post()
  create(@Body() dto: CreateFooterBadgeDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateFooterBadgeDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/toggle')
  toggle(@Param('id', ParseIntPipe) id: number) {
    return this.service.toggle(id);
  }

  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.service.delete(id);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: uploadDir,
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `badge-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp|svg\+xml)$/)) {
          return cb(new BadRequestException('Only image files are allowed!'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    return {
      filename: file.filename,
      path: join(uploadDir, file.filename).replace(/\\/g, '/'),
      originalName: file.originalname,
      size: file.size,
    };
  }
}

@Controller('footer-badges')
export class PublicFooterBadgeController {
  constructor(private readonly service: FooterBadgeService) {}

  @Get()
  getActive() {
    return this.service.getActive();
  }
}
