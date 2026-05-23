import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import { ConfigService } from '@nestjs/config';
import { DepositStatus } from '@prisma/client';
import { PrismaService } from '~/prisma/prisma.service';

export interface PayinRequest {
  amount: number; // Минимум зависит от валюты
  redirectURL: string;
  siteName: string;
  callbackURL: string;
  externalID: string;
  currency: 'KZT' | 'TRY' | 'UZS';
  userInfo?: {
    id?: string;
    ip?: string;
    userAgent?: string;
    email?: string;
  };
}

export interface PayinResponse {
  success: boolean;
  data?: {
    redirectURL: string; // URL для перенаправления пользователя на оплату
  };
  reason?: string;
}

export interface PayinStatus {
  data: {
    externalID: string;
    amount: number;
    redirectURL: string;
    header: string;
    callbackURL: string;
    status: 'ACCEPTED' | 'SUCCESS' | 'ERROR';
    created: string;
    tokenCode?: string;
  };
}

@Injectable()
export class NirvanaPayPayinService {
  private readonly logger = new Logger(NirvanaPayPayinService.name);
  private readonly apiUrl: string;
  private readonly currencyKeys: {
    [key: string]: {
      publicKey: string;
      secretKey: string;
    };
  };

  // Конфигурация банков Казахстана для пополнения
  private readonly bankConfig = {
    KZT: {
      'Kaspi Bank': {
        token: 'Kaspi Bank',
        minAmount: 3000,
        maxAmount: 600000,
        commission: 8.0, // 8% для PayIn согласно документации
        description: 'Kaspi Bank Kazakhstan'
      },
      'Mbank (transfer to Kyrgyzstan)': {
        token: 'Mbank (transfer to Kyrgyzstan)',
        minAmount: 3000,
        maxAmount: 600000,
        commission: 8.0, // 8% для PayIn согласно документации
        description: 'Mbank transfer to Kyrgyzstan'
      }
    },
    TRY: {
      'Turkish Bank': {
        token: 'Turkish Bank',
        minAmount: 3000,
        maxAmount: 5000000,
        commission: 8.0,
        description: 'Turkish Bank for TRY deposits'
      }
    },
    UZS: {
      'Uzbek Bank': {
        token: 'Uzbek Bank',
        minAmount: 5000,
        maxAmount: 5000000,
        commission: 5.50,
        description: 'Uzbek Bank for UZS deposits'
      }
    }
  };

  constructor(
    private configService: ConfigService,
    private prismaService: PrismaService,
  ) {
    // Инициализируем API URL
    this.apiUrl = this.configService.get<string>('NIRVANAPAY_API_BASE_URL') || 'https://f.nirvanapay.pro';

    // Инициализируем ключи для каждой валюты
    this.currencyKeys = {
      KZT: {
        publicKey: this.configService.get<string>('NIRVANAPAY_API_PUBLIC_KZT_KEY'),
        secretKey: this.configService.get<string>('NIRVANAPAY_API_SECRET_KZT_KEY'),
      },
      TRY: {
        publicKey: this.configService.get<string>('NIRVANAPAY_API_PUBLIC_TRY_KEY'),
        secretKey: this.configService.get<string>('NIRVANAPAY_API_SECRET_TRY_KEY'),
      },
      UZS: {
        publicKey: this.configService.get<string>('NIRVANAPAY_API_PUBLIC_UZS_KEY'),
        secretKey: this.configService.get<string>('NIRVANAPAY_API_SECRET_UZS_KEY'),
      },
    };

    // Логируем инициализацию
    Object.keys(this.currencyKeys).forEach(currency => {
      const keys = this.currencyKeys[currency];
      if (keys.publicKey && keys.secretKey) {
        this.logger.log(`NirvanaPay initialized for ${currency} with public key: ${keys.publicKey.substring(0, 8)}...`);
      } else {
        this.logger.warn(`NirvanaPay keys not configured for ${currency}`);
      }
    });
  }

