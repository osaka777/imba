import { ApiProperty } from '@nestjs/swagger';

export class CreateBetResponseDto {
  @ApiProperty({ description: 'Успешность операции', example: true })
  success: boolean;

  @ApiProperty({ description: 'ID созданной ставки', example: '67890' })
  betId?: string;

  @ApiProperty({ description: 'Сообщение об ошибке', required: false })
  error?: string;

  @ApiProperty({ description: 'Статус ставки', example: 'PENDING' })
  status?: string;

  @ApiProperty({ description: 'Потенциальный выигрыш', example: 185 })
  potentialPayout?: number;

  @ApiProperty({ description: 'Результат расчета ставки', required: false })
  calculationResult?: any;

  @ApiProperty({ description: 'Код ошибки BetAPI', required: false, example: 1 })
  errorCode?: number | string;

  @ApiProperty({ description: 'Изменился ли коэффициент', required: false, example: false })
  coefficientChanged?: boolean;

  @ApiProperty({ description: 'Оригинальный коэффициент', required: false, example: 1.85 })
  originalCoefficient?: number;

  @ApiProperty({ description: 'Актуальный коэффициент', required: false, example: 1.90 })
  actualCoefficient?: number;

  @ApiProperty({ description: 'Детали ошибки', required: false })
  details?: {
    required?: number;
    available?: string;
    currency?: string;
    message?: string;
  };

  @ApiProperty({ description: 'Сообщение об ошибке (дополнительное)', required: false })
  message?: string;
}
