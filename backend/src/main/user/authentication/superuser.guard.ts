import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ADMIN_ROLE_PERMISSIONS, AdminRole } from './admin-auth.types';

@Injectable()
export class SuperuserGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  private resolveRoleByToken(token: string): AdminRole | null {
    const rawMap = this.configService.get<string>('ADMIN_TOKENS_JSON');
    if (!rawMap) return null;
    try {
      const parsed = JSON.parse(rawMap) as Record<string, AdminRole>;
      const role = parsed[token];
      return role || null;
    } catch {
      return null;
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers['authorization']?.split(' ') ?? [];

    return type === 'Bearer' ? token : undefined;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException();
    }

    const configToken = this.configService.get<string>('SUPERUSER_TOKEN');
    const mappedRole = this.resolveRoleByToken(token);
    if (!mappedRole && (!configToken || token !== configToken)) {
      throw new UnauthorizedException();
    }

    const role: AdminRole = mappedRole || 'superadmin';
    request.adminRole = role;
    request.adminPermissions = ADMIN_ROLE_PERMISSIONS[role];
    request.adminToken = token;

    return true;
  }
}
