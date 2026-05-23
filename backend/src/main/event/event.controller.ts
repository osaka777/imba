import { Controller, Get } from '@nestjs/common';
import { EventGateway } from './event.gateway';

@Controller('events')
export class EventController {
  constructor(private readonly eventGateway: EventGateway) {}

  @Get('status')
  getStatus() {
    return {
      status: 'WebSocket server is running',
      timestamp: new Date().toISOString(),
      path: '/api/events',
      transports: ['websocket']
    };
  }

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'event-service'
    };
  }
}









