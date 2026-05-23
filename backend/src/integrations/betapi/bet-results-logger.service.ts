import { Injectable, Inject } from '@nestjs/common';
import { Logger } from 'winston';

@Injectable()
export class BetResultsLoggerService {
  constructor(
    @Inject('winston') private readonly logger: Logger,
  ) {}

  logBetResultRequest(payload: any, ip?: string, userAgent?: string) {
    const logData = {
      timestamp: new Date().toISOString(),
      type: 'REQUEST',
      endpoint: '/api/bet/result',
      payload: JSON.stringify(payload),
      ip: ip || 'unknown',
      userAgent: userAgent || 'unknown',
    };

    this.logger.info(JSON.stringify(logData), { context: 'BET_RESULT' });
  }

  logBetResultResponse(success: boolean, message: string, error?: any) {
    const logData = {
      timestamp: new Date().toISOString(),
      type: 'RESPONSE',
      endpoint: '/api/bet/result',
      success,
      message,
      error: error ? error.message || error : null,
    };

    this.logger.info(JSON.stringify(logData), { context: 'BET_RESULT' });
  }

  logBetResultProcessing(betCode: string, action: string, details?: any) {
    const logData = {
      timestamp: new Date().toISOString(),
      type: 'PROCESSING',
      endpoint: '/api/bet/result',
      betCode,
      action,
      details: details ? JSON.stringify(details) : null,
    };

    this.logger.info(JSON.stringify(logData), { context: 'BET_RESULT' });
  }

  logBetResultError(error: any, context?: string) {
    const logData = {
      timestamp: new Date().toISOString(),
      type: 'ERROR',
      endpoint: '/api/bet/result',
      error: error.message || error,
      stack: error.stack || null,
      context: context || 'unknown',
    };

    this.logger.error(JSON.stringify(logData), { context: 'BET_RESULT' });
  }
}