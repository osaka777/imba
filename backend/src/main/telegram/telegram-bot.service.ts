import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { WcOddsBetStatus } from '@prisma/client';

import { OperationService } from '~/main/operation/operation.service';
import { PrismaService } from '~/prisma/prisma.service';

import { TelegramLinkService } from './telegram-link.service';
import { getPublicSiteBaseUrl, publicGameUrl } from './public-site-url.util';

const BET_STATUS_LABEL: Record<string, string> = {
  WIN: 'Выигрыш',
  LOSE: 'Проигрыш',
  RETURN: 'Возврат',
  PENDING: 'В ожидании',
};

const RATE_LIMIT_MS = 15_000;
const RATE_LIMITED_COMMANDS = new Set(['/balance', 'balance', '/bets', 'bets']);

@Injectable()
export class TelegramBotService {
  private readonly commandCooldown = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly operationService: OperationService,
    private readonly linkService: TelegramLinkService,
  ) {}

  private siteBaseUrl(): string {
    return getPublicSiteBaseUrl();
  }

  private enforceRateLimit(telegramUserId: string, command: string): void {
    const normalized = command.trim().toLowerCase().split(/\s+/)[0] || '';
    if (!RATE_LIMITED_COMMANDS.has(normalized)) return;

    const now = Date.now();
    const key = `${telegramUserId}:${normalized}`;
    const last = this.commandCooldown.get(key) ?? 0;
    if (now - last < RATE_LIMIT_MS) {
      const waitSec = Math.ceil((RATE_LIMIT_MS - (now - last)) / 1000);
      throw new HttpException(`Подождите ${waitSec} сек.`, HttpStatus.TOO_MANY_REQUESTS);
    }
    this.commandCooldown.set(key, now);
  }

  private async findUserByTelegram(telegramUserId: string) {
    return this.prisma.user.findFirst({
      where: { telegramUserId },
      select: { id: true, email: true },
    });
  }

  private formatDate(d: Date): string {
    return d.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  async processCommand(telegramUserId: string, command: string): Promise<string> {
    this.enforceRateLimit(telegramUserId, command);
    const normalized = command.trim().toLowerCase().split(/\s+/)[0] || '';

    switch (normalized) {
      case '/balance':
      case 'balance':
        return this.formatBalance(telegramUserId);
      case '/bets':
      case 'bets':
        return this.formatRecentBets(telegramUserId);
      case '/unlink':
      case 'unlink':
        return '__UNLINK_CONFIRM__';
      case '/unlink_confirm':
      case 'unlink_confirm':
        return this.unlinkAccount(telegramUserId);
      case '/help':
      case 'help':
        return this.helpText();
      default:
        return this.helpText();
    }
  }

  helpText(): string {
    return (
      '📋 Команды imba.bet\n\n' +
      '/balance — баланс\n' +
      '/bets — последние ставки\n' +
      '/unlink — отвязать Telegram\n' +
      '/help — эта справка\n\n' +
      'Уведомления настраиваются в профиле на сайте.'
    );
  }

  private async formatBalance(telegramUserId: string): Promise<string> {
    const user = await this.findUserByTelegram(telegramUserId);
    if (!user) {
      return 'Аккаунт не привязан.\nОткройте ссылку из настроек профиля на imba.bet.';
    }

    const balances = await this.operationService.getBalances(user.id);
    if (!balances.length) {
      return '💰 Баланс: 0';
    }

    const lines = balances.map((b) => {
      const amount = Number(b.amount);
      const formatted = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
      return `• ${formatted} ${b.currencyCode}`;
    });

    return `💰 Баланс\n${lines.join('\n')}`;
  }

  private async formatRecentBets(telegramUserId: string): Promise<string> {
    const user = await this.findUserByTelegram(telegramUserId);
    if (!user) {
      return 'Аккаунт не привязан.\nОткройте ссылку из настроек профиля на imba.bet.';
    }

    const base = this.siteBaseUrl();

    const [bets, wcBets] = await Promise.all([
      this.prisma.bet.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          betCode: true,
          amount: true,
          cf: true,
          currencyCode: true,
          status: true,
          gameId: true,
          updatedAt: true,
          game: { select: { team1: true, team2: true } },
        },
      }),
      this.prisma.wcOddsBet.findMany({
        where: { userId: user.id, isProbe: false },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          stake: true,
          odds: true,
          currencyCode: true,
          status: true,
          outcomeName: true,
          eventId: true,
          updatedAt: true,
          event: { select: { slug: true, homeTeam: true, awayTeam: true } },
        },
      }),
    ]);

    type Row = {
      label: string;
      status: string;
      amount: string;
      odds: string;
      link: string;
      at: Date;
    };

    const rows: Row[] = [
      ...bets.map((b) => ({
        label: b.game
          ? `${b.game.team1} — ${b.game.team2}`
          : b.betCode
            ? `Ставка ${b.betCode}`
            : 'Ставка',
        status: BET_STATUS_LABEL[b.status] ?? b.status,
        amount: `${Number(b.amount)} ${b.currencyCode}`,
        odds: `кф. ${Number(b.cf)}`,
        link: `${base}/game/${b.gameId}`,
        at: b.updatedAt,
      })),
      ...wcBets.map((b) => ({
        label: b.event
          ? `${b.event.homeTeam} — ${b.event.awayTeam}`
          : b.outcomeName
            ? `WC: ${b.outcomeName}`
            : `WC #${b.id}`,
        status: this.mapWcStatus(b.status),
        amount: `${Number(b.stake)} ${b.currencyCode}`,
        odds: `кф. ${Number(b.odds)}`,
        link: b.event?.slug
          ? publicGameUrl(b.event.slug)
          : `${this.siteBaseUrl()}/profile/betHistory`,
        at: b.updatedAt,
      })),
    ];

    rows.sort((a, b) => b.at.getTime() - a.at.getTime());
    const top = rows.slice(0, 5);

    if (!top.length) {
      return '🎯 Ставок пока нет';
    }

    const lines = top.map((row, i) => {
      const date = this.formatDate(row.at);
      return (
        `${i + 1}. ${row.label}\n` +
        `   ${row.status} · ${row.amount} · ${row.odds}\n` +
        `   ${date}\n` +
        `   ${row.link}`
      );
    });

    return `🎯 Последние ставки\n\n${lines.join('\n\n')}`;
  }

  private mapWcStatus(status: WcOddsBetStatus): string {
    switch (status) {
      case WcOddsBetStatus.WIN:
        return 'Выигрыш';
      case WcOddsBetStatus.LOSE:
        return 'Проигрыш';
      case WcOddsBetStatus.VOID:
        return 'Возврат';
      default:
        return 'В ожидании';
    }
  }

  private async unlinkAccount(telegramUserId: string): Promise<string> {
    const user = await this.findUserByTelegram(telegramUserId);
    if (!user) {
      return 'Telegram не привязан к аккаунту imba.bet.';
    }

    await this.linkService.unlink(user.id);
    return (
      '✅ Telegram отвязан от imba.bet\n\n' +
      'Уведомления и сброс пароля через бота больше недоступны.\n' +
      'Привязать снова можно в настройках профиля на сайте.'
    );
  }
}
