import { Injectable } from '@nestjs/common';

import { PrismaService } from '~/prisma/prisma.service';

import { RegisterPushDto, UpdatePushNotificationsDto } from './dto/register-push.dto';

@Injectable()
export class PushService {
  constructor(private readonly prisma: PrismaService) {}

  async registerDevice(userId: number | null, dto: RegisterPushDto) {
    const data = {
      userId,
      platform: dto.platform ?? 'android',
      appVersion: dto.appVersion,
      notifyBets: dto.notifyBets ?? true,
      notifyDeposit: dto.notifyDeposit ?? true,
      notifyWithdraw: dto.notifyWithdraw ?? true,
      notifyPromo: dto.notifyPromo ?? false,
      notifyLiveMatch: dto.notifyLiveMatch ?? true,
    };

    if (userId != null) {
      await this.prisma.pushDevice.deleteMany({
        where: {
          userId,
          platform: dto.platform ?? 'android',
          fcmToken: { not: dto.fcmToken },
        },
      });
    }

    return this.prisma.pushDevice.upsert({
      where: { fcmToken: dto.fcmToken },
      create: {
        fcmToken: dto.fcmToken,
        ...data,
      },
      update: data,
    });
  }

  async unlinkDevice(userId: number, fcmToken: string) {
    await this.prisma.pushDevice.deleteMany({
      where: { userId, fcmToken },
    });
    return { ok: true };
  }

  async getPreferences(userId: number, fcmToken?: string) {
    const device = fcmToken
      ? await this.prisma.pushDevice.findFirst({
          where: { userId, fcmToken },
        })
      : await this.prisma.pushDevice.findFirst({
          where: { userId },
          orderBy: { updatedAt: 'desc' },
        });

    return {
      registered: Boolean(device),
      bets: device?.notifyBets ?? true,
      deposit: device?.notifyDeposit ?? true,
      withdraw: device?.notifyWithdraw ?? true,
      promo: device?.notifyPromo ?? false,
      liveMatch: device?.notifyLiveMatch ?? true,
    };
  }

  async updatePreferences(userId: number, fcmToken: string, dto: UpdatePushNotificationsDto) {
    const data: Record<string, boolean> = {};
    if (dto.bets !== undefined) data.notifyBets = dto.bets;
    if (dto.deposit !== undefined) data.notifyDeposit = dto.deposit;
    if (dto.withdraw !== undefined) data.notifyWithdraw = dto.withdraw;
    if (dto.promo !== undefined) data.notifyPromo = dto.promo;
    if (dto.liveMatch !== undefined) data.notifyLiveMatch = dto.liveMatch;

    if (!Object.keys(data).length) {
      return this.getPreferences(userId, fcmToken);
    }

    await this.prisma.pushDevice.updateMany({
      where: { userId, fcmToken },
      data,
    });

    return this.getPreferences(userId, fcmToken);
  }

  async listUserDevices(userId: number) {
    return this.prisma.pushDevice.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
