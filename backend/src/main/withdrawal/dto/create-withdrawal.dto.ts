import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsNotEmpty, Min, IsEnum, IsOptional } from 'class-validator';

// Методы вывода
export enum WithdrawalMethod {
  CARD = 'CARD',
  CRYPTO = 'CRYPTO',
}

// Типы карт и криптовалют
export enum CardType {
  FOREIGN = 'FOREIGN', // Иностранная карта
  KAZAKHSTAN = 'KAZAKHSTAN', // Казахстанская карта
  RUSSIA = 'RUSSIA', // Российская карта
  TRC20 = 'TRC20', // TRC-20 криптовалюта
  TRON = 'TRON', // TRON криптовалюта
}

// Поддерживаемые валюты
export enum CurrencyCode {
  USD = 'USD',
  USDT = 'USDT',
  KZT = 'KZT',
  RUB = 'RUB',
  UAH = 'UAH',
  TRY = 'TRY',
  UZS = 'UZS',
}

// Быстрый выбор сумм
export const QUICK_AMOUNTS = {
  USD: [50, 100, 200, 500, 1000],
  USDT: [50, 100, 200, 500, 1000],
  KZT: [10000, 25000, 50000, 100000, 250000],
  RUB: [5000, 10000, 25000, 50000, 100000],
  UAH: [2000, 5000, 10000, 25000, 50000],
  TRY: [500, 1000, 2500, 5000, 10000],
  UZS: [500000, 1000000, 2500000, 5000000, 10000000],
};

export class CreateWithdrawalDto {
  @ApiProperty({ description: 'Метод вывода', enum: WithdrawalMethod })
  @IsEnum(WithdrawalMethod, { message: 'Неверный метод вывода' })
  method: WithdrawalMethod;

  @ApiProperty({ 
    description: 'Тип карты (только для метода CARD)', 
    enum: CardType,
    required: false 
  })
  @IsOptional()
  @IsEnum(CardType, { message: 'Неверный тип карты' })
  cardType?: CardType;

  @ApiProperty({ description: 'Номер карты или криптокошелька' })
  @IsString()
  @IsNotEmpty({ message: 'Номер карты/кошелька обязателен' })
  cardNumber: string;

  @ApiProperty({ description: 'Сумма вывода', minimum: 1 })
  @IsNumber({}, { message: 'Сумма должна быть числом' })
  @Min(1, { message: 'Минимальная сумма: 1' })
  amount: number;

  @ApiProperty({ description: 'Валюта', enum: CurrencyCode })
  @IsEnum(CurrencyCode, { message: 'Неверная валюта' })
  currency: CurrencyCode;

  @ApiProperty({ 
    description: 'Быстрый выбор суммы (опционально)', 
    required: false 
  })
  @IsOptional()
  @IsNumber({}, { message: 'Быстрая сумма должна быть числом' })
  quickAmount?: number;
}