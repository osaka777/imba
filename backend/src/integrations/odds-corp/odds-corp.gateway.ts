import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnGatewayInit, WebSocketGateway } from '@nestjs/websockets';
import { Logger } from 'winston';
import * as WebSocket from 'ws';

import { OddsCorpService } from './odds-corp.service';

@Injectable()
@WebSocketGateway()
export class OddsCorpGateway implements OnGatewayInit {
  constructor(
    private readonly oddsCorpService: OddsCorpService,
    private readonly configService: ConfigService,
    @Inject('winston')
    private readonly logger: Logger,
  ) {}

  /**
   * Establishes a WebSocket connection and handles the events.
   */
  private connectWebSocket(marketType: 'live' | 'prematch') {
    const defaultLogMeta = {
      class: 'OddsCorpGateway',
      method: 'connectWebSocket',
    };
    this.logger.info('connecting', defaultLogMeta);

    const ws = new WebSocket(this.configService.get<string>('ODDSCORP_WS_URL'));

    ws.on('open', () => {
      // Define the subscription message
      const message = {
        auth_key: this.configService.get<string>('ODDSCORP_AUTH_KEY'),
        cmd: 'subscribe',
        echo_remove_event_src: true,
        needed_bk: [`fonbet:${marketType}`],
        needed_sport: [
          'soccer',
          'tennis',
          'basketball',
          'volleyball',
          'table-tennis',
          'hockey',
          'esports.cs',
          'esports.dota2',
          'esports.lol',
        ],
        send_actual_first: true,
        short_format: true,
      };

      this.sendMessage(ws, message);

      this.logger.info(`[${marketType}] client connected and subscribed`, {
        ...defaultLogMeta,
        ...message,
      });
    });

    ws.on('close', (code, reason) => {
      this.logger.error(`[${marketType}] connection closed`, {
        ...defaultLogMeta,
        code,
        reason: reason.toString(),
      });
      this.logger.warn(
        `[${marketType}] reconnecting in 1 second`,
        defaultLogMeta,
      );

      // Reconnect after 1 second
      setTimeout(() => {
        this.logger.warn(`[${marketType}] reconnecting`, defaultLogMeta);
        this.connectWebSocket(marketType);
      }, 1000);
    });

    ws.on('message', this.onMessage.bind(this, marketType));

    ws.addEventListener('error', (event) => {
      this.logger.error(`[${marketType}] client received error`, {
        ...defaultLogMeta,
        error: event.error,
      });
    });
  }

  /**
   * Sends a message over the WebSocket connection.
   * @param message - The message object to send.
   */
  private sendMessage(ws: WebSocket, message: object) {
    const defaultLogMeta = {
      class: 'OddsCorpGateway',
      method: 'sendMessage',
      params: { message },
    };
    this.logger.debug('sending message', defaultLogMeta);

    const jsonMessage = JSON.stringify(message);
    const bufferMessage = Buffer.from(jsonMessage, 'utf-8');

    // Check if the connection is open and send the message
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(bufferMessage);
      this.logger.debug('message sent', defaultLogMeta);
    } else {
      this.logger.error('connection is not open', defaultLogMeta);
    }
  }

  afterInit() {
    const enabled = this.configService.get('ODDSCP_ENABLED');
    if (enabled === 'true' || enabled === true) {
      this.connectWebSocket('live');
      this.connectWebSocket('prematch');
    }
  }

  /**
   * Handles incoming messages from the WebSocket connection.
   * @param data - The data received from the WebSocket connection.
   */
  async onMessage(marketType: 'live' | 'prematch', data: WebSocket.Data) {
    const defaultLogMeta = {
      class: 'OddsCorpGateway',
      method: 'onMessage',
    };

    const stringData = data.toString();

    if (stringData === '"ERROR: Auth key invalid (not found or not active)"') {
      this.logger.error('connection error', {
        ...defaultLogMeta,
        error: stringData,
      });
      return;
    }

    if (stringData === '') {
      return;
    }

    try {
      const jsonData = JSON.parse(stringData);
      this.logger.debug('received message', {
        ...defaultLogMeta,
        message: stringData,
      });
      await this.oddsCorpService.handle(marketType, jsonData);
    } catch (error) {
      this.logger.error(`[${marketType}] Couldn't parse message`, {
        ...defaultLogMeta,
        error,
      });
    }
  }
}
