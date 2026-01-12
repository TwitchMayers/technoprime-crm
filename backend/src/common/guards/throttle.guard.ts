import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';

@Injectable()
export class CustomThrottlerGuard implements CanActivate {
  private requests = new Map<string, number[]>();
  private readonly limit = 20; // 20 запросов
  private readonly ttl = 60000; // за 1 минуту

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const key = this.getKey(request);

    const now = Date.now();
    const timestamps = this.requests.get(key) || [];
    
    const validTimestamps = timestamps.filter(t => now - t < this.ttl);
    
    if (validTimestamps.length >= this.limit) {
      throw new HttpException(
        'Слишком много запросов. Подождите минуту.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
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
    const ip = request.ip || request.connection.remoteAddress;
    const userId = request.user?.id || 'anonymous';
    return `${ip}-${userId}`;
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, timestamps] of this.requests.entries()) {
      const valid = timestamps.filter(t => now - t < this.ttl);
      if (valid.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, valid);
      }
    }
  }
}