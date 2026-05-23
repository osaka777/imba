import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

type HitBucket = { count: number; resetAt: number };

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, HitBucket>();
  private readonly windowMs = 60_000;
  private readonly maxAttempts = 20;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const forwarded = request.headers['x-forwarded-for'];
    const ip =
      (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : '') ||
      request.ip ||
      request.socket?.remoteAddress ||
      'unknown';

    const now = Date.now();
    const bucket = this.hits.get(ip);

    if (!bucket || now >= bucket.resetAt) {
      this.hits.set(ip, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    bucket.count += 1;
    if (bucket.count > this.maxAttempts) {
      throw new HttpException(
        'Too many requests. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
