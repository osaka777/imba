import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '~/prisma/prisma.service';
import { CreateSlideDto, UpdateSlideDto } from './dto/slide.dto';

@Injectable()
export class SlideService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllSlides() {
    return this.prisma.slide.findMany({
      orderBy: [
        { order: 'asc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async getActiveSlides() {
    return this.prisma.slide.findMany({
      where: { isActive: true },
      orderBy: [
        { order: 'asc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async getSlideById(id: number) {
    const slide = await this.prisma.slide.findUnique({ where: { id } });
    if (!slide) throw new NotFoundException(`Slide with ID ${id} not found`);
    return slide;
  }

  async createSlide(dto: CreateSlideDto) {
    return this.prisma.slide.create({
      data: {
        title: dto.title,
        description: dto.description,
        imageUrl: dto.imageUrl,
        imagePath: dto.imagePath,
        linkUrl: dto.linkUrl,
        isActive: dto.isActive ?? true,
        order: dto.order ?? 0,
        textPosition: dto.textPosition ?? 'center',
        textVerticalPos: dto.textVerticalPos ?? 'center',
        textOffsetX: dto.textOffsetX ?? 0,
        textOffsetY: dto.textOffsetY ?? 0,
        titleColor: dto.titleColor ?? '#ffffff',
        titleSize: dto.titleSize ?? 28,
        descColor: dto.descColor ?? '#ffffff',
        descSize: dto.descSize ?? 13,
        textShadow: dto.textShadow ?? true,
        titlePosXPct: dto.titlePosXPct ?? null,
        titlePosYPct: dto.titlePosYPct ?? null,
        descPosXPct: dto.descPosXPct ?? null,
        descPosYPct: dto.descPosYPct ?? null,
        showButton: dto.showButton ?? false,
        buttonText: dto.buttonText ?? null,
        buttonPosXPct: dto.buttonPosXPct ?? null,
        buttonPosYPct: dto.buttonPosYPct ?? null,
      },
    });
  }

  async updateSlide(id: number, dto: UpdateSlideDto) {
    const slide = await this.getSlideById(id);
    return this.prisma.slide.update({
      where: { id },
      data: {
        title: dto.title ?? slide.title,
        description: dto.description ?? slide.description,
        imageUrl: dto.imageUrl ?? slide.imageUrl,
        imagePath: dto.imagePath ?? slide.imagePath,
        linkUrl: dto.linkUrl ?? slide.linkUrl,
        isActive: dto.isActive ?? slide.isActive,
        order: dto.order ?? slide.order,
        textPosition: dto.textPosition ?? slide.textPosition,
        textVerticalPos: dto.textVerticalPos ?? slide.textVerticalPos,
        textOffsetX: dto.textOffsetX ?? slide.textOffsetX,
        textOffsetY: dto.textOffsetY ?? slide.textOffsetY,
        titleColor: dto.titleColor ?? slide.titleColor,
        titleSize: dto.titleSize ?? slide.titleSize,
        descColor: dto.descColor ?? slide.descColor,
        descSize: dto.descSize ?? slide.descSize,
        textShadow: dto.textShadow ?? slide.textShadow,
        titlePosXPct: dto.titlePosXPct ?? slide.titlePosXPct,
        titlePosYPct: dto.titlePosYPct ?? slide.titlePosYPct,
        descPosXPct: dto.descPosXPct ?? slide.descPosXPct,
        descPosYPct: dto.descPosYPct ?? slide.descPosYPct,
        showButton: dto.showButton ?? slide.showButton,
        buttonText: dto.buttonText ?? slide.buttonText,
        buttonPosXPct: dto.buttonPosXPct ?? slide.buttonPosXPct,
        buttonPosYPct: dto.buttonPosYPct ?? slide.buttonPosYPct,
      },
    });
  }

  async deleteSlide(id: number) {
    await this.getSlideById(id);
    return this.prisma.slide.delete({ where: { id } });
  }

  async toggleSlideStatus(id: number) {
    const slide = await this.getSlideById(id);
    return this.prisma.slide.update({ where: { id }, data: { isActive: !slide.isActive } });
  }
}
