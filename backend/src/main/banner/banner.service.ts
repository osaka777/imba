import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '~/prisma/prisma.service';
import { CreateBannerDto, UpdateBannerDto } from './dto/banner.dto';

@Injectable()
export class BannerService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllBanners() {
    return this.prisma.banner.findMany({
      orderBy: [
        { order: 'asc' },
        { createdAt: 'desc' }
      ]
    });
  }

  async getActiveBanners() {
    return this.prisma.banner.findMany({
      where: { isActive: true },
      orderBy: [
        { order: 'asc' },
        { createdAt: 'desc' }
      ]
    });
  }

  async getBannerById(id: number) {
    const banner = await this.prisma.banner.findUnique({
      where: { id }
    });

    if (!banner) {
      throw new NotFoundException(`Banner with ID ${id} not found`);
    }

    return banner;
  }

  async createBanner(createBannerDto: CreateBannerDto) {
    return this.prisma.banner.create({
      data: {
        title: createBannerDto.title,
        description: createBannerDto.description,
        imageUrl: createBannerDto.imageUrl,
        imagePath: createBannerDto.imagePath,
        linkUrl: createBannerDto.linkUrl,
        isActive: createBannerDto.isActive ?? true,
        order: createBannerDto.order ?? 0,
        textPosition: createBannerDto.textPosition ?? 'center',
        textVerticalPos: createBannerDto.textVerticalPos ?? 'center',
        textOffsetX: createBannerDto.textOffsetX ?? 0,
        textOffsetY: createBannerDto.textOffsetY ?? 0,
        titleColor: createBannerDto.titleColor ?? '#ffffff',
        titleSize: createBannerDto.titleSize ?? 28,
        descColor: createBannerDto.descColor ?? '#ffffff',
        descSize: createBannerDto.descSize ?? 13,
        textShadow: createBannerDto.textShadow ?? true,
        // Новые поля позиционирования и видимости
        titlePosXPct: createBannerDto.titlePosXPct ?? null,
        titlePosYPct: createBannerDto.titlePosYPct ?? null,
        descPosXPct: createBannerDto.descPosXPct ?? null,
        descPosYPct: createBannerDto.descPosYPct ?? null,
        // rely on DB defaults for visibility toggles
        // Кнопка
        showButton: createBannerDto.showButton ?? false,
        buttonText: createBannerDto.buttonText ?? null,
        buttonPosXPct: createBannerDto.buttonPosXPct ?? null,
        buttonPosYPct: createBannerDto.buttonPosYPct ?? null,
      }
    });
  }

  async updateBanner(id: number, updateBannerDto: UpdateBannerDto) {
    const banner = await this.getBannerById(id);

    return this.prisma.banner.update({
      where: { id },
      data: {
        title: updateBannerDto.title ?? banner.title,
        description: updateBannerDto.description ?? banner.description,
        imageUrl: updateBannerDto.imageUrl ?? banner.imageUrl,
        imagePath: updateBannerDto.imagePath ?? banner.imagePath,
        linkUrl: updateBannerDto.linkUrl ?? banner.linkUrl,
        isActive: updateBannerDto.isActive ?? banner.isActive,
        order: updateBannerDto.order ?? banner.order,
        textPosition: updateBannerDto.textPosition ?? banner.textPosition,
        textVerticalPos: updateBannerDto.textVerticalPos ?? banner.textVerticalPos,
        textOffsetX: updateBannerDto.textOffsetX ?? banner.textOffsetX,
        textOffsetY: updateBannerDto.textOffsetY ?? banner.textOffsetY,
        titleColor: updateBannerDto.titleColor ?? banner.titleColor,
        titleSize: updateBannerDto.titleSize ?? banner.titleSize,
        descColor: updateBannerDto.descColor ?? banner.descColor,
        descSize: updateBannerDto.descSize ?? banner.descSize,
        textShadow: updateBannerDto.textShadow ?? banner.textShadow,
        // Новые поля позиционирования и видимости
        titlePosXPct: updateBannerDto.titlePosXPct ?? banner.titlePosXPct,
        titlePosYPct: updateBannerDto.titlePosYPct ?? banner.titlePosYPct,
        descPosXPct: updateBannerDto.descPosXPct ?? banner.descPosXPct,
        descPosYPct: updateBannerDto.descPosYPct ?? banner.descPosYPct,
        // keep existing visibility toggles as-is
        // Кнопка
        showButton: updateBannerDto.showButton ?? banner.showButton,
        buttonText: updateBannerDto.buttonText ?? banner.buttonText,
        buttonPosXPct: updateBannerDto.buttonPosXPct ?? banner.buttonPosXPct,
        buttonPosYPct: updateBannerDto.buttonPosYPct ?? banner.buttonPosYPct,
      }
    });
  }

  async deleteBanner(id: number) {
    await this.getBannerById(id);
    
    return this.prisma.banner.delete({
      where: { id }
    });
  }

  async toggleBannerStatus(id: number) {
    const banner = await this.getBannerById(id);
    
    return this.prisma.banner.update({
      where: { id },
      data: { isActive: !banner.isActive }
    });
  }
}