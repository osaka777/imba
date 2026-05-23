import { ApiProperty } from '@nestjs/swagger';

export class HttpException {
  @ApiProperty({ example: 'Bad Request' })
  error: string;
  @ApiProperty({ example: ['email is already taken'] })
  message: string[];
  @ApiProperty({ example: 400 })
  statusCode: number;
}
