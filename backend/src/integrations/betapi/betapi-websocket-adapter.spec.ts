import { Test, TestingModule } from '@nestjs/testing';
import { BetApiWebSocketAdapter, WebSocketConfig } from './betapi-websocket-adapter';
import { GameBetApiType } from '@prisma/client';
import { BetApiWebSocketEvent } from './types/betapi-websocket-event';

describe('BetApiWebSocketAdapter', () => {
  let adapter: BetApiWebSocketAdapter;

  const mockConfig: WebSocketConfig = {
    bufferSize: 1000,
    bufferTTL: 5000,
    maxBatchSize: 50,
    batchInterval: 100,
    reconnectInterval: 1000,
    maxReconnectAttempts: 10
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: BetApiWebSocketAdapter,
          useFactory: () => new BetApiWebSocketAdapter(mockConfig)
        }
      ],
    }).compile();

    adapter = module.get<BetApiWebSocketAdapter>(BetApiWebSocketAdapter);
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  it('should connect and disconnect', () => {
    const connectSpy = jest.spyOn(adapter, 'emit');
    
    adapter.connect();
    expect(connectSpy).toHaveBeenCalledWith('open');
    
    adapter.disconnect();
    expect(connectSpy).toHaveBeenCalledWith('close');
  });

  it('should send events when connected', (done) => {
    adapter.connect();
    const testEvent: BetApiWebSocketEvent = {
      id: '123',
      eventId: '123',
      type: 'event_update',
      data: { test: 'data' },
      timestamp: Date.now(),
      dataType: GameBetApiType.LIVE
    };
    
    let messageReceived = false;
    
    // Слушаем событие message
    adapter.once('message', (data) => {
      messageReceived = true;
      expect(data).toBeDefined();
      expect(typeof data).toBe('string');
      done();
    });
    
    adapter.send(testEvent);
    
    // Если событие не произойдет в течение 200ms, тест провалится
    setTimeout(() => {
      if (!messageReceived) {
        done(new Error('Message event was not emitted'));
      }
    }, 200);
  });
});