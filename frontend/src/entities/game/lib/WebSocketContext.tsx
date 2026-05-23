import { createContext, useContext, useEffect, useRef, useState } from "react";

type WebSocketContextType = {
    sendJsonMessage: (message: any) => void;
    addMessageHandler: (handler: (message: any) => void) => void;
    removeMessageHandler: (handler: (message: any) => void) => void;
    subscribe: (eventId: string, subscriptionType?: 'group' | 'detail' | 'detailed') => void;
    unsubscribe: (eventId: string) => void;
    isConnected: boolean;
    connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
    disconnect: () => void;
    reconnect: () => void;
};

const WebSocketContext = createContext<WebSocketContextType | null>(null);

// Get WebSocket URL from environment or fallback to default
const WS_URL = (() => {
    try {
        // If NEXT_PUBLIC_WS_URL is set, use it
        if (process.env.NEXT_PUBLIC_WS_URL) {
            return process.env.NEXT_PUBLIC_WS_URL;
        }

        // In development, use ws:// with localhost on port 3000 (backend)
        if (process.env.NODE_ENV === 'development') {
            const protocol = 'ws:'; // Always use ws in development
            return `${protocol}//localhost:3000/api/events`;
        }

        // In production, use wss:// with the same host as the page
        if (typeof window !== 'undefined') {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.host;
            return `${protocol}//${host}/api/events`;
        }

        // Fallback for SSR
        return null;
    } catch (error) {
        console.error('Error resolving WebSocket URL:', error);
        return null;
    }
})();

