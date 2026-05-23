import { Controller, Get, Post, Body, Param, Delete, Logger, Query } from '@nestjs/common';
import { BetApiWebSocketAdapter } from './betapi-websocket-adapter';
import { BetApiChangeDetector } from './betapi-change-detector';
import { GameBetApiType } from '@prisma/client';

@Controller('betapi/ws')
export class BetApiWebSocketController {
  private readonly logger = new Logger(BetApiWebSocketController.name);

  constructor(
    private readonly wsAdapter: BetApiWebSocketAdapter,
    private readonly changeDetector: BetApiChangeDetector
  ) {}

  private convertStringToGameBetApiType(type?: string): GameBetApiType | undefined {
    if (type === 'live') return GameBetApiType.LIVE;
    if (type === 'line') return GameBetApiType.LINE;
    return undefined;
  }

  @Get('status')
  getStatus(@Query('dataType') dataType?: string) {
    const wsStatus = this.wsAdapter.getStatus();
    const perfStats = this.changeDetector.getPerformanceStats(
      this.convertStringToGameBetApiType(dataType)
    );
    
    return {
      websocket: {
        connected: wsStatus.connected,
        bufferSize: wsStatus.bufferSize,
        queueSize: wsStatus.queueSize,
        reconnectAttempts: wsStatus.reconnectAttempts,
        dataType: dataType || 'all'
      },
      changeDetector: {
        currentInterval: perfStats.currentInterval,
        priorityEventsCount: perfStats.priorityEventsCount,
        errorCount: perfStats.errorCount,
        averageUpdateTime: perfStats.averageUpdateTime,
        dataType: dataType || 'all'
      }
    };
  }

  @Post('priority/:eventId')
  setPriority(
    @Param('eventId') eventId: string,
    @Body('priority') isPriority: boolean,
    @Body('dataType') dataType: string = 'live'
  ) {
    const betApiType = this.convertStringToGameBetApiType(dataType) || GameBetApiType.LIVE;
    this.logger.debug(`Setting priority for ${dataType} event ${eventId}: ${isPriority}`);
    this.changeDetector.setPriority(eventId, isPriority, betApiType);
    return { success: true };
  }

  @Get('events')
  getBufferedEvents(@Query('dataType') dataType?: string) {
    return {
      events: this.wsAdapter.getBufferedEvents(dataType as 'live' | 'line'),
      dataType: dataType || 'all'
    };
  }

  @Post('connect')
  connect() {
    this.wsAdapter.connect();
    return { message: 'WebSocket adapter connected' };
  }

  @Post('disconnect')
  disconnect() {
    this.wsAdapter.disconnect();
    return { message: 'WebSocket adapter disconnected' };
  }

  @Delete('buffer')
  clearBuffer(@Query('dataType') dataType?: string) {
    this.wsAdapter.clearBuffer(dataType as 'live' | 'line');
    return { 
      message: `Event buffer cleared${dataType ? ` for ${dataType} events` : ''}` 
    };
  }

  @Delete('events/:eventId')
  clearEventData(
    @Param('eventId') eventId: string,
    @Query('dataType') dataType: string = 'live'
  ) {
    const betApiType = this.convertStringToGameBetApiType(dataType) || GameBetApiType.LIVE;
    this.changeDetector.clearEventData(eventId, betApiType);
    return { 
      message: `${dataType.toUpperCase()} event data cleared for ${eventId}` 
    };
  }

  @Post('reset')
  reset(@Query('dataType') dataType?: string) {
    const betApiType = this.convertStringToGameBetApiType(dataType);
    this.wsAdapter.clearBuffer(dataType as 'live' | 'line');
    this.changeDetector.reset(betApiType);
    return { 
      success: true,
      dataType: dataType || 'all'
    };
  }
} 