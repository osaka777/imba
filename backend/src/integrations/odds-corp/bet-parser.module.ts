import { Module } from '@nestjs/common';

import { BetParser } from './bet-parser.service';

@Module({
  exports: [BetParser],
  providers: [BetParser],
})
export class BetParserModule {}
