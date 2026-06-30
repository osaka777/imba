import { Injectable } from '@nestjs/common';

import { PrismaService } from '~/prisma/prisma.service';

export type TelegramLogStatus = 'sent' | 'failed' | 'skipped';

@Injectable()
export class TelegramNotificationLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: {
    userId?: number;
    telegramUserId?: string;
    type: string;
    status: TelegramLogStatus;
    error?: string;
  }): Promise<void> {
    try {
      await this.prisma.telegramNotificationLog.create({
        data: {
          userId: input.userId,
          telegramUserId: input.telegramUserId,
          type: input.type,
          status: input.status,
          error: input.error?.slice(0, 500),
        },
      });
    } catch {
      // logging must not break main flow
    }
  }
}
