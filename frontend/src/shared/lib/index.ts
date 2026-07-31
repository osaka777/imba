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
export { makeMetadata, noIndexMetadata, SITE_DESCRIPTION } from "./metadata";
export { ANDROID_APP_VERSION, WINDOWS_APP_VERSION } from "./appVersion";
export { 
  memoryManager,
  useMemoryManager,
  createManagedInterval,
  createManagedTimeout,
  createManagedEventListener
} from "./memory-manager";