  private getHeaders(currency: 'KZT' | 'TRY' | 'UZS') {
    const keys = this.currencyKeys[currency];
    if (!keys) {
      throw new Error(`Currency ${currency} is not configured`);
    }
    
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'ApiPublic': keys.publicKey,
      'ApiPrivate': keys.secretKey
    };
  }

  /**
   * Создание заявки на пополнение средств через API v2
   */
  async createPayin(request: PayinRequest): Promise<PayinResponse> {
    this.logger.log(`Creating payin order for externalID: ${request.externalID}, amount: ${request.amount} ${request.currency}`);
    
    try {
      // Валидация входных данных
      const validation = this.validatePayinRequest(request);
      if (!validation.valid) {
        this.logger.error(`Validation failed for payin request: ${validation.errors.join(', ')}`);
        return {
          success: false,
          reason: validation.errors.join(', ')
        };
      }

      // Формирование callbackURL без перестановок домена (используем как есть)
      const callbackURL = request.callbackURL;

      // Подготовка данных для API v2 согласно документации
      const orderData: any = {
        amount: request.amount,
        redirectURL: request.redirectURL,
        siteName: request.siteName,
        callbackURL: callbackURL,
        externalID: request.externalID,
        currency: request.currency,
        userInfo: {
          id: request.userInfo?.id || '',
          ip: request.userInfo?.ip || '127.0.0.1',
          userAgent: request.userInfo?.userAgent || '',
          email: request.userInfo?.email || ''
        }
      };
      


      this.logger.log(`Creating order request: ${JSON.stringify(orderData)}`);

      // Отправка запроса к NirvanaPay API v2
      const response: AxiosResponse = await axios.post(
        `${this.apiUrl}/api/v2/order`,
        orderData,
        {
          headers: this.getHeaders(request.currency),
          timeout: 30000
        }
      );
      
      this.logger.log(`NirvanaPay API response status: ${response.status}`);
      this.logger.log(`NirvanaPay order response: ${JSON.stringify(response.data)}`);
      
      // Детальное логирование структуры ответа для диагностики
      if (response.data) {
        this.logger.log(`Response data: ${JSON.stringify(response.data)}`);
        if (response.data.data && response.data.data.redirectURL) {
          this.logger.log(`Response redirectURL: ${response.data.data.redirectURL}`);
        }
      }

      // Проверка статуса ответа
      if (response.status !== 200) {
        this.logger.error(`NirvanaPay API returned status: ${response.status}`);
        return {
          success: false,
          reason: `API returned status ${response.status}`
        };
      }

      // Проверка статуса операции в ответе API v2
      if (response.data && !response.data.data) {
        this.logger.error(`NirvanaPay API returned error - ${JSON.stringify(response.data)}`);
        return {
          success: false,
          reason: response.data?.message || response.data?.error || 'API не вернул данные для оплаты'
        };
      }

      // Обработка успешного ответа API v2
      if (response.data && response.data.data && response.data.data.redirectURL && response.data.data.redirectURL.trim() !== '') {
        const redirectURL = response.data.data.redirectURL;
        
        this.logger.log(`Order created successfully with redirectURL: ${redirectURL}`);
        
        return {
          success: true,
          data: {
            redirectURL: redirectURL
          }
        };
      }
      
      // Если redirectURL пустой
      if (response.data && response.data.data && (!response.data.data.redirectURL || response.data.data.redirectURL.trim() === '')) {
        this.logger.error('API вернул пустой redirectURL');
        return {
          success: false,
          reason: 'API не вернул URL для оплаты. Возможно, недостаточно средств или проблемы с конфигурацией.'
        };
      }

      // Обработка ошибки от API
      this.logger.error(`NirvanaPay API unexpected response: ${JSON.stringify(response.data)}`);
      return {
        success: false,
        reason: response.data?.reason || 'Неожиданный ответ от NirvanaPay API'
      };

    } catch (error) {
      this.logger.error(`NirvanaPay payin error: ${error.message}`, error.stack);
      
      if (error.response?.data) {
        const errorData = error.response.data;
        this.logger.error(`NirvanaPay API error data: ${JSON.stringify(errorData)}`);
        return {
          success: false,
          reason: errorData.reason || errorData.message || 'Ошибка API NirvanaPay'
        };
      }

      if ((error as any).code === 'ECONNREFUSED' || (error as any).code === 'ETIMEDOUT') {
        this.logger.error(`Connection error to NirvanaPay API: ${(error as any).code}`);
        return {
          success: false,
          reason: 'Ошибка соединения с NirvanaPay API'
        };
      }

      this.logger.error(`Unexpected error: ${ (error as any).message }`);
      return {
        success: false,
        reason: 'Неожиданная ошибка при обращении к NirvanaPay API'
      };
    }
  }

  /**
   * Получение статуса ордера через API v2
   */
  async getPayinStatus(externalID: string, currency: 'KZT' | 'TRY' | 'UZS'): Promise<PayinStatus | null> {
    try {
      this.logger.log(`Getting order status for externalID: ${externalID}, currency: ${currency}`);
      
      const response: AxiosResponse = await axios.get(
        `${this.apiUrl}/api/v2/order?externalId=${externalID}`,
        {
          headers: this.getHeaders(currency),
          timeout: 30000
        }
      );
      
      this.logger.log(`Order status response: ${JSON.stringify(response.data)}`);

      if (response.status === 200 && response.data && response.data.data) {
        return response.data;
      }

      return null;
    } catch (error) {
      this.logger.error(`Error getting order status: ${error.message}`);
      return null;
    }
  }

  /**
   * Получение баланса аккаунта
   */
  async getBalance(currency: 'KZT' | 'TRY' | 'UZS' = 'KZT'): Promise<{ available: any; frozen: any } | null> {
    try {
      const response: AxiosResponse = await axios.get(
        `${this.apiUrl}/balance`,
        {
          headers: this.getHeaders(currency),
          timeout: 15000
        }
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Error getting balance: ${error.message}`);
      return null;
    }
  }

  /**
   * Получение лимитов банков для указанной валюты
   */
  getBankLimits(currency: 'KZT' | 'TRY' | 'UZS' = 'KZT') {
    const currencyBanks = this.bankConfig[currency];
    if (!currencyBanks) {
      return [];
    }
    
    return Object.entries(currencyBanks).map(([bankName, config]) => ({
      bankName,
      token: config.token,
      minAmount: config.minAmount,
      maxAmount: config.maxAmount,
      commission: config.commission,
      description: config.description,
      currency
    }));
  }

  /**
   * Валидация запроса на пополнение
   */
  validatePayinRequest(request: PayinRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!request.externalID) {
      errors.push('externalID обязателен');
    }

    // Проверка минимальной суммы в зависимости от валюты
    if (!request.amount) {
      errors.push('Сумма пополнения обязательна');
    } else {
      const currencyBanks = this.bankConfig[request.currency];
      if (currencyBanks) {
        // Получаем минимальную сумму из первого доступного банка для валюты
        const firstBank = Object.values(currencyBanks)[0];
        const minAmount = firstBank.minAmount;
        
        if (request.amount < minAmount) {
          errors.push(`Минимальная сумма пополнения ${minAmount} ${request.currency}`);
        }
      }
    }

    if (!['KZT', 'TRY', 'UZS'].includes(request.currency)) {
      errors.push('Поддерживаются только валюты: KZT, TRY, UZS');
    }

    if (!request.callbackURL) {
      errors.push('callbackURL обязателен');
    }

    if (!request.redirectURL) {
      errors.push('redirectURL обязателен');
    }

    if (!request.siteName) {
      errors.push('siteName обязателен');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Проверка всех pending депозитов
   * Вызывается при получении callback от NirvanaPay
   */
  async checkPendingDeposits(): Promise<void> {
    this.logger.log('Checking pending NirvanaPay deposits...');
    
    try {
      // Получаем все pending депозиты для NirvanaPay
      const pendingDeposits = await this.prismaService.deposit.findMany({
        where: {
          status: DepositStatus.PENDING,
          paymentSystem: 'NirvanaPay',
        },
        include: {
          user: true,
          currency: true,
        },
      });

      this.logger.log(`Found ${pendingDeposits.length} pending NirvanaPay deposits`);

      // Проверяем статус каждого депозита
      for (const deposit of pendingDeposits) {
        try {
          this.logger.log(`Checking status for deposit ${deposit.id}, externalId: ${deposit.externalId}`);
          
          const statusResponse = await this.getPayinStatus(deposit.externalId, deposit.currency.isoCode as 'KZT' | 'TRY' | 'UZS');
          
          if (!statusResponse) {
            this.logger.warn(`No status response for deposit ${deposit.id}`);
            continue;
          }

          const { status, amount } = statusResponse.data;
          
          // Обновляем статус депозита в зависимости от ответа API
          let newStatus: DepositStatus;
          
          switch (status) {
            case 'SUCCESS':
              newStatus = DepositStatus.SUCCESS;
              break;
            case 'ERROR':
              newStatus = DepositStatus.FAILED;
              break;
            case 'ACCEPTED':
              newStatus = DepositStatus.PROCESSING;
              break;
            default:
              this.logger.warn(`Unknown status ${status} for deposit ${deposit.id}`);
              continue;
          }

          // Обновляем депозит в базе данных
          await this.prismaService.deposit.update({
            where: { id: deposit.id },
            data: {
              status: newStatus,
              callbackData: statusResponse.data,
              updatedAt: new Date(),
            },
          });

          this.logger.log(`Updated deposit ${deposit.id} status to ${newStatus}`);

          // Если депозит успешен, создаем операцию пополнения
          if (newStatus === DepositStatus.SUCCESS) {
            // TODO: Здесь нужно создать операцию пополнения баланса пользователя
            // Это должно быть реализовано через DepositService или OperationService
            this.logger.log(`Deposit ${deposit.id} completed successfully, amount: ${amount}`);
          }

        } catch (error) {
          this.logger.error(`Error checking deposit ${deposit.id}: ${error.message}`);
          // Продолжаем проверку других депозитов даже если один не удался
        }
      }
      
      this.logger.log('Pending deposits check completed');
    } catch (error) {
      this.logger.error(`Error checking pending deposits: ${error.message}`);
      throw error;
    }
  }
}