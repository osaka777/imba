import { Test, TestingModule } from '@nestjs/testing';
import { BetCalculationService } from './bet-calculation.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BetStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { OperationService } from '../../main/operation/operation.service';
import { EventGateway } from '../../main/event/event.gateway';
import { BetApiService } from './betapi.service';

describe('BetCalculationService', () => {
  let service: BetCalculationService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    $transaction: jest.fn(),
    bet: {
      create: jest.fn(),
    },
    expressBet: {
      create: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockOperationService = {
    createOperation: jest.fn(),
  };

  const mockEventGateway = {
    sendToUser: jest.fn(),
  };

  const mockBetApiService = {
    createBet: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BetCalculationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: OperationService,
          useValue: mockOperationService,
        },
        {
          provide: EventGateway,
          useValue: mockEventGateway,
        },
        {
          provide: BetApiService,
          useValue: mockBetApiService,
        },
      ],
    }).compile();

    service = module.get<BetCalculationService>(BetCalculationService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('saveBetToDatabase', () => {
    it('should create ExpressBet and linked Bet for EXPRESS variant', async () => {
      const mockExpressBet = {
        id: 1,
        userId: 1,
        amount: 100,
        cf: 1.5,
        currencyCode: 'USD',
        betCode: 'TEST123',
        betApiStatus: 1,
        betApiResponse: {},
        status: BetStatus.PENDING,
      };

      const mockBet = {
        id: 1,
        userId: 1,
        gameId: 'game123',
        betType: 'SINGLE',
        betVariant: 'EXPRESS',
        amount: 100,
        cf: 1.5,
        currencyCode: 'USD',
        betCode: 'TEST123',
        betApiStatus: 1,
        betApiResponse: {},
        status: BetStatus.PENDING,
        lifecycleState: BetStatus.PENDING,
        expressBetId: 1,
      };

      // Mock transaction
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockPrisma = {
          expressBet: {
            create: jest.fn().mockResolvedValue(mockExpressBet),
          },
          bet: {
            create: jest.fn().mockResolvedValue(mockBet),
          },
        };
        return callback(mockPrisma);
      });

      const betData = {
        userId: 1,
        gameId: 'game123',
        betType: 'SINGLE',
        betVariant: 'EXPRESS',
        amount: 100,
        cf: 1.5,
        currencyCode: 'USD',
        betCode: 'TEST123',
        betApiStatus: 1,
        betApiResponse: {},
      };

      // Call private method using bracket notation
      const result = await (service as any).saveBetToDatabase(betData);

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(result).toEqual(mockBet);
      expect(result.expressBetId).toBe(1);
    });

    it('should create only Bet for non-EXPRESS variant', async () => {
      const mockBet = {
        id: 1,
        userId: 1,
        gameId: 'game123',
        betType: 'SINGLE',
        betVariant: 'SINGLE',
        amount: 100,
        cf: 1.5,
        currencyCode: 'USD',
        betCode: 'TEST123',
        betApiStatus: 1,
        betApiResponse: {},
        status: BetStatus.PENDING,
        lifecycleState: BetStatus.PENDING,
      };

      mockPrismaService.bet.create.mockResolvedValue(mockBet);

      const betData = {
        userId: 1,
        gameId: 'game123',
        betType: 'SINGLE',
        betVariant: 'SINGLE',
        amount: 100,
        cf: 1.5,
        currencyCode: 'USD',
        betCode: 'TEST123',
        betApiStatus: 1,
        betApiResponse: {},
      };

      // Call private method using bracket notation
      const result = await (service as any).saveBetToDatabase(betData);

      expect(mockPrismaService.bet.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 1,
          gameId: 'game123',
          betVariant: 'SINGLE',
          amount: 100,
          status: BetStatus.PENDING,
          lifecycleState: BetStatus.PENDING,
        }),
      });
      expect(result).toEqual(mockBet);
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('Express Bet Logic Tests', () => {
    describe('calculateExpressBetOutcome', () => {
      it('should return PENDING when any bet is PENDING', () => {
        const betStatuses = [
          { outcome: 'WIN', status: 2, extStatus: 0 },
          { outcome: 'PENDING', status: 1, extStatus: 0 },
          { outcome: 'WIN', status: 2, extStatus: 0 },
        ];

        const result = (service as any).calculateExpressBetOutcome(betStatuses);

        expect(result).toEqual({
          finalStatus: 1,
          finalExtStatus: 0,
          shouldCalculatePayout: false,
        });
      });

      it('should return LOSE when any bet is LOSE', () => {
        const betStatuses = [
          { outcome: 'WIN', status: 2, extStatus: 0 },
          { outcome: 'LOSE', status: 4, extStatus: 0 },
          { outcome: 'WIN', status: 2, extStatus: 0 },
        ];

        const result = (service as any).calculateExpressBetOutcome(betStatuses);

        expect(result).toEqual({
          finalStatus: 4,
          finalExtStatus: 0,
          shouldCalculatePayout: false,
        });
      });

      it('should return WIN when all bets are WIN', () => {
        const betStatuses = [
          { outcome: 'WIN', status: 2, extStatus: 0 },
          { outcome: 'WIN', status: 2, extStatus: 0 },
          { outcome: 'WIN', status: 2, extStatus: 0 },
        ];

        const result = (service as any).calculateExpressBetOutcome(betStatuses);

        expect(result).toEqual({
          finalStatus: 2,
          finalExtStatus: 0,
          shouldCalculatePayout: true,
        });
      });

      it('should return RETURN when there are returns but no losses', () => {
        const betStatuses = [
          { outcome: 'WIN', status: 2, extStatus: 0 },
          { outcome: 'RETURN', status: 3, extStatus: 0 },
          { outcome: 'WIN', status: 2, extStatus: 0 },
        ];

        const result = (service as any).calculateExpressBetOutcome(betStatuses);

        expect(result).toEqual({
          finalStatus: 3,
          finalExtStatus: 0,
          shouldCalculatePayout: false,
        });
      });

      it('should NOT pay out when only one game wins in express bet', () => {
        const betStatuses = [
          { outcome: 'WIN', status: 2, extStatus: 0 },
          { outcome: 'PENDING', status: 1, extStatus: 0 },
          { outcome: 'PENDING', status: 1, extStatus: 0 },
        ];

        const result = (service as any).calculateExpressBetOutcome(betStatuses);

        expect(result.shouldCalculatePayout).toBe(false);
        expect(result.finalStatus).toBe(1); // PENDING
      });
    });

    describe('getOutcomeType', () => {
      it('should correctly map status codes to outcome types', () => {
        expect((service as any).getOutcomeType(1, 0)).toBe('PENDING');
        expect((service as any).getOutcomeType(2, 0)).toBe('WIN');
        expect((service as any).getOutcomeType(2, 1)).toBe('RETURN');
        expect((service as any).getOutcomeType(3, 0)).toBe('RETURN');
        expect((service as any).getOutcomeType(4, 0)).toBe('LOSE');
        expect((service as any).getOutcomeType(4, 1)).toBe('RETURN');
      });
    });
  });
});