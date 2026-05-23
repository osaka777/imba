import { Controller, Get, Param, Query, Post, Body, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';

import { SubcategoryService } from './subcategory.service';
import { PrismaService } from '~/prisma/prisma.service';
import { SuperuserGuard } from '~/main/user/authentication/superuser.guard';

@ApiTags('Subcategory')
@Controller('')
export class SubcategoryController {
  private readonly logger = new Logger(SubcategoryController.name);

  constructor(
    private readonly subcategoryService: SubcategoryService,
    private readonly prismaService: PrismaService,
  ) {}

  @Get('/subcategories')
  @UseGuards(SuperuserGuard)
  @ApiBearerAuth('Admin')
  async getAllSubcategories() {
    return this.subcategoryService.findAll(false); // false to get both active and inactive
  }

  @Post('/subcategories/priority')
  @UseGuards(SuperuserGuard)
  @ApiBearerAuth('Admin')
  async updatePriorities(
    @Body() updates: { id: number; isPriority: boolean }[]
  ) {
    try {
      await this.subcategoryService.updatePriorities(updates);
      return { success: true, message: 'Priorities updated successfully' };
    } catch (error) {
      this.logger.error('Error updating subcategory priorities:', error);
      throw new HttpException(
        error.message || 'Failed to update priorities',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('/subcategories/priority/:id')
  @UseGuards(SuperuserGuard)
  @ApiBearerAuth('Admin')
  async getPriority(@Param('id') id: string) {
    const subcategory = await this.prismaService.subcategory.findUnique({
      where: { id: parseInt(id) },
      select: { isPriority: true }
    });
    return subcategory;
  }

  @Get('/subcategories/:sport')
  async getSubcategoriesBySport(@Param('sport') sport: string) {
    const subcategories = await this.subcategoryService.findBySport(sport);
    return subcategories;
  }

  @Get('/subcategories-with-counts/:sport')
  async getSubcategoriesWithCounts(
    @Param('sport') sport: string,
    @Query('type') type: 'live' | 'prematch' = 'live'
  ) {
    try {
      
      // Получаем подкатегории
      const subcategories = await this.subcategoryService.findBySport(sport);
      
      // Получаем счётчики в зависимости от типа
      let counts: Record<string, Record<string, number>> = {};
      
      if (type === 'live') {
        counts = await this.getLiveSubcategoryCounts();
      } else {
        counts = await this.getPrematchSubcategoryCounts();
      }
      
      const sportCounts = counts[sport] || {};
      
      return {
        subcategories,
        counts: sportCounts,
        total: sportCounts.total || 0
      };
    } catch (error) {
      console.error(`[SubcategoryController] Error getting subcategories with counts for ${sport}:`, error);
      return {
        subcategories: [],
        counts: {},
        total: 0
      };
    }
  }

  @Post('/updateMissingSubcategories')
  @UseGuards(SuperuserGuard)
  @ApiBearerAuth('Admin')
  async updateMissingSubcategories(
    @Body() data: { sport?: string; limit?: number }
  ) {
    // console.log(`[SubcategoryController] Request to update missing subcategories: ${JSON.stringify(data)}`);
    return this.subcategoryService.updateMissingGameSubcategories(
      data.sport,
      data.limit || 100
    );
  }

  @Get('/subcategoryCounts')
  async getSubcategoryCounts() {
    try {
      // Get all subcategories for mapping ID to code
      const allSubcategories = await this.prismaService.subcategory.findMany();
      const subcategoryMap = new Map();
      allSubcategories.forEach(subcategory => {
        subcategoryMap.set(subcategory.id, subcategory.code);
      });

      // Запрашиваем игры с группировкой по статусу, спорту и подкатегории
      const countsByStatus = await this.prismaService.$queryRaw`
        SELECT status, sport, "subcategoryId", COUNT(*) as count
        FROM "Game"
        WHERE status IN ('IN_PROGRESS', 'STARTING', 'PREMATCH')
        GROUP BY status, sport, "subcategoryId"
        ORDER BY status, sport, COUNT(*) DESC
      `;

      // Форматируем результаты в структурированный объект
      const result: Record<string, Record<string, any>> = {};

      // Счетчики для общего количества игр
      let totalLiveGames = 0;
      let totalPrematchGames = 0;

      // Обрабатываем результаты с группировкой по спорту
      (countsByStatus as any[]).forEach((row) => {
        const { count, sport, status, subcategoryId } = row;

        // Игнорируем нулевые подкатегории
        if (!subcategoryId) return;

        // Get the subcategory code
        const subcategoryCode = subcategoryMap.get(subcategoryId) || `cat_${subcategoryId}`;

        // Инициализируем объект для спорта, если его еще нет
        if (!result[sport]) {
          result[sport] = {
            total: 0,
            total_live: 0,
            total_prematch: 0,
          };
        }

        // Преобразуем строку count в число
        const countValue = parseInt(count, 10);

        // Обрабатываем разные статусы игр
        if (status === 'IN_PROGRESS' || status === 'STARTING') {
          // Live игры
          result[sport].total_live += countValue;
          result[sport].total += countValue;
          totalLiveGames += countValue;

          // Добавляем количество для подкатегории с пометкой live
          result[sport][subcategoryCode] =
            (result[sport][subcategoryCode] || 0) + countValue;
        } else if (status === 'PREMATCH') {
          // Prematch игры
          result[sport].total_prematch += countValue;
          result[sport].total += countValue;
          totalPrematchGames += countValue;

          // Добавляем количество для подкатегории с пометкой prematch
          result[sport][`${subcategoryCode}_prematch`] =
            (result[sport][`${subcategoryCode}_prematch`] || 0) + countValue;
        }
        // Игнорируем другие статусы (FINISHED, CANCELED)
      });

      // Добавляем общие счетчики
      if (Object.keys(result).length > 0) {
        result['all'] = {
          total: totalLiveGames + totalPrematchGames,
          total_live: totalLiveGames,
          total_prematch: totalPrematchGames,
        };
      }

      // Удаляем пустые категории
      Object.keys(result).forEach((sport) => {
        if (sport !== 'all' && result[sport].total === 0) {
          delete result[sport];
        }
      });

      return result;
    } catch (error) {
      console.error('Error getting subcategory counts:', error);
      return {};
    }
  }

  @Get('/liveSubcategoryCounts')
  async getLiveSubcategoryCounts() {
    try {
      
      // Get all subcategories for mapping ID to code
      const allSubcategories = await this.prismaService.subcategory.findMany({
        select: { id: true, code: true, sport: true },
        where: { isActive: true }
      });
      
      const subcategoryMap = new Map(
        allSubcategories.map(sub => [sub.id, { code: sub.code, sport: sub.sport }])
      );

      // Сначала получаем общее количество live игр для каждого спорта
      const sportTotals = await this.prismaService.$queryRaw`
        SELECT sport, COUNT(*) as total
        FROM "Game"
        WHERE status IN ('IN_PROGRESS', 'STARTING')
        GROUP BY sport
      `;

      // Затем получаем количество игр по подкатегориям
      const subcategoryCounts = await this.prismaService.$queryRaw`
        SELECT 
          g.sport,
          g."subcategoryId",
          COUNT(*) as count
        FROM "Game" g
        WHERE g.status IN ('IN_PROGRESS', 'STARTING')
          AND g."subcategoryId" IS NOT NULL
        GROUP BY g.sport, g."subcategoryId"
      `;

      // Форматируем результаты
      const result: Record<string, Record<string, number>> = {};
      let totalLiveGames = 0;

      // Сначала добавляем общие количества по спортам
      (sportTotals as any[]).forEach(({ sport, total }) => {
        const totalCount = parseInt(total, 10);
        result[sport] = { total: totalCount };
        totalLiveGames += totalCount;
      });

      // Затем добавляем количества по подкатегориям
      (subcategoryCounts as any[]).forEach(({ sport, subcategoryId, count }) => {
        if (!subcategoryId) return;

        const subcategoryInfo = subcategoryMap.get(subcategoryId);
        if (!subcategoryInfo) return;

        const countValue = parseInt(count, 10);
        if (!result[sport]) {
          result[sport] = { total: countValue };
        }

        result[sport][subcategoryInfo.code] = countValue;
      });

      // Добавляем общий счетчик
      if (totalLiveGames > 0) {
        result['all'] = { total: totalLiveGames };
      }

      // Очищаем пустые категории
      Object.keys(result).forEach(sport => {
        if (sport !== 'all' && (!result[sport] || result[sport].total === 0)) {
          delete result[sport];
        }
      });

      this.logger.debug('Live subcategory counts result:', result);
      return result;
    } catch (error) {
      this.logger.error('Error getting live subcategory counts:', error);
      return {};
    }
  }

  @Get('/prematchSubcategoryCounts')
  async getPrematchSubcategoryCounts() {
    try {
      
      // Get all subcategories for mapping ID to code
      const allSubcategories = await this.prismaService.subcategory.findMany();
      const subcategoryMap = new Map();
      allSubcategories.forEach(subcategory => {
        subcategoryMap.set(subcategory.id, subcategory.code);
      });
      
      // Запрашиваем только prematch игры с группировкой по спорту и подкатегории
      const prematchCounts = await this.prismaService.$queryRaw`
        SELECT sport, "subcategoryId", COUNT(*) as count
        FROM "Game"
        WHERE status = 'PREMATCH'
        GROUP BY sport, "subcategoryId"
        ORDER BY sport, COUNT(*) DESC
      `;
      
      // console.log(`[SubcategoryController] Raw prematch game counts by subcategory:`, prematchCounts);

      // Форматируем результаты в структурированный объект
      const result: Record<string, Record<string, number>> = {};

      // Общее количество prematch игр
      let totalPrematchGames = 0;

      // Обрабатываем результаты с группировкой по спорту
      (prematchCounts as any[]).forEach((row) => {
        const { count, sport, subcategoryId } = row;

        // Игнорируем нулевые подкатегории
        if (!subcategoryId) return;

        // Получаем код подкатегории из карты
        const subcategoryCode = subcategoryMap.get(subcategoryId) || `cat_${subcategoryId}`;

        // Инициализируем объект для спорта, если его еще нет
        if (!result[sport]) {
          result[sport] = {
            total: 0,
          };
        }

        // Увеличиваем счетчики
        const countValue = parseInt(count, 10);
        result[sport].total += countValue;
        totalPrematchGames += countValue;

        // Добавляем количество для подкатегории
        result[sport][subcategoryCode] = countValue;
        
        // console.log(`[SubcategoryController] Sport: ${sport}, Subcategory: ${subcategoryCode}, Count: ${countValue}`);
      });

      // Если у нас есть данные, добавляем общий счетчик
      if (Object.keys(result).length > 0) {
        result['all'] = { total: totalPrematchGames };
      }

      // Удаляем пустые категории
      Object.keys(result).forEach((sport) => {
        if (
          sport !== 'all' &&
          result[sport].total === 0
        ) {
          delete result[sport];
        }
      });
      
      return result;
    } catch (error) {
      console.error('Error getting prematch subcategory counts:', error);
      return {};
    }
  }

  @Post('/forceInitSubcategories')
  @UseGuards(SuperuserGuard)
  @ApiBearerAuth('Admin')
  async forceInitSubcategories() {
    try {
      // Проверяем существующие подкатегории
      const existingSubcategories = await this.prismaService.subcategory.findMany();
      console.log(`Found ${existingSubcategories.length} existing subcategories`);
      
      // Если подкатегорий нет, запускаем инициализацию
      if (existingSubcategories.length === 0) {
        await this.subcategoryService.onModuleInit();
        return { success: true, message: 'Subcategories initialized' };
      }
      
      return { success: true, message: 'Subcategories already exist', count: existingSubcategories.length };
    } catch (error) {
      console.error('Error initializing subcategories:', error);
      return { success: false, error: error.message };
    }
  }

} 