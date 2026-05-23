import { BadRequestException } from '@nestjs/common';

export class EmailIsAlreadyTakenException extends BadRequestException {
  constructor() {
    super(['email is already taken']);
  }
}
