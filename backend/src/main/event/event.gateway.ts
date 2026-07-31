import { Inject, OnModuleDestroy } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, WebSocketGateway } from '@nestjs/websockets';
import { IncomingMessage } from 'http';
import { v4 as uuid4 } from 'uuid';
import { Logger } from 'winston';
import { Data, WebSocket } from 'ws';
import { GameService } from '../game/game.service';
import { isAiBotUserAgent } from '../../common/security/ai-bot-detection.util';

@WebSocketGateway({
  path: '/api/events',
  transports: ['websocket'],
  cors: {
    origin: [
      'http://localhost:9000',
      'http://localhost:8000',
      'http://localhost:3000',
      'https://imba.bet',
      'https://partners.imba.bet',
      'https://imba.partners',
      'http://localhost',
    ],
    credentials: true
  }
})
export class EventGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, OnModuleDestroy {
  private readonly connectedClients: Map<
    string,
    {
      filter?: {
        eventIds?: string[];
        subscriptionType?: 'group' | 'detailed'; // Тип подписки: групповые данные или детальные
        // sport?: string[];
      };
      userId?: string; // Добавляем поддержку пользовательских уведомлений
      socket: WebSocket;
      lastActivity: number; // Время последней активности
      lastPing?: number; // Время последнего ping
    }
  > = new Map();

