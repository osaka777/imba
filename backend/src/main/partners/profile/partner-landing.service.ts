import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PartnerLandingTemplate } from '@prisma/client';
import { randomBytes } from 'crypto';

import { WcOddsBetService } from '~/integrations/wc-odds/wc-odds-bet.service';
import type { WcOddsEventDto } from '~/integrations/wc-odds/wc-odds.types';
import {
  PARTNER_LANDING_EVENT_LIMITS,
  PARTNER_LANDING_MAX,
} from '~/main/partners/affiliate.constants';
import { CreatePartnerLandingDto } from '~/main/partners/profile/dto/create-partner-landing.dto';
import { UpdatePartnerLandingDto } from '~/main/partners/profile/dto/update-partner-landing.dto';
import { PrismaService } from '~/prisma/prisma.service';

function slugifyTitle(_title: string): string {
  return `lp-${randomBytes(4).toString('hex')}`;
}

function normalizeSlugParam(raw: string): string {
  let slug = raw.trim();
  for (let i = 0; i < 2; i++) {
    if (!slug.includes('%')) break;
    try {
      const decoded = decodeURIComponent(slug);
      if (decoded === slug) break;
      slug = decoded;
    } catch {
      break;
    }
  }
  return slug;
}

@Injectable()
export class PartnerLandingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wcOddsBetService: WcOddsBetService,
    private readonly config: ConfigService,
  ) {}

  private getEventLimit(template: PartnerLandingTemplate): number {
    return PARTNER_LANDING_EVENT_LIMITS[template] ?? 6;
  }

  private validateEventRefs(
    template: PartnerLandingTemplate,
    eventRefs: string[],
  ) {
    const limit = this.getEventLimit(template);
    if (eventRefs.length < 1) {
      throw new BadRequestException(['Выберите хотя бы один матч']);
    }
    if (eventRefs.length > limit) {
      throw new BadRequestException([
        `Для шаблона «${template}» можно выбрать не более ${limit} матч(ей)`,
      ]);
    }
  }

  private async resolveEvents(
    eventRefs: string[],
  ): Promise<WcOddsEventDto[]> {
    const results = await Promise.allSettled(
      eventRefs.map((ref) => this.wcOddsBetService.getEventDetail(ref.trim())),
    );

    const events: WcOddsEventDto[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') {
        events.push(r.value);
      }
    }
    return events.filter((e) => e.phase !== 'finished');
  }

  private buildLandingUrl(slug: string) {
    const baseUrl =
      this.config.get<string>('AFFILIATE_BASE_URL') || 'https://imba.bet/';
    const root = baseUrl.replace(/\/$/, '');
    return `${root}/l/${slug}`;
  }

  private serializeLanding(
    landing: {
      id: string;
      slug: string;
      title: string;
      template: PartnerLandingTemplate;
      headline: string | null;
      subheadline: string | null;
      promoCode: string | null;
      eventRefs: string[];
      defaultSub1: string | null;
      isPublished: boolean;
      createdAt: Date;
      updatedAt: Date;
    },
    partnerUid: string,
  ) {
    return {
      id: landing.id,
      slug: landing.slug,
      title: landing.title,
      template: landing.template,
      headline: landing.headline,
      subheadline: landing.subheadline,
      promoCode: landing.promoCode,
      eventRefs: landing.eventRefs,
      defaultSub1: landing.defaultSub1,
      isPublished: landing.isPublished,
      createdAt: landing.createdAt.toISOString(),
      updatedAt: landing.updatedAt.toISOString(),
      url: this.buildLandingUrl(landing.slug),
      eventLimit: this.getEventLimit(landing.template),
    };
  }

  async listForPartner(userId: number) {
    const affiliator = await this.prisma.affilator.findFirst({
      where: { userId },
    });
    if (!affiliator) {
      throw new BadRequestException(['Партнер не найден']);
    }

    const landings = await this.prisma.partnerLanding.findMany({
      where: { partnerUserId: userId },
      orderBy: { createdAt: 'desc' },
    });

    return landings.map((l) => this.serializeLanding(l, affiliator.uid));
  }

  async createForPartner(userId: number, body: CreatePartnerLandingDto) {
    const affiliator = await this.prisma.affilator.findFirst({
      where: { userId },
    });
    if (!affiliator) {
      throw new BadRequestException(['Партнер не найден']);
    }

    const count = await this.prisma.partnerLanding.count({
      where: { partnerUserId: userId },
    });
    if (count >= PARTNER_LANDING_MAX) {
      throw new BadRequestException([
        `Максимум ${PARTNER_LANDING_MAX} лендингов на аккаунт`,
      ]);
    }

    const template = body.template as PartnerLandingTemplate;
    const eventRefs = [...new Set(body.eventRefs.map((r) => r.trim()).filter(Boolean))];
    this.validateEventRefs(template, eventRefs);

    const events = await this.resolveEvents(eventRefs);
    if (events.length === 0) {
      throw new BadRequestException([
        'Не удалось найти выбранные матчи. Попробуйте другие события из линии или лайва.',
      ]);
    }

    const slug = slugifyTitle(body.title);
    const landing = await this.prisma.partnerLanding.create({
      data: {
        partnerUserId: userId,
        slug,
        title: body.title.trim(),
        template,
        headline: body.headline?.trim() || null,
        subheadline: body.subheadline?.trim() || null,
        promoCode: body.promoCode?.toUpperCase() || null,
        eventRefs: events.map((e) => e.slug || e.id),
        defaultSub1: body.defaultSub1?.trim() || slug,
      },
    });

    return this.serializeLanding(landing, affiliator.uid);
  }

  async updateForPartner(
    userId: number,
    landingId: string,
    body: UpdatePartnerLandingDto,
  ) {
    const affiliator = await this.prisma.affilator.findFirst({
      where: { userId },
    });
    if (!affiliator) {
      throw new BadRequestException(['Партнер не найден']);
    }

    const existing = await this.prisma.partnerLanding.findFirst({
      where: { id: landingId, partnerUserId: userId },
    });
    if (!existing) {
      throw new NotFoundException('Лендинг не найден');
    }

    const template = (body.template ?? existing.template) as PartnerLandingTemplate;
    const eventRefs =
      body.eventRefs !== undefined
        ? [...new Set(body.eventRefs.map((r) => r.trim()).filter(Boolean))]
        : existing.eventRefs;

    this.validateEventRefs(template, eventRefs);

    let resolvedRefs = eventRefs;
    if (body.eventRefs !== undefined) {
      const events = await this.resolveEvents(eventRefs);
      if (events.length === 0) {
        throw new BadRequestException(['Не удалось найти выбранные матчи']);
      }
      resolvedRefs = events.map((e) => e.slug || e.id);
    }

    const landing = await this.prisma.partnerLanding.update({
      where: { id: landingId },
      data: {
        ...(body.title !== undefined ? { title: body.title.trim() } : {}),
        ...(body.template !== undefined ? { template: body.template } : {}),
        ...(body.headline !== undefined
          ? { headline: body.headline?.trim() || null }
          : {}),
        ...(body.subheadline !== undefined
          ? { subheadline: body.subheadline?.trim() || null }
          : {}),
        ...(body.promoCode !== undefined
          ? { promoCode: body.promoCode?.toUpperCase() || null }
          : {}),
        ...(body.eventRefs !== undefined ? { eventRefs: resolvedRefs } : {}),
        ...(body.defaultSub1 !== undefined
          ? { defaultSub1: body.defaultSub1?.trim() || null }
          : {}),
        ...(body.isPublished !== undefined
          ? { isPublished: body.isPublished }
          : {}),
      },
    });

    return this.serializeLanding(landing, affiliator.uid);
  }

  async deleteForPartner(userId: number, landingId: string) {
    const existing = await this.prisma.partnerLanding.findFirst({
      where: { id: landingId, partnerUserId: userId },
    });
    if (!existing) {
      throw new NotFoundException('Лендинг не найден');
    }
    await this.prisma.partnerLanding.delete({ where: { id: landingId } });
    return { ok: true };
  }

  async getPublicBySlug(rawSlug: string) {
    const slug = normalizeSlugParam(rawSlug);
    let landing = await this.prisma.partnerLanding.findFirst({
      where: { slug, isPublished: true },
      include: {
        partner: {
          select: { uid: true, percent: true, status: true },
        },
      },
    });

    if (!landing && slug !== rawSlug.trim()) {
      landing = await this.prisma.partnerLanding.findFirst({
        where: { slug: rawSlug.trim(), isPublished: true },
        include: {
          partner: {
            select: { uid: true, percent: true, status: true },
          },
        },
      });
    }

    if (!landing) {
      throw new NotFoundException('Лендинг не найден');
    }

    const events = await this.resolveEvents(landing.eventRefs);

    return {
      id: landing.id,
      slug: landing.slug,
      title: landing.title,
      template: landing.template,
      headline: landing.headline,
      subheadline: landing.subheadline,
      promoCode: landing.promoCode,
      defaultSub1: landing.defaultSub1,
      partnerTag: landing.partner.uid,
      partnerPercent: landing.partner.percent.toString(),
      events,
      ctaUrl: this.buildCtaUrl(landing),
    };
  }

  private buildCtaUrl(landing: {
    slug: string;
    promoCode: string | null;
    defaultSub1: string | null;
    partner: { uid: string };
  }) {
    const baseUrl =
      this.config.get<string>('AFFILIATE_BASE_URL') || 'https://imba.bet/';
    const root = baseUrl.replace(/\/$/, '');
    const url = new URL(`${root}/`);
    url.searchParams.set('tag', landing.partner.uid);
    url.searchParams.set('auth', 'register');
    if (landing.promoCode) {
      url.searchParams.set('promo', landing.promoCode.toUpperCase());
    }
    const sub1 = (landing.defaultSub1?.trim() || landing.slug).slice(0, 64);
    url.searchParams.set('sub1', sub1.slice(0, 64));
    return url.toString();
  }
}
