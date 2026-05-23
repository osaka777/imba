import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CurrencyService } from './currency.service';
import { CurrencyDto } from './dto/currency.dto';

@Controller('currencies')
export class CurrencyController {
  constructor(private readonly currenciesService: CurrencyService) {}

  @Get('')
  @ApiTags('Finance')
  async getAll(): Promise<CurrencyDto[]> {
    const currencies = await this.currenciesService.getAll();
    return currencies.map((e) => new CurrencyDto(e));
  }
}
