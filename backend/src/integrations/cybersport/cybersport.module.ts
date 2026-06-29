import { Module } from '@nestjs/common';

import { CybersportController } from './cybersport.controller';
import { CybersportService } from './cybersport.service';

@Module({
  controllers: [CybersportController],
  providers: [CybersportService],
  exports: [CybersportService],
})
export class CybersportModule {}
