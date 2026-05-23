import { UnauthorizedException } from '@nestjs/common';

export class UnauthenticatedException extends UnauthorizedException {
  constructor() {
    super('wrong email or password');
  }
}
