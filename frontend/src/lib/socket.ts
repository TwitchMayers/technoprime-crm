'use client';
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket() {
  if (socket) return socket;
  socket = io('http://127.0.0.1:4000', {
    transports: ['websocket'],
  });
  return socket;
}

export async function registerUser(userId: number) {
  const s = getSocket();
  s.emit('register', { userId });
}