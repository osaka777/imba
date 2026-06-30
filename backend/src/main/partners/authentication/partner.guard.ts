import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '~/prisma/prisma.service';

@Injectable()
export class PartnerGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {}

  private extractToken(request: {
    cookies?: Record<string, string>;
    headers?: { authorization?: string };
  }): string | undefined {
    if (request.cookies?.accessToken || request.cookies?.access_token) {
      return request.cookies.accessToken || request.cookies.access_token;
    }

    const [type, token] = request.headers?.authorization?.split(' ') ?? [];
    if (type === 'Bearer' && token) {
      return token;
    }

    return undefined;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException();
    }

    let payload: { id?: number; email?: string; userType?: string };
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException();
    }

    if (payload.id == null) {
      throw new UnauthorizedException();
    }

    const affilator = await this.prismaService.affilator.findUnique({
      where: { userId: payload.id },
    });

    if (!affilator) {
      throw new UnauthorizedException();
    }

    request.user = {
      id: payload.id,
      email: payload.email,
      userType: 'partner',
    };

    return true;
  }
}
