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
import { BannerService } from './banner.service';
import { CreateBannerDto, UpdateBannerDto } from './dto/banner.dto';
import { SuperuserGuard } from '../user/authentication/superuser.guard';

@Controller('admin/banners')
@UseGuards(SuperuserGuard)
export class BannerController {
  constructor(private readonly bannerService: BannerService) {}

  @Get()
  async getAllBanners() {
    return this.bannerService.getAllBanners();
  }

  @Get('active')
  async getActiveBanners() {
    return this.bannerService.getActiveBanners();
  }

  @Get(':id')
  async getBannerById(@Param('id', ParseIntPipe) id: number) {
    return this.bannerService.getBannerById(id);
  }

  @Post()
  async createBanner(@Body() createBannerDto: CreateBannerDto) {
    console.log('[BannerController] === BANNER CREATION REQUEST ===');
    console.log('[BannerController] Raw request body:', JSON.stringify(createBannerDto, null, 2));
    console.log('[BannerController] DTO type check:', {
      title: typeof createBannerDto.title,
      titleValue: createBannerDto.title,
      isActive: typeof createBannerDto.isActive,
      isActiveValue: createBannerDto.isActive,
      order: typeof createBannerDto.order,
      orderValue: createBannerDto.order,
      titleColor: typeof createBannerDto.titleColor,
      titleColorValue: createBannerDto.titleColor,
      descColor: typeof createBannerDto.descColor,
      descColorValue: createBannerDto.descColor,
    });
    
    try {
      const result = await this.bannerService.createBanner(createBannerDto);
      console.log('[BannerController] Banner created successfully:', result.id);
      return result;
    } catch (error) {
      console.error('[BannerController] Error creating banner:', error);
      console.error('[BannerController] Error stack:', error.stack);
      throw error;
    }
  }

  @Put(':id')
  async updateBanner(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateBannerDto: UpdateBannerDto,
  ) {
    return this.bannerService.updateBanner(id, updateBannerDto);
  }

  @Patch(':id/toggle')
  async toggleBannerStatus(@Param('id', ParseIntPipe) id: number) {
    return this.bannerService.toggleBannerStatus(id);
  }

  @Delete(':id')
  async deleteBanner(@Param('id', ParseIntPipe) id: number) {
    return this.bannerService.deleteBanner(id);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads/banners',
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `banner-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return cb(new BadRequestException('Only image files are allowed!'), false);
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  async uploadBannerImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return {
      filename: file.filename,
      path: file.path,
      originalName: file.originalname,
      size: file.size,
    };
  }
}

// Публичный контроллер для frontend
@Controller('banners')
export class PublicBannerController {
  constructor(private readonly bannerService: BannerService) {}

  @Get()
  async getActiveBanners() {
    return this.bannerService.getActiveBanners();
  }
}