  private readonly CLIENT_TIMEOUT = 60000; // 60 секунд таймаут для клиентов
  private readonly CLEANUP_INTERVAL = 30000; // Проверка каждые 30 секунд
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    @Inject('winston') private readonly logger: Logger,
    private readonly gameService: GameService
  ) {}

  afterInit(server: any) {
    this.logger.info('WebSocket Gateway initialized', {
      path: '/api/events',
      server: server ? 'Available' : 'Not Available',
      timestamp: new Date().toISOString()
    });
    
    // Добавляем обработчик ошибок сервера
    if (server) {
      server.on('error', (error: Error) => {
        this.logger.error('WebSocket server error:', {
          error: error.message,
          stack: error.stack
        });
      });
    }

    // Запускаем периодическую очистку неактивных соединений
    this.startCleanupTimer();
  }

  /**
   * Запускает таймер для периодической очистки неактивных соединений
   */
  private startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this.cleanupInactiveClients();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Очищает неактивные соединения
   */
  private cleanupInactiveClients() {
    const now = Date.now();
    const clientsToRemove: string[] = [];

    this.connectedClients.forEach((client, clientId) => {
      const timeSinceLastActivity = now - client.lastActivity;
      
      if (timeSinceLastActivity > this.CLIENT_TIMEOUT) {
        this.logger.warn('Removing inactive client', {
          clientId,
          timeSinceLastActivity,
          lastActivity: new Date(client.lastActivity).toISOString()
        });
        
        // Закрываем соединение
        if (client.socket.readyState === WebSocket.OPEN) {
          client.socket.close(1000, 'Inactive connection timeout');
        }
        
        clientsToRemove.push(clientId);
      }
    });

    // Удаляем неактивных клиентов
    clientsToRemove.forEach(clientId => {
      this.connectedClients.delete(clientId);
    });

    if (clientsToRemove.length > 0) {
      this.logger.info('Cleaned up inactive clients', {
        removedCount: clientsToRemove.length,
        remainingClients: this.connectedClients.size
      });
    }
  }

  /**
   * Handles incoming messages from the WebSocket connection.
   * @param clientId - The client ID associated with the message.
   * @param data - The data received from the WebSocket connection.
   */
  private async onMessage(clientId: string, data: Data) {
    try {
      const message = JSON.parse(data.toString());
      this.logger.debug('Received message', { clientId, messageType: message.type });

      // Update client activity for any message
      const client = this.connectedClients.get(clientId);
      if (client) {
        client.lastActivity = Date.now();
      }

      switch (message.type) {
        case 'ping':
          // Handle ping message and respond with pong
          const pingClient = this.connectedClients.get(clientId);
          if (pingClient) {
            // Update activity timestamps
            pingClient.lastActivity = Date.now();
            pingClient.lastPing = Date.now();
            
            this.send(pingClient.socket, { 
              type: 'pong', 
              timestamp: Date.now(),
              originalTimestamp: message.timestamp 
            });
            this.logger.debug('Ping received, pong sent', { clientId });
          }
          break;

        case 'subscribe':
          const client = this.connectedClients.get(clientId);
          if (!client) {
            this.logger.error('Client not found', { clientId });
            return;
          }

          if (client.filter) {
            if (message.filter?.eventIds) {
              if (client.filter.eventIds) {
                message.filter.eventIds.forEach((eventId: string) => {
                  if (!client.filter.eventIds.includes(eventId)) {
                    client.filter.eventIds.push(eventId);
                  }
                });
              } else {
                client.filter.eventIds = [...message.filter.eventIds];
              }
            }
            // Обновляем тип подписки если указан
            if (message.filter?.subscriptionType) {
              client.filter.subscriptionType = message.filter.subscriptionType;
            }
          } else {
            client.filter = {
              eventIds: message.filter?.eventIds ? [...message.filter.eventIds] : [],
              subscriptionType: message.filter?.subscriptionType || 'detailed', // По умолчанию детальные данные
            };
          }

          this.send(client.socket, { status: 'success', type: 'subscribed' });
          break;

        case 'subscribe_user':
          const userClient = this.connectedClients.get(clientId);
          if (!userClient) {
            this.logger.error('Client not found for user subscription', { clientId });
            return;
          }

          if (message.userId) {
            userClient.userId = message.userId;
            this.logger.debug('Client subscribed to user notifications', { 
              clientId, 
              userId: message.userId 
            });
            this.send(userClient.socket, { status: 'success', type: 'subscribed' });
          } else {
            this.send(userClient.socket, { 
              status: 'error', 
              type: 'error',
              message: 'userId is required for user subscription' 
            });
          }
          break;

        case 'unsubscribe':
          const unsubClient = this.connectedClients.get(clientId);
          if (!unsubClient) {
            this.logger.error('Client not found for unsubscribe', { clientId });
            return;
          }

          if (unsubClient.filter?.eventIds && message.filter?.eventIds) {
            // Remove specified eventIds from the subscription
            unsubClient.filter.eventIds = unsubClient.filter.eventIds.filter(
              eventId => !message.filter.eventIds.includes(eventId)
            );
            this.logger.debug('Unsubscribed from events', {
              clientId,
              unsubscribedEvents: message.filter.eventIds,
              remainingSubscriptions: unsubClient.filter.eventIds
            });
          } else if (!message.filter?.eventIds) {
            // If no specific eventIds provided, clear all subscriptions
            unsubClient.filter = { eventIds: [] };
            this.logger.debug('Cleared all subscriptions', { clientId });
          }

          this.send(unsubClient.socket, { 
            status: 'success', 
            type: 'unsubscribed',
            unsubscribedEvents: message.filter?.eventIds || 'all'
          });
          break;

        case 'get_games_list':
          await this.handleGamesListRequest(clientId, message);
          break;

        default:
          this.logger.warn('Unknown message type', { 
            type: message.type,
            clientId,
            messageData: message 
          });
          // Send error response to client
          const errorClient = this.connectedClients.get(clientId);
          if (errorClient) {
            this.send(errorClient.socket, {
              status: 'error',
              type: 'error',
              message: `Unsupported message type: ${message.type}`,
              originalMessage: message
            });
          }
          break;
      }
    } catch (error) {
      this.logger.error('Error processing message', { 
        error, 
        clientId,
        rawData: data.toString() 
      });
      // Send error response to client
      const errorClient = this.connectedClients.get(clientId);
      if (errorClient) {
        this.send(errorClient.socket, {
          status: 'error',
          type: 'error',
          message: 'Failed to process message',
          error: error.message
        });
      }
    }
  }

  /**
   * Handles games list request from WebSocket client.
   * @param clientId - The client ID requesting the games list.
   * @param message - The message containing request parameters.
   */
  private async handleGamesListRequest(clientId: string, message: any) {
    const client = this.connectedClients.get(clientId);
    if (!client) {
      this.logger.error('Client not found for games list request', { clientId });
      return;
    }

    try {
      const { requestId, filter } = message;
      const { sport, limit = 20, offset = 0, status = ['IN_PROGRESS', 'STARTING'] } = filter || {};

      this.logger.debug('Processing games list request', {
        clientId,
        requestId,
        sport,
        limit,
        offset,
        status
      });

      // Получаем игры через GameService
      const games = await this.gameService.getAvailableGames(
        sport,
        limit,
        offset
      );

      // Фильтруем по статусу если указан
      const filteredGames = games.filter(game => 
        !status || status.length === 0 || status.includes(game.status)
      );

      // Проверяем, есть ли еще игры для загрузки
      const hasMore = games.length === limit;

      // Форматируем игры для отправки
      const formattedGames = filteredGames.map(({ markets, subcategory, ...game }) => ({
        ...game,
        subcategory,
        odds: game.meta?.odds || {},
        startTime: game.meta?.startTime || game.meta?.game_start,
        timer: game.meta?.timer || 0,
        groupedMarkets: game.meta?.groupedMarkets || this.gameService.groupMarkets(Object.values(markets || {})),
      }));

      // Отправляем ответ клиенту
      this.send(client.socket, {
        type: 'games_list_response',
        requestId,
        payload: {
          games: formattedGames,
          hasMore,
          total: formattedGames.length,
          offset,
          limit
        }
      });

      this.logger.debug('Sent games list response', {
        clientId,
        requestId,
        gamesCount: formattedGames.length,
        hasMore
      });

    } catch (error) {
      this.logger.error('Error processing games list request', {
        clientId,
        requestId: message.requestId,
        error: error.message,
        stack: error.stack
      });

      // Отправляем ошибку клиенту
      this.send(client.socket, {
        type: 'games_list_error',
        requestId: message.requestId,
        payload: {
          error: 'Failed to fetch games list',
          details: error.message
        }
      });
    }
  }

  /**
   * Sends data to a specific WebSocket client.
   * @param socket - The WebSocket client to send the data.
   * @param data - The data object to send.
   */
  private send(socket: WebSocket, data: object) {
    if (socket.readyState === WebSocket.OPEN) {
      try {
        const message = JSON.stringify(data);
        socket.send(message);
        return true;
      } catch (error) {
        this.logger.error('Error sending message', { error });
        return false;
      }
    }
    return false;
  }

  /**
   * Handles the WebSocket connection.
   * @param {WebSocket} socket - The WebSocket object.
   * @param {IncomingMessage} request - The incoming request object.
   */
  async handleConnection(socket: WebSocket, request: IncomingMessage) {
    // Refuse AI agents/crawlers from inspecting the events sync protocol.
    if (isAiBotUserAgent(request.headers['user-agent'])) {
      socket.close(4403, 'AI_ACCESS_DENIED');
      return;
    }

    const defaultLogMeta = {
      class: 'EventGateway',
      method: 'handleConnection',
      user_agent: request.headers['user-agent'],
      origin: request.headers.origin,
      ip: request.socket.remoteAddress,
      protocol: request.headers['sec-websocket-protocol'],
      version: request.headers['sec-websocket-version']
    };
    
    this.logger.info('New connection', defaultLogMeta);

    // Generate unique client ID and add to connected clients
    const clientId = uuid4();
    this.connectedClients.set(clientId, { 
      socket,
      lastActivity: Date.now()
    });

    this.logger.debug('Client connected', {
      ...defaultLogMeta,
      client_id: clientId,
    });

    // Добавляем обработчик ошибок для сокета
    socket.on('error', (error) => {
      this.logger.error('Socket error', {
        ...defaultLogMeta,
        client_id: clientId,
        error: error.message,
        stack: error.stack
      });
    });

    // Send connection success message
    this.send(socket, { 
      type: 'connection', 
      status: 'success',
      clientId 
    });

    socket.on('message', async (data: Data) => {
      this.logger.debug('Received message', {
        ...defaultLogMeta,
        client_id: clientId,
      });

      await this.onMessage(clientId, data);
    });

    socket.on('error', (error) => {
      this.logger.error('WebSocket error', {
        ...defaultLogMeta,
        client_id: clientId,
        error: error.message,
        stack: error.stack
      });
    });

    socket.on('close', (code: number, reason: string) => {
      this.logger.info('Client connection closing', {
        ...defaultLogMeta,
        client_id: clientId,
        code,
        reason: reason || 'No reason provided'
      });
    });
  }

  handleDisconnect(socket: WebSocket) {
    // Find and remove the disconnected client
    for (const [clientId, client] of this.connectedClients.entries()) {
      if (client.socket === socket) {
        this.connectedClients.delete(clientId);
        this.logger.info('Client disconnected', { 
          clientId,
          remaining_clients: this.connectedClients.size
        });
        break;
      }
    }
  }

  /**
   * Останавливает все таймеры и очищает ресурсы
   */
  onModuleDestroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    
    // Закрываем все активные соединения
    this.connectedClients.forEach((client, clientId) => {
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.close(1000, 'Server shutdown');
      }
    });
    
    this.connectedClients.clear();
    this.logger.info('WebSocket Gateway destroyed');
  }

  /**
   * Sends game data to all connected WebSocket clients.
   * @param data - The game data to send.
   */
  sendUpdate(message: { eventId: string; payload: unknown; type: string; subscriptionType?: 'group' | 'detailed' }) {
    let sentCount = 0;
    let failedCount = 0;
    let totalClients = 0;

    this.logger.debug('Broadcasting update to clients:', {
      eventId: message.eventId,
      type: message.type,
      totalClients: this.connectedClients.size
    });

    this.connectedClients.forEach(({ filter, socket }, clientId) => {
      totalClients++;
      
      if (filter?.eventIds == null) {
        this.logger.debug('Client has no filter', { clientId });
        return;
      }
      
      if (!filter.eventIds.includes(message.eventId)) {
        this.logger.debug('Client not subscribed to this event', { 
          clientId, 
          subscribedEvents: filter.eventIds,
          targetEvent: message.eventId 
        });
        return;
      }

      // Проверяем соответствие типа подписки
      if (message.subscriptionType && filter.subscriptionType && 
          message.subscriptionType !== filter.subscriptionType) {
        this.logger.debug('Client subscription type mismatch', {
          clientId,
          clientType: filter.subscriptionType,
          messageType: message.subscriptionType
        });
        return;
      }

      this.logger.debug('Sending message to client', { 
        clientId, 
        eventId: message.eventId,
        type: message.type 
      });

      if (this.send(socket, message)) {
        sentCount++;
      } else {
        failedCount++;
      }
    });

    this.logger.debug('Broadcast completed:', {
      eventId: message.eventId,
      type: message.type,
      totalClients,
      sent: sentCount,
      failed: failedCount
    });

    if (failedCount > 0) {
      this.logger.warn('Some messages failed to send', {
        eventId: message.eventId,
        sent: sentCount,
        failed: failedCount
      });
    }
  }

  /**
   * Отправляет групповые данные для главной страницы
   */
  sendGroupUpdate(message: { eventId: string; payload: unknown; type: string }) {
    this.sendUpdate({ ...message, subscriptionType: 'group' });
  }

  /**
   * Отправляет детальные данные для конкретной игры
   */
  sendDetailedUpdate(message: { eventId: string; payload: unknown; type: string }) {
    this.sendUpdate({ ...message, subscriptionType: 'detailed' });
  }

  /**
   * Отправляет уведомление конкретному пользователю
   */
  sendUserNotification(userId: string, notification: { type: string; payload: unknown }) {
    let sentCount = 0;
    let failedCount = 0;
    let totalClients = 0;

    this.connectedClients.forEach(({ userId: clientUserId, socket }, clientId) => {
      totalClients++;
      
      if (clientUserId !== userId) {
        this.logger.debug('Client not subscribed to this user', { 
          clientId, 
          clientUserId,
          targetUserId: userId 
        });
        return;
      }

      if (this.send(socket, notification)) {
        sentCount++;
      } else {
        failedCount++;
      }
    });

    this.logger.debug('User notification completed:', {
      userId,
      type: notification.type,
      totalClients,
      sent: sentCount,
      failed: failedCount
    });

    if (failedCount > 0) {
      this.logger.warn('Some user notifications failed to send', {
        userId,
        type: notification.type,
        sent: sentCount,
        failed: failedCount
      });
    }

    return sentCount > 0;
  }
}
