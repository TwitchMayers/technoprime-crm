import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let socketAuthKey: string | null = null;

const SOCKET_DEBUG = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEBUG_SOCKET === 'true';

function getBackendUrl() {
  const configured = String(process.env.NEXT_PUBLIC_BACKEND_URL || '').trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://127.0.0.1:4000';
}

function attachSocketListeners(instance: Socket) {
  instance.on('connect', () => {
    if (SOCKET_DEBUG) {
      console.log('WebSocket connected');
    }
  });

  instance.on('disconnect', () => {
    if (SOCKET_DEBUG) {
      console.log('WebSocket disconnected');
    }
  });

  instance.on('error', (error) => {
    if (SOCKET_DEBUG) {
      console.error('WebSocket error:', error);
    }
  });
}

export function getSocket(): Socket {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
  const authKey = token ? `bearer:${token}` : 'cookie-session';

  if (!socket || socketAuthKey !== authKey) {
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
    }

    socket = io(getBackendUrl(), {
      auth: token ? { token } : undefined,
      transports: ['websocket'],
      upgrade: false,
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 8000,
      reconnectionAttempts: 6,
      timeout: 10000,
      withCredentials: true,
    });
    socketAuthKey = authKey;
    attachSocketListeners(socket);
  }

  return socket;
}

export function registerUser(userId: number) {
  if (userId) {
    getSocket();
  }
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  socketAuthKey = null;
}
