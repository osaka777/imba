import { BadRequestException } from '@nestjs/common';

export class InsufficientFundsException extends BadRequestException {
  constructor() {
    super(['insufficient funds']);
  }
}
