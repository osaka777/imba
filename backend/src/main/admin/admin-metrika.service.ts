import { Injectable, Logger } from '@nestjs/common';

type MetrikaVisitorsResponse = {
  configured: boolean;
  counterId: number | null;
  today: number | null;
  yesterday: number | null;
  week: number | null;
  error?: string;
};

@Injectable()
export class AdminMetrikaService {
  private readonly logger = new Logger(AdminMetrikaService.name);
  private cache: { at: number; data: MetrikaVisitorsResponse } | null = null;
  private readonly cacheTtlMs = 5 * 60 * 1000;

  private get counterId(): number | null {
    const raw = process.env.YANDEX_METRIKA_COUNTER_ID || '111057273';
    const id = Number(raw);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  private get token(): string | null {
    const token = (process.env.YANDEX_METRIKA_OAUTH_TOKEN || '').trim();
    return token || null;
  }

  async getVisitors(): Promise<MetrikaVisitorsResponse> {
    const counterId = this.counterId;
    const token = this.token;

    if (!counterId || !token) {
      return {
        configured: false,
        counterId,
        today: null,
        yesterday: null,
        week: null,
        error: !token
          ? 'YANDEX_METRIKA_OAUTH_TOKEN не задан'
          : 'YANDEX_METRIKA_COUNTER_ID не задан',
      };
    }

    if (this.cache && Date.now() - this.cache.at < this.cacheTtlMs) {
      return this.cache.data;
    }

    try {
      const [today, yesterday, week] = await Promise.all([
        this.fetchUsers(counterId, token, 'today', 'today'),
        this.fetchUsers(counterId, token, 'yesterday', 'yesterday'),
        this.fetchUsers(counterId, token, '7daysAgo', 'today'),
      ]);

      const data: MetrikaVisitorsResponse = {
        configured: true,
        counterId,
        today,
        yesterday,
        week,
      };
      this.cache = { at: Date.now(), data };
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Metrika API error';
      this.logger.warn(`Metrika visitors failed: ${message}`);
      return {
        configured: true,
        counterId,
        today: null,
        yesterday: null,
        week: null,
        error: message,
      };
    }
  }

  private async fetchUsers(
    counterId: number,
    token: string,
    date1: string,
    date2: string,
  ): Promise<number> {
    const url = new URL('https://api-metrika.yandex.net/stat/v1/data');
    url.searchParams.set('ids', String(counterId));
    url.searchParams.set('metrics', 'ym:s:users');
    url.searchParams.set('date1', date1);
    url.searchParams.set('date2', date2);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `OAuth ${token}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Metrika ${response.status}: ${text.slice(0, 200)}`);
    }

    const json = (await response.json()) as {
      totals?: Array<number | string>;
      data?: Array<{ metrics?: Array<number | string> }>;
    };

    const total = json.totals?.[0] ?? json.data?.[0]?.metrics?.[0] ?? 0;
    return Math.round(Number(total) || 0);
  }
}
