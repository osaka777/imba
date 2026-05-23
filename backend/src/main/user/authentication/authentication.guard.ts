import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { AuthenticationService } from './authentication.service';

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(private authenticationService: AuthenticationService) {}

  /**
   * Universal token extraction: cookie first, then Authorization header
   */
  private extractToken(request: any): string | undefined {
    // 1. Из cookie (проверяем оба варианта названия)
    if (request.cookies && (request.cookies['accessToken'] || request.cookies['access_token'])) {
      return request.cookies['accessToken'] || request.cookies['access_token'];
    }
    
    // 2. Из Authorization
    const [type, token] = request.headers['authorization']?.split(' ') ?? [];
    if (type === 'Bearer' && token) {
      return token;
    }
    
    return undefined;
  }

  /**
   * Checks if the profile is authenticated by validating the token in the request header.
   * @param context - The execution context.
   * @returns A Promise that resolves to a boolean indicating if the profile is authenticated.
   * @throws UnauthorizedException if the token is missing or invalid.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    const token = this.extractToken(request);
    if (!token) {
      console.log('[AuthenticationGuard] No token found - throwing UnauthorizedException');
      throw new UnauthorizedException();
    }
    
    console.log('[AuthenticationGuard] Token found, verifying...');
    try {
      request.user = await this.authenticationService.verify(token);
      console.log('[AuthenticationGuard] Token verified successfully, user ID:', request.user.id);
    } catch (error) {
      console.log('[AuthenticationGuard] Token verification failed:', error.message);
      throw new UnauthorizedException();
    }
    return true;
  }
}
