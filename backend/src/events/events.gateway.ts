import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';

const wsOrigins = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const defaultWsOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'https://crm.technoprimestore.ru',
  'https://technoprimestore.ru',
  'https://www.technoprimestore.ru',
];

@WebSocketGateway({
  cors: {
    origin: wsOrigins.length ? wsOrigins : defaultWsOrigins,
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  @WebSocketServer()
  server: Server;

  private userRoom(userId: number) {
    return `user:${userId}`;
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.trim();
    }

    const headerAuth = client.handshake.headers?.authorization;
    if (typeof headerAuth === 'string' && headerAuth.trim()) {
      return headerAuth.startsWith('Bearer ') ? headerAuth.slice(7).trim() : headerAuth.trim();
    }

    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string' && queryToken.trim()) {
      return queryToken.trim();
    }

    const cookieHeader = String(client.handshake.headers?.cookie || '');
    const cookiePart = cookieHeader
      .split(';')
      .map((entry: string) => entry.trim())
      .find((entry: string) => entry.startsWith('token='));
    if (cookiePart) {
      const raw = cookiePart.slice('token='.length);
      if (raw) {
        try {
          return decodeURIComponent(raw);
        } catch {
          return raw;
        }
      }
    }

    return null;
  }

  async handleConnection(client: Socket) {
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);
      const userId = Number(payload?.id);
      if (!userId) {
        throw new Error('Invalid token payload');
      }

      const user = await this.prisma.employee.findUnique({
        where: { id: userId },
        select: { id: true, isActive: true },
      });

      if (!user || !user.isActive) {
        throw new Error('User not found');
      }

      client.data.userId = user.id;
      await client.join(this.userRoom(user.id));
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(_client: Socket) {}

  sendToAll(event: string, data: any) {
    this.server.emit(event, data);
  }

  sendToUser(userId: number, event: string, data: any) {
    this.server.to(this.userRoom(userId)).emit(event, data);
  }
}
