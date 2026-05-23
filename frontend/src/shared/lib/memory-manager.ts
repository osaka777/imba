import React from "react";

// Централизованный менеджер памяти
class MemoryManager {
  private static instance: MemoryManager;

  private intervals: Set<NodeJS.Timeout> = new Set();
  private timeouts: Set<NodeJS.Timeout> = new Set();
  private eventListeners: Map<
    string,
    Map<EventListener, EventTarget>
  > = new Map();
  private reactEffects: Set<() => void> = new Set();
  private isInitialized = false;

  private memoryThreshold = 400; // MB
  private aggressiveThreshold = 600; // MB
  private cleanupInterval = 5 * 60 * 1000; // 5 минут

  private constructor() {}

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  // ===== Таймеры =====
  addInterval(interval: NodeJS.Timeout) {
    this.intervals.add(interval);
  }

  addTimeout(timeout: NodeJS.Timeout) {
    this.timeouts.add(timeout);
  }

  clearAllIntervals() {
    this.intervals.forEach(clearInterval);
    this.intervals.clear();
  }

  clearAllTimeouts() {
    this.timeouts.forEach(clearTimeout);
    this.timeouts.clear();
  }

  // ===== Слушатели =====
  addEventListener(element: EventTarget, type: string, handler: EventListener) {
    const key = `${element.constructor.name}-${type}`;
    if (!this.eventListeners.has(key)) {
      this.eventListeners.set(key, new Map());
    }
    this.eventListeners.get(key)!.set(handler, element);
    element.addEventListener(type, handler);
  }

  removeEventListener(element: EventTarget, type: string, handler: EventListener) {
    const key = `${element.constructor.name}-${type}`;
    this.eventListeners.get(key)?.delete(handler);
    element.removeEventListener(type, handler);
  }

  clearAllEventListeners() {
    this.eventListeners.forEach((handlers, key) => {
      handlers.forEach((element, handler) => {
        const [, type] = key.split("-");
        element.removeEventListener(type, handler);
      });
    });
    this.eventListeners.clear();
  }

  // ===== React эффекты =====
  addReactEffect(cleanup: () => void) {
    this.reactEffects.add(cleanup);
  }

  clearAllReactEffects() {
    this.reactEffects.forEach((cleanup) => {
      try {
        cleanup();
      } catch (e) {
        console.warn("React effect cleanup error:", e);
      }
    });
    this.reactEffects.clear();
  }

  // ===== Полная очистка =====
  clearAll() {
    this.clearAllIntervals();
    this.clearAllTimeouts();
    this.clearAllEventListeners();
    this.clearAllReactEffects();
  }

  // ===== Инициализация =====
  init() {
    if (this.isInitialized || typeof window === "undefined") return;
    this.isInitialized = true;

    // Периодическая очистка
    const mainCleanup = setInterval(() => {
      this.performCleanup();
    }, this.cleanupInterval);
    this.addInterval(mainCleanup);

    // Очистка при закрытии вкладки
    window.addEventListener("beforeunload", () => this.clearAll());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.performCleanup();
    });

    console.log("MemoryManager initialized");
  }

  private performCleanup() {
    this.monitorMemoryUsage();
    this.clearAllReactEffects(); // частичная очистка
  }

  private monitorMemoryUsage() {
    if (process.env.NODE_ENV === "development" && "memory" in performance) {
      const memory = (performance as any).memory;
      const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
      const totalMB = Math.round(memory.totalJSHeapSize / 1024 / 1024);

      if (usedMB > this.memoryThreshold) {
        console.warn(`Memory usage: ${usedMB}MB / ${totalMB}MB`);

        if (usedMB > this.aggressiveThreshold) {
          console.warn("⚠️ Aggressive cleanup triggered");
          this.clearAll();
        }
      }
    }
  }

  // ===== Инфо =====
  getMemoryStats() {
    return {
      intervals: this.intervals.size,
      timeouts: this.timeouts.size,
      eventListeners: Array.from(this.eventListeners.values()).reduce(
        (sum, map) => sum + map.size,
        0
      ),
      reactEffects: this.reactEffects.size,
    };
  }

  setMemoryThresholds(normal: number, aggressive: number) {
    this.memoryThreshold = normal;
    this.aggressiveThreshold = aggressive;
  }

  setCleanupInterval(interval: number) {
    this.cleanupInterval = interval;
  }
}

// ===== React hook =====
export const useMemoryManager = () => {
  const manager = MemoryManager.getInstance();

  React.useEffect(() => {
    manager.init();
  }, []);

  return {
    addInterval: manager.addInterval.bind(manager),
    addTimeout: manager.addTimeout.bind(manager),
    addEventListener: manager.addEventListener.bind(manager),
    removeEventListener: manager.removeEventListener.bind(manager),
    addReactEffect: manager.addReactEffect.bind(manager),
    clearAll: manager.clearAll.bind(manager),
    getMemoryStats: manager.getMemoryStats.bind(manager),
    setMemoryThresholds: manager.setMemoryThresholds.bind(manager),
    setCleanupInterval: manager.setCleanupInterval.bind(manager),
  };
};

// ===== Утилиты =====
export const createManagedEventListener = (
  element: EventTarget,
  type: string,
  handler: EventListener
) => {
  const manager = MemoryManager.getInstance();
  manager.addEventListener(element, type, handler);
  return () => manager.removeEventListener(element, type, handler);
};

export const createManagedInterval = (callback: () => void, delay: number) => {
  const manager = MemoryManager.getInstance();
  const interval = setInterval(callback, delay);
  manager.addInterval(interval);
  return () => {
    clearInterval(interval);
    manager["intervals"].delete(interval);
  };
};

export const createManagedTimeout = (callback: () => void, delay: number) => {
  const manager = MemoryManager.getInstance();
  const timeout = setTimeout(callback, delay);
  manager.addTimeout(timeout);
  return () => {
    clearTimeout(timeout);
    manager["timeouts"].delete(timeout);
  };
};

export const memoryManager = MemoryManager.getInstance();
