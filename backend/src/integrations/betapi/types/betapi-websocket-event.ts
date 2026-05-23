import { GameBetApiType } from '@prisma/client';

export interface BetApiWebSocketEvent {
  id: string;
  eventId: string;
  type: string;
  data: any;
  timestamp: number;
  priority?: number;
  dataType: GameBetApiType;
  subscriptionType?: 'group' | 'detail';
}

export interface BetApiWebSocketStatus {
  connected: boolean;
  bufferSize: number;
  queueSize: number;
  lastEventTime?: number;
  reconnectAttempts?: number;
  dataType: GameBetApiType;
  currentInterval?: number;
  priorityEventsCount?: number;
  errorCount?: number;
  averageUpdateTime?: number;
  processingTimes?: {
    average: number;
    max: number;
  };
}

export interface BetApiEventResponse {
  id: string;
  type: string;
  data: any;
  status: 'success' | 'error';
  timestamp: number;
  processingTime: number;
  dataType: GameBetApiType;
}

export interface BetApiPerformanceStats {
  priorityEventsCount: number;
  currentInterval: number;
  errorCount: number;
  averageUpdateTime: number;
  bufferSize: number;
  processingTimes: {
    average: number;
    max: number;
  };
  dataType: GameBetApiType;
}