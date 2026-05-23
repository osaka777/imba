import { NotFoundException } from '@nestjs/common';

export class GameNotFoundException extends NotFoundException {
  constructor(message?: string) {
    super(message ? [message] : ['game not found']);
  }
}
