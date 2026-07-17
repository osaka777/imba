import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private ready = false;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('REDIS_HOST')?.trim();
    if (!host) return;

    const port = Number(this.config.get<string>('REDIS_PORT') || 6379);
    const password = this.config.get<string>('REDIS_PASSWORD')?.trim() || undefined;
    const db = Number(this.config.get<string>('REDIS_DB') || 0);

    try {
      this.client = new Redis({
        host,
        port,
        password,
        db,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        lazyConnect: true,
        connectTimeout: 2000,
      });

      this.client.on('ready', () => {
        this.ready = true;
      });
      this.client.on('error', (error) => {
        this.ready = false;
        this.logger.debug(`Redis error: ${error.message}`);
      });

      void this.client.connect().catch(() => {
        this.ready = false;
      });
    } catch (error) {
      this.logger.warn(
        `Redis init failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.client = null;
    }
  }

  isAvailable() {
    return Boolean(this.client && this.ready);
  }

  async get(key: string): Promise<string | null> {
    if (!this.isAvailable() || !this.client) return null;
    try {
      return await this.client.get(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttlMs: number): Promise<boolean> {
    if (!this.isAvailable() || !this.client) return false;
    try {
      await this.client.set(key, value, 'PX', Math.max(1000, ttlMs));
      return true;
    } catch {
      return false;
    }
  }

  async incrWithWindow(key: string, windowMs: number, max: number): Promise<boolean> {
    if (!this.isAvailable() || !this.client) return false;
    try {
      const count = await this.client.incr(key);
      if (count === 1) {
        await this.client.pexpire(key, windowMs);
      }
      return count <= max;
    } catch {
      return false;
    }
  }

  onModuleDestroy() {
    void this.client?.quit();
  }
}
