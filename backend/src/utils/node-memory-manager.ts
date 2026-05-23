import { EventEmitter } from 'events';

// Централизованный менеджер памяти для Node.js
class NodeMemoryManager extends EventEmitter {
  private static instance: NodeMemoryManager;
  private intervals: Set<NodeJS.Timeout> = new Set();
  private timeouts: Set<NodeJS.Timeout> = new Set();
  private isInitialized = false;
  private memoryThreshold = 500; // MB
  private aggressiveThreshold = 800; // MB
  private cleanupInterval = 5 * 60 * 1000; // 5 минут
  private gcInterval = 2 * 60 * 1000; // 2 минуты
  private stats = {
    intervals: 0,
    timeouts: 0,
    memoryUsage: 0,
    memoryTotal: 0,
    memoryExternal: 0,
    memoryRSS: 0,
    gcCount: 0,
    cleanupCount: 0
  };

  private constructor() {
    super();
  }

  static getInstance(): NodeMemoryManager {
    if (!NodeMemoryManager.instance) {
      NodeMemoryManager.instance = new NodeMemoryManager();
    }
    return NodeMemoryManager.instance;
  }

  // Добавляет интервал в отслеживание
  addInterval(interval: NodeJS.Timeout): void {
    this.intervals.add(interval);
    this.stats.intervals = this.intervals.size;
    this.emit('intervalAdded', this.stats.intervals);
  }

  // Добавляет timeout в отслеживание
  addTimeout(timeout: NodeJS.Timeout): void {
    this.timeouts.add(timeout);
    this.stats.timeouts = this.timeouts.size;
    this.emit('timeoutAdded', this.stats.timeouts);
  }

  // Очищает все интервалы
  clearAllIntervals(): void {
    this.intervals.forEach(interval => {
      clearInterval(interval);
    });
    this.intervals.clear();
    this.stats.intervals = 0;
    this.emit('intervalsCleared');
  }

  // Очищает все timeouts
  clearAllTimeouts(): void {
    this.timeouts.forEach(timeout => {
      clearTimeout(timeout);
    });
    this.timeouts.clear();
    this.stats.timeouts = 0;
    this.emit('timeoutsCleared');
  }

  // Полная очистка всех ресурсов
  clearAll(): void {
    this.clearAllIntervals();
    this.clearAllTimeouts();
    this.stats.cleanupCount++;
    this.emit('allCleared');
  }

  // Инициализирует менеджер памяти
  init(): void {
    if (this.isInitialized) return;
    
    this.isInitialized = true;

    // Основная очистка памяти
    const mainCleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.cleanupInterval);
    
    this.addInterval(mainCleanupInterval);

    // Периодическая сборка мусора
    const gcInterval = setInterval(() => {
      this.forceGC();
    }, this.gcInterval);
    
    this.addInterval(gcInterval);

    // Очистка при завершении процесса
    process.on('SIGINT', () => {
      console.log('Received SIGINT, cleaning up...');
      this.clearAll();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('Received SIGTERM, cleaning up...');
      this.clearAll();
      process.exit(0);
    });

