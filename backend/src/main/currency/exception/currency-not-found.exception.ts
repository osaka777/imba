import { BadRequestException } from '@nestjs/common';

export class CurrencyNotFound extends BadRequestException {
  constructor() {
    super(['currency not found']);
  }
}
