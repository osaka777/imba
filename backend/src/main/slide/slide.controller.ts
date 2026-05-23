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
import { extname } from 'path';
import { SlideService } from './slide.service';
import { CreateSlideDto, UpdateSlideDto } from './dto/slide.dto';
import { SuperuserGuard } from '../user/authentication/superuser.guard';

@Controller('admin/slides')
@UseGuards(SuperuserGuard)
export class SlideController {
  constructor(private readonly slideService: SlideService) {}

  @Get()
  async getAllSlides() {
    return this.slideService.getAllSlides();
  }

  @Get('active')
  async getActiveSlides() {
    return this.slideService.getActiveSlides();
  }

  @Get(':id')
  async getSlideById(@Param('id', ParseIntPipe) id: number) {
    return this.slideService.getSlideById(id);
  }

  @Post()
  async createSlide(@Body() dto: CreateSlideDto) {
    return this.slideService.createSlide(dto);
  }

  @Put(':id')
  async updateSlide(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSlideDto,
  ) {
    return this.slideService.updateSlide(id, dto);
  }

  @Patch(':id/toggle')
  async toggleSlideStatus(@Param('id', ParseIntPipe) id: number) {
    return this.slideService.toggleSlideStatus(id);
  }

  @Delete(':id')
  async deleteSlide(@Param('id', ParseIntPipe) id: number) {
    return this.slideService.deleteSlide(id);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads/slides',
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `slide-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return cb(new BadRequestException('Only image files are allowed!'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  async uploadSlideImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    return {
      filename: file.filename,
      path: file.path,
      originalName: file.originalname,
      size: file.size,
    };
  }
}

@Controller('slides')
export class PublicSlideController {
  constructor(private readonly slideService: SlideService) {}

  @Get()
  async getActiveSlides() {
    return this.slideService.getActiveSlides();
  }
}
