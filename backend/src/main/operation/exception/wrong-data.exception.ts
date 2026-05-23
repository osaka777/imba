import { BadRequestException } from '@nestjs/common';

export class InvalidAmountException extends BadRequestException {
  constructor() {
    super(['invalid amount']);
  }
}
