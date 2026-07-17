import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { PrismaService } from '~/prisma/prisma.service';

import type { KickPartnerMeta } from './kick-partner.types';

export type KickWidgetAlertType = 'registration' | 'ftd';

export type KickWidgetAlertItem = {
  id: string;
  type: KickWidgetAlertType;
  createdAt: string;
  label: string;
};

const MAX_ALERTS = 30;

@Injectable()
export class KickWidgetAlertService {
  private readonly logger = new Logger(KickWidgetAlertService.name);

  constructor(private readonly prisma: PrismaService) {}

  private readKickMeta(meta: unknown): KickPartnerMeta {
    if (meta == null || typeof meta !== 'object' || Array.isArray(meta)) return {};
    const root = meta as Record<string, unknown>;
    const kick = root.kick;
    if (!kick || typeof kick !== 'object' || Array.isArray(kick)) return {};
    return kick as KickPartnerMeta;
  }

  async pushAlert(
    partnerUserId: number,
    type: KickWidgetAlertType,
    label: string,
  ): Promise<KickWidgetAlertItem | null> {
    const affiliator = await this.prisma.affilator.findUnique({
      where: { userId: partnerUserId },
      select: { meta: true },
    });
    if (!affiliator) return null;

    const kick = this.readKickMeta(affiliator.meta);
    if (!kick.activeSessionId && !kick.isLive) return null;

    const item: KickWidgetAlertItem = {
      id: randomUUID(),
      type,
      createdAt: new Date().toISOString(),
      label,
    };

    const prev = Array.isArray(kick.widgetAlerts) ? kick.widgetAlerts : [];
    const widgetAlerts = [...prev, item].slice(-MAX_ALERTS);

    const root =
      affiliator.meta && typeof affiliator.meta === 'object' && !Array.isArray(affiliator.meta)
        ? { ...(affiliator.meta as Record<string, unknown>) }
        : {};

    await this.prisma.affilator.update({
      where: { userId: partnerUserId },
      data: {
        meta: {
          ...root,
          kick: { ...kick, widgetAlerts },
        },
      },
    });

    return item;
  }

  async getAlertsForPartner(
    partnerUserId: number,
    after?: string | null,
  ): Promise<KickWidgetAlertItem[]> {
    const affiliator = await this.prisma.affilator.findUnique({
      where: { userId: partnerUserId },
      select: { meta: true },
    });
    if (!affiliator) return [];

    const kick = this.readKickMeta(affiliator.meta);
    const alerts = Array.isArray(kick.widgetAlerts) ? kick.widgetAlerts : [];
    if (!after) return alerts;

    const idx = alerts.findIndex((a) => a.id === after);
    if (idx === -1) {
      const afterTs = Date.parse(after);
      if (!Number.isNaN(afterTs)) {
        return alerts.filter((a) => Date.parse(a.createdAt) > afterTs);
      }
      return alerts;
    }
    return alerts.slice(idx + 1);
  }

  async getAlertsByTag(tag: string, after?: string | null) {
    const partner = await this.prisma.affilator.findFirst({
      where: { uid: tag, status: 'ACTIVE' },
      select: { userId: true },
    });
    if (!partner) return { found: false, alerts: [] as KickWidgetAlertItem[] };

    const alerts = await this.getAlertsForPartner(partner.userId, after);
    return { found: true, alerts };
  }
}
