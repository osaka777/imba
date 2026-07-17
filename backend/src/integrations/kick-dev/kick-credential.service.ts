import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

import { PrismaService } from '~/prisma/prisma.service';

import {
  decryptKickCredential,
  encryptKickCredential,
  resolveKickEncryptionKey,
  type KickCredentialPayload,
} from './kick-credential.crypto';
import type { KickPartnerMeta } from './kick-partner.types';
import { buildKickTokenMetaPatch, type KickOAuthTokenResponse } from './kick-token.util';

@Injectable()
export class KickCredentialService {
  private readonly logger = new Logger(KickCredentialService.name);
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.encryptionKey = resolveKickEncryptionKey(
      this.config.get<string>('KICK_DEV_CLIENT_SECRET')?.trim() || '',
      this.config.get<string>('KICK_TOKEN_ENCRYPTION_KEY')?.trim() || null,
    );
  }

  private readKickMeta(meta: Prisma.JsonValue | null | undefined): KickPartnerMeta {
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return {};
    const root = meta as Record<string, unknown>;
    const kick = root.kick;
    if (!kick || typeof kick !== 'object' || Array.isArray(kick)) return {};
    return kick as KickPartnerMeta;
  }

  private async stripTokensFromMeta(partnerUserId: number) {
    const current = await this.prisma.affilator.findUnique({
      where: { userId: partnerUserId },
      select: { meta: true },
    });
    const kick = this.readKickMeta(current?.meta ?? null);
    if (!kick.accessToken && !kick.refreshToken) return;

    const currentMeta =
      current?.meta && typeof current.meta === 'object' && !Array.isArray(current.meta)
        ? (current.meta as Record<string, unknown>)
        : {};

    const {
      accessToken: _a,
      refreshToken: _r,
      ...publicKick
    } = kick;

    await this.prisma.affilator.update({
      where: { userId: partnerUserId },
      data: {
        meta: {
          ...currentMeta,
          kick: publicKick,
        } as Prisma.InputJsonValue,
      },
    });
  }

  async hasCredentials(partnerUserId: number) {
    const row = await this.prisma.kickPartnerCredential.findUnique({
      where: { partnerUserId },
      select: { partnerUserId: true },
    });
    if (row) return true;

    const affiliator = await this.prisma.affilator.findUnique({
      where: { userId: partnerUserId },
      select: { meta: true },
    });
    const kick = this.readKickMeta(affiliator?.meta ?? null);
    return Boolean(kick.accessToken);
  }

  async getPayload(partnerUserId: number): Promise<KickCredentialPayload | null> {
    const row = await this.prisma.kickPartnerCredential.findUnique({
      where: { partnerUserId },
    });

    if (row) {
      return decryptKickCredential(row.payloadEnc, this.encryptionKey);
    }

    const affiliator = await this.prisma.affilator.findUnique({
      where: { userId: partnerUserId },
      select: { meta: true },
    });
    const kick = this.readKickMeta(affiliator?.meta ?? null);
    if (!kick.accessToken) return null;

    const payload: KickCredentialPayload = {
      accessToken: kick.accessToken,
      refreshToken: kick.refreshToken ?? null,
      scopes: kick.scopes ?? null,
    };

    await this.savePayload(partnerUserId, payload, {
      tokenExpiresAt: kick.tokenExpiresAt ?? null,
      tokenRefreshFailedAt: kick.tokenRefreshFailedAt ?? null,
    });
    await this.stripTokensFromMeta(partnerUserId);
    this.logger.log(`Migrated Kick tokens to encrypted store for partner ${partnerUserId}`);
    return payload;
  }

  async savePayload(
    partnerUserId: number,
    payload: KickCredentialPayload,
    meta?: {
      tokenExpiresAt?: string | null;
      tokenRefreshFailedAt?: string | null;
    },
  ) {
    const enc = encryptKickCredential(payload, this.encryptionKey);
    await this.prisma.kickPartnerCredential.upsert({
      where: { partnerUserId },
      create: {
        partnerUserId,
        payloadEnc: enc,
        tokenExpiresAt: meta?.tokenExpiresAt ? new Date(meta.tokenExpiresAt) : null,
        tokenRefreshFailedAt: meta?.tokenRefreshFailedAt
          ? new Date(meta.tokenRefreshFailedAt)
          : null,
      },
      update: {
        payloadEnc: enc,
        tokenExpiresAt: meta?.tokenExpiresAt ? new Date(meta.tokenExpiresAt) : undefined,
        tokenRefreshFailedAt: meta?.tokenRefreshFailedAt
          ? new Date(meta.tokenRefreshFailedAt)
          : meta?.tokenRefreshFailedAt === null
            ? null
            : undefined,
      },
    });
  }

  async saveFromOAuthResponse(partnerUserId: number, tokens: KickOAuthTokenResponse, current?: KickPartnerMeta) {
    const patch = buildKickTokenMetaPatch(tokens, current);
    if (!patch.accessToken) return;

    await this.savePayload(
      partnerUserId,
      {
        accessToken: patch.accessToken,
        refreshToken: patch.refreshToken ?? null,
        scopes: patch.scopes ?? null,
      },
      {
        tokenExpiresAt: patch.tokenExpiresAt ?? null,
        tokenRefreshFailedAt: null,
      },
    );
    await this.stripTokensFromMeta(partnerUserId);
  }

  async markRefreshFailed(partnerUserId: number) {
    const at = new Date();
    await this.prisma.kickPartnerCredential.updateMany({
      where: { partnerUserId },
      data: { tokenRefreshFailedAt: at },
    });

    const affiliator = await this.prisma.affilator.findUnique({
      where: { userId: partnerUserId },
      select: { meta: true },
    });
    const kick = this.readKickMeta(affiliator?.meta ?? null);
    const currentMeta =
      affiliator?.meta && typeof affiliator.meta === 'object' && !Array.isArray(affiliator.meta)
        ? (affiliator.meta as Record<string, unknown>)
        : {};

    await this.prisma.affilator.update({
      where: { userId: partnerUserId },
      data: {
        meta: {
          ...currentMeta,
          kick: {
            ...kick,
            tokenRefreshFailedAt: at.toISOString(),
          },
        } as Prisma.InputJsonValue,
      },
    });
  }

  async clearRefreshFailed(partnerUserId: number) {
      await this.prisma.kickPartnerCredential.update({
        where: { partnerUserId },
        data: { tokenRefreshFailedAt: null, tokenAlertSentAt: null },
      });
  }

  async getTokenExpiresAt(partnerUserId: number): Promise<string | null> {
    const row = await this.prisma.kickPartnerCredential.findUnique({
      where: { partnerUserId },
      select: { tokenExpiresAt: true },
    });
    if (row?.tokenExpiresAt) return row.tokenExpiresAt.toISOString();

    const affiliator = await this.prisma.affilator.findUnique({
      where: { userId: partnerUserId },
      select: { meta: true },
    });
    return this.readKickMeta(affiliator?.meta ?? null).tokenExpiresAt ?? null;
  }

  async getTokenRefreshFailedAt(partnerUserId: number): Promise<string | null> {
    const row = await this.prisma.kickPartnerCredential.findUnique({
      where: { partnerUserId },
      select: { tokenRefreshFailedAt: true },
    });
    if (row?.tokenRefreshFailedAt) return row.tokenRefreshFailedAt.toISOString();

    const affiliator = await this.prisma.affilator.findUnique({
      where: { userId: partnerUserId },
      select: { meta: true },
    });
    return this.readKickMeta(affiliator?.meta ?? null).tokenRefreshFailedAt ?? null;
  }

  async deleteCredentials(partnerUserId: number) {
    await this.prisma.kickPartnerCredential.deleteMany({
      where: { partnerUserId },
    });
  }
}
