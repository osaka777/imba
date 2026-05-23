import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Decimal } from '@prisma/client/runtime/library';

import { AuthenticationGuard } from '~/main/user/authentication/authentication.guard';
import { SuperuserGuard } from '~/main/user/authentication/superuser.guard';
import { UserService } from '~/main/user/user.service';
import { PrismaService } from '~/prisma/prisma.service';

import { BalanceDto } from './dto/get-balance.dto';
import { OperationDto } from './dto/get-operation.dto';
import { OperationService } from './operation.service';

@Controller('finance')
@ApiTags('Finance')
export class OperationController {
  constructor(
    private readonly userService: UserService,
    private readonly operationService: OperationService,
    private readonly prismaService: PrismaService,
  ) {}

  @Get('/balance')
  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  async getMyBalances(@Req() req): Promise<BalanceDto[]> {
    const userId = req.user.id;
    const balance = await this.operationService.getBalances(userId);
    return balance.map((e) => new BalanceDto(e));
  }

  @Get('/operation')
  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  async getMyOperations(@Req() req): Promise<OperationDto[]> {
    const userId = req.user.id;
    const operations = await this.operationService.getOperations(userId);
    return operations.map((e) => new OperationDto(e));
  }

  @Get('/topup/history')
  @UseGuards(SuperuserGuard)
  @ApiBearerAuth('Admin')
  async getTopupHistory() {
    const operations = await this.prismaService.operation.findMany({
      where: {
        type: 'INCOME',
        source: 'PAYMENT_SYSTEM',
        meta: {
          path: ['title'],
          equals: 'ADMIN TOPUP'
        }
      },
      include: {
        user: {
          select: {
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 100
    });

    return operations.map(op => ({
      id: op.id.toString(),
      email: op.user.email,
      currencyCode: op.currencyCode,
      amount: parseFloat(op.amount.toString()),
      createdAt: op.createdAt.toISOString(),
      status: op.status.toLowerCase()
    }));
  }

  @Get('/topup/:email/:currencyCode/:amount/')
  @UseGuards(SuperuserGuard)
  @ApiBearerAuth('Admin')
  async topup(
    @Param('email') email: string,
    @Param('currencyCode') currencyCode: string,
    @Param('amount') amount: string,
  ) {
    console.log('[TopupController] Topup request received:', { email, currencyCode, amount });
    
    try {
      // Валидация суммы
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        console.error('[TopupController] Invalid amount:', amount);
        throw new Error('Некорректная сумма');
      }

      // Поиск пользователя
      const user = await this.userService.findByEmail(email);
      if (!user) {
        console.error('[TopupController] User not found:', email);
        throw new Error(`Пользователь с email ${email} не найден`);
      }
      
      console.log('[TopupController] User found:', { userId: user.id, email: user.email });

      // Выполнение операции в транзакции
      const result = await this.prismaService.$transaction(async (tx) => {
        return await this.operationService.create(tx, user.id, {
          amount: new Decimal(amount),
          currencyCode,
          meta: {
            title: 'ADMIN TOPUP',
          },
          source: 'PAYMENT_SYSTEM',
          status: 'SUCCESS',
          type: 'INCOME',
        });
      });

      console.log('[TopupController] Topup completed successfully:', { 
        operationId: result.id, 
        userId: user.id,
        amount: amount,
        currency: currencyCode
      });

      return {
        success: true,
        operationId: result.id,
        message: 'Пополнение выполнено успешно'
      };
      
    } catch (error) {
      console.error('[TopupController] Topup failed:', {
        email,
        currencyCode,
        amount,
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Ошибка пополнения: ${error.message || 'Неизвестная ошибка'}`);
    }
  }

  @Get('/withdraw/:email/:currencyCode/:amount/')
  @UseGuards(SuperuserGuard)
  @ApiBearerAuth('Admin')
  async withdraw(
    @Param('email') email: string,
    @Param('currencyCode') currencyCode: string,
    @Param('amount') amount: string,
  ) {
    const user = await this.userService.findByEmail(email);

    return this.operationService.create(this.prismaService, user.id, {
      amount: new Decimal(amount),
      currencyCode,
      meta: {
        title: 'ADMIN WITHDRAW',
      },
      source: 'PAYMENT_SYSTEM',
      status: 'SUCCESS',
      type: 'OUTCOME',
    });
  }
}
