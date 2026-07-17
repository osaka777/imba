import { Inject, Injectable } from '@nestjs/common';
import { Logger } from 'winston';

export type TelegramUserMessageOptions = {
  buttonUrl?: string;
  buttonText?: string;
};

@Injectable()
export class TelegramNotifyService {
  constructor(
    @Inject('winston')
    private readonly logger: Logger,
  ) {}

  async sendUserMessage(
    telegramUserId: string,
    message: string,
    options?: TelegramUserMessageOptions,
  ): Promise<{ ok: boolean; error?: string }> {
    const url = process.env.TELEGRAM_USER_NOTIFY_URL;
    if (!url) {
      this.logger.warn('TELEGRAM_USER_NOTIFY_URL is not configured', {
        context: 'TelegramNotifyService',
      });
      return { ok: false, error: 'not_configured' };
    }

    const fetchFn: typeof fetch | undefined = (globalThis as { fetch?: typeof fetch }).fetch;
    if (!fetchFn) return { ok: false, error: 'fetch_unavailable' };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const notifySecret = process.env.TELEGRAM_NOTIFY_SECRET;
    if (notifySecret) {
      headers['X-Notify-Secret'] = notifySecret;
    }

    try {
      const resp = await fetchFn(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          telegramUserId,
          message,
          ...(options?.buttonUrl ? { buttonUrl: options.buttonUrl } : {}),
          ...(options?.buttonText ? { buttonText: options.buttonText } : {}),
        }),
      });
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        const error = `${resp.status} ${body}`.slice(0, 500);
        this.logger.warn(`Telegram user notify failed: ${error}`, {
          context: 'TelegramNotifyService',
        });
        return { ok: false, error };
      }
      return { ok: true };
    } catch (error) {
      const message = String(error);
      this.logger.warn('Telegram user notify error', {
        context: 'TelegramNotifyService',
        error: message,
      });
      return { ok: false, error: message };
    }
  }

  async sendSupportMessage(message: string): Promise<{ ok: boolean; error?: string }> {
    // Operator/support inbox — @Imbabetsupport_bot (never imbabetalert user bot).
    const targetUrl =
      process.env.TELEGRAM_SUPPORT_NOTIFY_URL ||
      process.env.TELEGRAM_NOTIFY_URL?.replace(/\/notify$/, '/notify-support') ||
      'http://imba-bot:8088/notify-support';

    const fetchFn: typeof fetch | undefined = (globalThis as { fetch?: typeof fetch }).fetch;
    if (!fetchFn) return { ok: false, error: 'fetch_unavailable' };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const notifySecret = process.env.TELEGRAM_NOTIFY_SECRET;
    if (notifySecret) {
      headers['X-Notify-Secret'] = notifySecret;
    }

    try {
      const resp = await fetchFn(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message }),
      });
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        const error = `${resp.status} ${body}`.slice(0, 500);
        this.logger.warn(`Telegram support notify failed: ${error}`, {
          context: 'TelegramNotifyService',
        });
        return { ok: false, error };
      }
      return { ok: true };
    } catch (error) {
      const err = String(error);
      this.logger.warn('Telegram support notify error', {
        context: 'TelegramNotifyService',
        error: err,
      });
      return { ok: false, error: err };
    }
  }
}
