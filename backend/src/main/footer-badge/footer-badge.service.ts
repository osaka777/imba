import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '~/prisma/prisma.service';
import { CreateFooterBadgeDto, UpdateFooterBadgeDto } from './dto/footer-badge.dto';

@Injectable()
export class FooterBadgeService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll() {
    return this.prisma.footerBadge.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getActive() {
    return this.prisma.footerBadge.findMany({
      where: { isActive: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getById(id: number) {
    const badge = await this.prisma.footerBadge.findUnique({ where: { id } });
    if (!badge) throw new NotFoundException(`FooterBadge ${id} not found`);
    return badge;
  }

  async create(dto: CreateFooterBadgeDto) {
    return this.prisma.footerBadge.create({
      data: {
        title: dto.title ?? null,
        imageUrl: dto.imageUrl ?? null,
        imagePath: dto.imagePath ?? null,
        linkUrl: dto.linkUrl ?? null,
        isActive: dto.isActive ?? true,
        order: dto.order ?? 0,
      },
    });
  }

  async update(id: number, dto: UpdateFooterBadgeDto) {
    const badge = await this.getById(id);
    return this.prisma.footerBadge.update({
      where: { id },
      data: {
        title: dto.title ?? badge.title,
        imageUrl: dto.imageUrl ?? badge.imageUrl,
        imagePath: dto.imagePath ?? badge.imagePath,
        linkUrl: dto.linkUrl ?? badge.linkUrl,
        isActive: dto.isActive ?? badge.isActive,
        order: dto.order ?? badge.order,
      },
    });
  }

  async delete(id: number) {
    await this.getById(id);
    return this.prisma.footerBadge.delete({ where: { id } });
  }

  async toggle(id: number) {
    const badge = await this.getById(id);
    return this.prisma.footerBadge.update({
      where: { id },
      data: { isActive: !badge.isActive },
    });
  }
}
