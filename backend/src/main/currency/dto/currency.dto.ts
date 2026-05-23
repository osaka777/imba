import { Dto } from '~/common/types/dto';

export class CurrencyDto extends Dto<CurrencyDto> {
  isoCode: string;
  name: string;
}
