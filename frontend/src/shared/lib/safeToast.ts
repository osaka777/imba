import { toast } from "react-toastify";

/**
 * Безопасный вызов toast с обработкой ошибок
 */
export const safeToast = {
  success: (message: string) => {
    try {
      toast.success(message);
    } catch (error) {
      console.error('Toast error:', error);
      // Fallback
      if (typeof window !== 'undefined') {
        alert(`✅ ${message}`);
      }
    }
  },
  
  error: (message: string) => {
    try {
      toast.error(message);
    } catch (error) {
      console.error('Toast error:', error);
      // Fallback
      if (typeof window !== 'undefined') {
        alert(`❌ ${message}`);
      }
    }
  },
  
  warning: (message: string) => {
    try {
      toast.warning(message);
    } catch (error) {
      console.error('Toast error:', error);
      // Fallback
      if (typeof window !== 'undefined') {
        alert(`⚠️ ${message}`);
      }
    }
  },
  
  info: (message: string) => {
    try {
      toast.info(message);
    } catch (error) {
      console.error('Toast error:', error);
      // Fallback
      if (typeof window !== 'undefined') {
        alert(`ℹ️ ${message}`);
      }
    }
  }
}; 