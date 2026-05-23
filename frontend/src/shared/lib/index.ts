import { makeMetadata } from "./metadata";
import { memoryManager } from "./memory-manager";

export const init = (() => {
    if (typeof window !== 'undefined') {
      // Инициализируем централизованный менеджер памяти
      memoryManager.init();
    }
    return true;
  })();
export * from "./twMerge";
export { makeMetadata };
export { 
  memoryManager,
  useMemoryManager,
  createManagedInterval,
  createManagedTimeout,
  createManagedEventListener
} from "./memory-manager";
