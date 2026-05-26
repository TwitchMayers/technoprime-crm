import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Injectable()
export class CustomThrottlerGuard implements CanActivate {
  private requests = new Map<string, number[]>();
  private readonly defaultLimit = 20;
  private readonly defaultTtl = 60000;
  private readonly maxTtl = 10 * 60 * 1000;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const key = this.getKey(request);
    const policy = this.getPolicy(request);

    const now = Date.now();
    const timestamps = this.requests.get(key) || [];

    const validTimestamps = timestamps.filter(t => now - t < policy.ttl);

    if (validTimestamps.length >= policy.limit) {
      throw new HttpException(policy.message, HttpStatus.TOO_MANY_REQUESTS);
    }

    validTimestamps.push(now);
    this.requests.set(key, validTimestamps);

    // Очищаем старые записи каждые 5 минут
    if (Math.random() < 0.01) {
      this.cleanup();
    }

    return true;
  }

  private getKey(request: any): string {
    const ip = String(
      request.ip || request.socket?.remoteAddress || request.connection?.remoteAddress || 'unknown',
    )
      .split(',')[0]
      .trim();
    const userId = request.user?.id || 'anonymous';
    const authHeader = String(request.headers?.authorization || '').trim();
    const cookieHeader = String(request.headers?.cookie || '');
    const cookieTokenPart = cookieHeader
      .split(';')
      .map((entry: string) => entry.trim())
      .find((entry: string) => entry.startsWith('token='));
    const cookieToken = cookieTokenPart ? cookieTokenPart.slice('token='.length) : '';
    const authFingerprint =
      authHeader || cookieToken ? `${authHeader}|${cookieToken}`.slice(0, 96) : 'noauth';
    const path = request.route?.path || request.path || request.url || 'unknown';
    return `${ip}-${userId}-${authFingerprint}-${path}`;
  }

  private getPolicy(request: any) {
    const path = String(request.route?.path || request.path || request.url || '').toLowerCase();

    if (path.includes('auth/login')) {
      return {
        limit: 10,
        ttl: 10 * 60 * 1000,
        message: 'Слишком много попыток входа. Повторите через 10 минут.',
      };
    }

    if (path.includes('auth/me')) {
      return {
        limit: 240,
        ttl: 60 * 1000,
        message: 'Слишком частая проверка сессии. Повторите через несколько секунд.',
      };
    }

    if (path.includes('phone/status')) {
      return {
        limit: 240,
        ttl: 10 * 60 * 1000,
        message: 'Слишком много запросов статуса. Подождите немного.',
      };
    }

    if (path.includes('phone/request')) {
      return {
        limit: 6,
        ttl: 10 * 60 * 1000,
        message: 'Слишком много запросов кода с этого IP. Подождите 10 минут.',
      };
    }

    return {
      limit: this.defaultLimit,
      ttl: this.defaultTtl,
      message: 'Слишком много запросов. Подождите минуту.',
    };
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, timestamps] of this.requests.entries()) {
      const valid = timestamps.filter(t => now - t < this.maxTtl);
      if (valid.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, valid);
      }
    }
  }
}
