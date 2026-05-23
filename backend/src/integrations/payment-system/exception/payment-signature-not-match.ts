import { ForbiddenException } from '@nestjs/common';

export class PaymentSignatureNotMatch extends ForbiddenException {
  constructor() {
    super(['payment signature not match']);
  }
}