    // Очистка при необработанных исключениях
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      this.clearAll();
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.clearAll();
      process.exit(1);
    });

    console.log('NodeMemoryManager initialized');
  }

  // Выполняет очистку памяти
  private performCleanup(): void {
    this.monitorMemoryUsage();
    this.stats.cleanupCount++;
    this.emit('cleanupPerformed', this.stats);
  }

  // Принудительная сборка мусора
  private forceGC(): void {
    if (global.gc) {
      global.gc();
      this.stats.gcCount++;
      this.emit('gcPerformed', this.stats.gcCount);
    }
  }

  // Мониторинг использования памяти
  private monitorMemoryUsage(): void {
    const memUsage = process.memoryUsage();
    const usedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const totalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const externalMB = Math.round(memUsage.external / 1024 / 1024);
    
    this.stats.memoryUsage = usedMB;

    if (usedMB > this.memoryThreshold) {
      console.warn(`Memory usage: ${usedMB}MB / ${totalMB}MB (External: ${externalMB}MB)`);
      this.emit('memoryWarning', { usedMB, totalMB, externalMB });
      
      // Если память превышает агрессивный порог, выполняем агрессивную очистку
      if (usedMB > this.aggressiveThreshold) {
        this.aggressiveCleanup();
      }
    }
  }

  // Агрессивная очистка при высоком использовании памяти
  private aggressiveCleanup(): void {
    console.warn('Performing aggressive memory cleanup');
    
    // Принудительная сборка мусора
    this.forceGC();
    
    // Очищаем все ресурсы
    this.clearAll();
    
    this.emit('aggressiveCleanupPerformed');
  }

  // Получает статистику использования памяти
  getMemoryStats() {
    const memUsage = process.memoryUsage();
    return {
      ...this.stats,
      memoryUsage: Math.round(memUsage.heapUsed / 1024 / 1024),
      memoryTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      memoryExternal: Math.round(memUsage.external / 1024 / 1024),
      memoryRSS: Math.round(memUsage.rss / 1024 / 1024)
    };
  }

  // Устанавливает пороги памяти
  setMemoryThresholds(normal: number, aggressive: number): void {
    this.memoryThreshold = normal;
    this.aggressiveThreshold = aggressive;
  }

  // Устанавливает интервал очистки
  setCleanupInterval(interval: number): void {
    this.cleanupInterval = interval;
  }

  // Устанавливает интервал GC
  setGCInterval(interval: number): void {
    this.gcInterval = interval;
  }

  // Обновляет статистику
  private updateStats(): void {
    this.stats.intervals = this.intervals.size;
    this.stats.timeouts = this.timeouts.size;
  }

  // Получает детальную информацию о памяти
  getDetailedMemoryInfo(): any {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      arrayBuffers: memUsage.arrayBuffers,
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      externalMB: Math.round(memUsage.external / 1024 / 1024),
      rssMB: Math.round(memUsage.rss / 1024 / 1024)
    };
  }
}

// Утилиты для работы с интервалами
export const createManagedInterval = (callback: () => void, delay: number) => {
  const manager = NodeMemoryManager.getInstance();
  const interval = setInterval(callback, delay);
  manager.addInterval(interval);
  
  return () => {
    clearInterval(interval);
    manager['intervals'].delete(interval);
    // Обновляем статистику через публичный метод
    manager['updateStats']();
  };
};

// Утилиты для работы с timeouts
export const createManagedTimeout = (callback: () => void, delay: number) => {
  const manager = NodeMemoryManager.getInstance();
  const timeout = setTimeout(callback, delay);
  manager.addTimeout(timeout);
  
  return () => {
    clearTimeout(timeout);
    manager['timeouts'].delete(timeout);
    // Обновляем статистику через публичный метод
    manager['updateStats']();
  };
};

// Декоратор для автоматического управления ресурсами
export const withMemoryManagement = <T extends (...args: any[]) => any>(fn: T): T => {
  const manager = NodeMemoryManager.getInstance();
  
  return ((...args: any[]) => {
    try {
      const result = fn(...args);
      
      // Если функция возвращает Promise, добавляем обработку ошибок
      if (result instanceof Promise) {
        return result.catch((error) => {
          console.error('Error in managed function:', error);
          throw error;
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error in managed function:', error);
      throw error;
    }
  }) as T;
};

// Middleware для Express
export const memoryManagementMiddleware = (req: any, res: any, next: any) => {
  const manager = NodeMemoryManager.getInstance();
  
  // Логируем использование памяти для каждого запроса
  const startMemory = process.memoryUsage();
  
  res.on('finish', () => {
    const endMemory = process.memoryUsage();
    const memoryDiff = endMemory.heapUsed - startMemory.heapUsed;
    
    if (Math.abs(memoryDiff) > 1024 * 1024) { // Больше 1MB
      console.warn(`Request ${req.method} ${req.path} used ${Math.round(memoryDiff / 1024 / 1024)}MB`);
    }
  });
  
  next();
};

export const nodeMemoryManager = NodeMemoryManager.getInstance(); 