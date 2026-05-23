import React, { useEffect, useState } from 'react';
import { 
  useMemoryManager, 
  createManagedEventListener, 
  createManagedInterval, 
  createManagedTimeout 
} from './memory-manager';

// Пример компонента с использованием useMemoryManager
export const MemoryManagedComponent: React.FC = () => {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const memoryManager = useMemoryManager();

  useEffect(() => {
    // Автоматически управляемый интервал
    const cleanupInterval = createManagedInterval(() => {
      setCount(prev => prev + 1);
    }, 1000);

    // Автоматически управляемый timeout
    const cleanupTimeout = createManagedTimeout(() => {
      setIsVisible(true);
    }, 2000);

    // Автоматически управляемый обработчик событий
    const cleanupEventListener = createManagedEventListener(
      window,
      'scroll',
      () => {
        console.log('Window scrolled');
      }
    );

    // Добавляем React эффект для очистки
    memoryManager.addReactEffect(() => {
      console.log('Component cleanup');
    });

    // Очистка при размонтировании компонента
    return () => {
      cleanupInterval();
      cleanupTimeout();
      cleanupEventListener();
    };
  }, [memoryManager]);

  return (
    <div>
      <h3>Memory Managed Component</h3>
      <p>Count: {count}</p>
      {isVisible && <p>Component is visible!</p>}
      
      <button onClick={() => memoryManager.getMemoryStats()}>
        Get Memory Stats
      </button>
    </div>
  );
};

// Пример компонента с кастомными настройками памяти
export const CustomMemoryComponent: React.FC = () => {
  const memoryManager = useMemoryManager();

  useEffect(() => {
    // Настраиваем пороги памяти
    memoryManager.setMemoryThresholds(300, 450); // Более строгие пороги
    
    // Настраиваем интервал очистки
    memoryManager.setCleanupInterval(5 * 60 * 1000); // 5 минут

    // Добавляем кастомный интервал
    const interval = setInterval(() => {
      console.log('Custom interval running');
    }, 5000);
    
    memoryManager.addInterval(interval);

    return () => {
      clearInterval(interval);
    };
  }, [memoryManager]);

  const handleGetStats = () => {
    const stats = memoryManager.getMemoryStats();
    console.log('Memory Stats:', stats);
  };

  const handleForceCleanup = () => {
    memoryManager.clearAll();
    console.log('Forced cleanup completed');
  };

  return (
    <div>
      <h3>Custom Memory Component</h3>
      <button onClick={handleGetStats}>Get Stats</button>
      <button onClick={handleForceCleanup}>Force Cleanup</button>
    </div>
  );
};

// Пример хука для работы с WebSocket
export const useManagedWebSocket = (url: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const memoryManager = useMemoryManager();

  useEffect(() => {
    const ws = new WebSocket(url);

    const handleOpen = () => setIsConnected(true);
    const handleClose = () => setIsConnected(false);
    const handleMessage = (event: MessageEvent) => {
      setMessages(prev => [...prev, event.data]);
    };

    // Используем управляемые обработчики событий
    const cleanupOpen = createManagedEventListener(ws, 'open', handleOpen);
    const cleanupClose = createManagedEventListener(ws, 'close', handleClose);
    const cleanupMessage = createManagedEventListener(ws, 'message', handleMessage);

    // Добавляем React эффект для очистки
    memoryManager.addReactEffect(() => {
      ws.close();
    });

    return () => {
      cleanupOpen();
      cleanupClose();
      cleanupMessage();
      ws.close();
    };
  }, [url, memoryManager]);

  return { isConnected, messages };
};

// Пример компонента с WebSocket
export const WebSocketComponent: React.FC = () => {
  const { isConnected, messages } = useManagedWebSocket('wss://echo.websocket.org');

  return (
    <div>
      <h3>WebSocket Component</h3>
      <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
      <div>
        <h4>Messages:</h4>
        {messages.map((msg, index) => (
          <div key={index}>{msg}</div>
        ))}
      </div>
    </div>
  );
};

// Пример хука для работы с геолокацией
export const useManagedGeolocation = () => {
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const memoryManager = useMemoryManager();

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }

    const handleSuccess = (pos: GeolocationPosition) => {
      setPosition(pos);
      setError(null);
    };

    const handleError = (err: GeolocationPositionError) => {
      setError(err.message);
    };

    // Используем управляемый интервал для периодического обновления
    const cleanupInterval = createManagedInterval(() => {
      navigator.geolocation.getCurrentPosition(handleSuccess, handleError);
    }, 30000); // Каждые 30 секунд

    // Добавляем React эффект для очистки
    memoryManager.addReactEffect(() => {
      console.log('Geolocation cleanup');
    });

    return cleanupInterval;
  }, [memoryManager]);

  return { position, error };
};

// Пример компонента с геолокацией
export const GeolocationComponent: React.FC = () => {
  const { position, error } = useManagedGeolocation();

  return (
    <div>
      <h3>Geolocation Component</h3>
      {error && <p>Error: {error}</p>}
      {position && (
        <div>
          <p>Latitude: {position.coords.latitude}</p>
          <p>Longitude: {position.coords.longitude}</p>
          <p>Accuracy: {position.coords.accuracy} meters</p>
        </div>
      )}
    </div>
  );
}; 