export const WebSocketProvider = ({ children }: { children: React.ReactNode }) => {
    const ws = useRef<WebSocket | null>(null);
    const messageHandlers = useRef<((message: any) => void)[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const reconnectAttempts = useRef(0);
    const maxReconnectAttempts = 50;
    const reconnectInterval = 2000;
    const subscriptions = useRef<Map<string, 'group' | 'detail' | 'detailed'>>(new Map());
    const messageQueue = useRef<any[]>([]);
    const [isInitialized, setIsInitialized] = useState(false);
    
    // Heartbeat mechanism
    const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
    const heartbeatTimeout = useRef<NodeJS.Timeout | null>(null);
    const lastPongTime = useRef<number>(Date.now());
    const HEARTBEAT_INTERVAL = 30000; // 30 seconds
    const HEARTBEAT_TIMEOUT = 10000; // 10 seconds timeout for pong response
    
    // Connection state tracking
    const connectionState = useRef<'disconnected' | 'connecting' | 'connected' | 'reconnecting'>('disconnected');
    const isManualDisconnect = useRef(false);

    // Heartbeat functions
    const startHeartbeat = () => {
        stopHeartbeat();
        
        heartbeatInterval.current = setInterval(() => {
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                try {
                    ws.current.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
                    
                    // Set timeout for pong response
                    heartbeatTimeout.current = setTimeout(() => {
                        console.warn('❌ [WebSocket] Heartbeat timeout - no pong received');
                        if (ws.current) {
                            ws.current.close(1000, 'Heartbeat timeout');
                        }
                    }, HEARTBEAT_TIMEOUT);
                } catch (error) {
                    console.error('❌ [WebSocket] Error sending ping:', error);
                }
            }
        }, HEARTBEAT_INTERVAL);
    };
    
    const stopHeartbeat = () => {
        if (heartbeatInterval.current) {
            clearInterval(heartbeatInterval.current);
            heartbeatInterval.current = null;
        }
        if (heartbeatTimeout.current) {
            clearTimeout(heartbeatTimeout.current);
            heartbeatTimeout.current = null;
        }
    };
    
    const handlePong = () => {
        lastPongTime.current = Date.now();
        if (heartbeatTimeout.current) {
            clearTimeout(heartbeatTimeout.current);
            heartbeatTimeout.current = null;
        }
    };

    const sendJsonMessage = (message: any) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN && connectionState.current === 'connected') {
            try {
                ws.current.send(JSON.stringify(message));
            } catch (error) {
                console.error('❌ [WebSocket] Error sending message:', error);
                messageQueue.current.push(message);
            }
        } else {
            messageQueue.current.push(message);
            if (connectionState.current === 'disconnected') {
                connect();
            }
        }
    };

    const addMessageHandler = (handler: (message: any) => void) => {
        messageHandlers.current.push(handler);
    };

    const removeMessageHandler = (handler: (message: any) => void) => {
        messageHandlers.current = messageHandlers.current.filter((h) => h !== handler);
    };

    const normalizeType = (subscriptionType: 'group' | 'detail' | 'detailed' = 'group') =>
      subscriptionType === 'detail' ? 'detailed' : subscriptionType;

    const subscribe = (eventId: string, subscriptionType: 'group' | 'detail' | 'detailed' = 'group') => {
        console.log(`📡 [WebSocket] Subscribe called for eventId: ${eventId}, subscriptionType: ${subscriptionType}`);
        const typeToStore = normalizeType(subscriptionType);
        subscriptions.current.set(eventId, typeToStore);
        
        // Lazy initialization - connect only when first subscription is made
        if (!isInitialized) {
            console.log('🚀 [WebSocket] Lazy initialization - connecting WebSocket for first time');
            setIsInitialized(true);
            connect();
        }
        
        if (isConnected) {
            sendJsonMessage({
                type: "subscribe",
                filter: { eventIds: [eventId], subscriptionType: typeToStore },
            });
        }
    };

    const unsubscribe = (eventId: string) => {
        const prevType = subscriptions.current.get(eventId);
        subscriptions.current.delete(eventId);

        if (isConnected) {
            const typeToSend = prevType ? normalizeType(prevType) : undefined;
            sendJsonMessage({
                type: "unsubscribe",
                filter: { eventIds: [eventId], ...(typeToSend ? { subscriptionType: typeToSend } : {}) },
            });
        }
    };

    const resubscribe = () => {
        subscriptions.current.forEach((subscriptionType, eventId) => {
            const typeToSend = normalizeType(subscriptionType);
            sendJsonMessage({
                type: "subscribe",
                filter: { eventIds: [eventId], subscriptionType: typeToSend },
            });
        });
    };

    const processMessageQueue = () => {
        if (messageQueue.current.length > 0 && ws.current?.readyState === WebSocket.OPEN) {
            messageQueue.current.forEach(message => {
                ws.current?.send(JSON.stringify(message));
            });
            messageQueue.current = [];
        }
    };

    const connect = () => {
        console.log('🔌 [WebSocket] Connect function called');
        if (!WS_URL) {
            console.error('WebSocket URL is not available');
            return;
        }

        if (connectionState.current === 'connecting' || connectionState.current === 'connected') {
            console.log(`🔌 [WebSocket] Already ${connectionState.current}, skipping connect`);
            return;
        }

        if (ws.current?.readyState === WebSocket.CONNECTING) {
            return;
        }

        if (ws.current?.readyState === WebSocket.OPEN) {
            return;
        }

        connectionState.current = reconnectAttempts.current > 0 ? 'reconnecting' : 'connecting';
        isManualDisconnect.current = false;

        try {
            // Close existing connection if any
            if (ws.current) {
                ws.current.close();
            }
            
            console.log(`🔌 [WebSocket] Creating new WebSocket connection to: ${WS_URL}`);
            const socket = new WebSocket(WS_URL);

            socket.onopen = () => {
                console.log('✅ [WebSocket] Connected successfully');
                setIsConnected(true);
                connectionState.current = 'connected';
                reconnectAttempts.current = 0;
                lastPongTime.current = Date.now();
                
                // Start heartbeat
                startHeartbeat();
                
                // Добавляем небольшую задержку перед восстановлением подписок
                setTimeout(() => {
                    processMessageQueue();
                    resubscribe();
                    console.log('🔄 [WebSocket] Subscriptions restored after reconnection');
                }, 100);
            };

            socket.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    
                    // Handle pong messages
                    if (message.type === 'pong') {
                        handlePong();
                        return;
                    }
                    
                    console.log('📨 [WebSocket] Received message:', message.type, message);
                    messageHandlers.current.forEach((handler) => handler(message));
                } catch (error) {
                    console.error("❌ [WebSocket] Error parsing message:", error);
                }
            };

            socket.onclose = (event) => {
                const reason = event.reason || 'Unknown reason';
                console.log(`🔌 [WebSocket] Connection closed (code: ${event.code}, reason: ${reason}), setting isConnected to false`);
                setIsConnected(false);
                connectionState.current = 'disconnected';
                stopHeartbeat();
                ws.current = null;

                // Don't reconnect if it was a manual disconnect
                if (isManualDisconnect.current) {
                    return;
                }

                // Don't reconnect on normal closure (1000) or if going away (1001)
                if (event.code === 1000 || event.code === 1001) {
                    return;
                }

                if (reconnectAttempts.current < maxReconnectAttempts) {
                    reconnectAttempts.current += 1;
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
                    setTimeout(connect, delay);
                } else {
                    console.error("Max reconnection attempts reached. Giving up.");
                }
            };

            socket.onerror = (error) => {
                try {
                    connectionState.current = 'disconnected';
                    stopHeartbeat();
                    // Log additional connection details for debugging
                } catch (handlerError) {
                    console.error('Error in WebSocket error handler:', handlerError);
                }
            };

            ws.current = socket;
        } catch (error) {
            console.error('❌ [WebSocket] Error creating connection:', error);
            connectionState.current = 'disconnected';
            // Attempt to reconnect on connection error
            if (reconnectAttempts.current < maxReconnectAttempts) {
                reconnectAttempts.current += 1;
                const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
                console.log(`Reconnecting after error... Attempt ${reconnectAttempts.current} of ${maxReconnectAttempts} (delay: ${delay}ms)`);
                setTimeout(connect, delay);
            }
        }
    };

    const disconnect = () => {
        isManualDisconnect.current = true;
        stopHeartbeat();
        
        if (ws.current) {
            ws.current.close(1000, 'Manual disconnect');
            ws.current = null;
        }
        
        console.log('🔌 [WebSocket] Manual disconnect, setting isConnected to false');
        setIsConnected(false);
        connectionState.current = 'disconnected';
        messageQueue.current = [];
        subscriptions.current.clear();
    };

    useEffect(() => {
        // Only connect when initialized (lazy loading)
        return () => {
            disconnect();
        };
    }, []);

    return (
        <WebSocketContext.Provider
            value={{ 
                sendJsonMessage, 
                addMessageHandler, 
                removeMessageHandler, 
                subscribe, 
                unsubscribe, 
                isConnected,
                connectionState: connectionState.current,
                disconnect,
                reconnect: connect
            }}
        >
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocketContext = () => {
    const context = useContext(WebSocketContext);
    if (!context) {
        throw new Error("useWebSocketContext must be used within a WebSocketProvider");
    }
    return context;
};