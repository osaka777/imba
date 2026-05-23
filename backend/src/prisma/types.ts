import { Prisma, GameStatus } from '@prisma/client';

// Определяем дополнительные поля для GameCreateInput
export interface ExtendedGameCreateInput {
  eventId: string;
  eventName: string;
  leagueName: string;
  sport: string;
  team1: string;
  team2: string;
  score: string;
  status: GameStatus;
  meta?: Record<string, any>;
  priority?: number;
  subcategory?: {
    connect: {
      id: number;
    };
  };
  sportCategory: {
    connect: {
      id: number;
    };
  };
  markets?: any[];
}

// Тип для транзакционного клиента Prisma
export type PrismaTransactionClient = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

// Экспортируем типы
export type GameCreateInput = ExtendedGameCreateInput;
export type GameWhereInput = Prisma.GameWhereInput;
export type GameUpdateInput = Prisma.GameUpdateInput; 