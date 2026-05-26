import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = String(request.method || '').toUpperCase();
    const url = String(request.originalUrl || request.url || '');
    const userId = Number(request.user?.id || 0) || null;

    const shouldLog =
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && this.isTrackedResource(url);

    if (!shouldLog) {
      return next.handle();
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: async data => {
          const duration = Date.now() - startTime;
          const ip = this.extractIp(request);
          const userAgent = String(request.headers?.['user-agent'] || '').slice(0, 256);

          try {
            await this.prisma.auditLog.create({
              data: {
                userId,
                action: `HTTP_${method}`,
                entityType: this.extractEntityType(url),
                entityId: this.extractEntityId(url),
                newData: {
                  path: url,
                  status: 'ok',
                  durationMs: duration,
                  ip,
                  userAgent,
                  body: this.safeBody(request?.body),
                  response: this.safeResponse(data),
                } as any,
              },
            });
          } catch (err) {
            console.error('Audit log error:', err);
          }
        },
      }),
    );
  }

  private isTrackedResource(url: string) {
    return (
      url.includes('/clients') ||
      url.includes('/orders') ||
      url.includes('/products') ||
      url.includes('/employees') ||
      url.includes('/instructions') ||
      url.includes('/marketing-campaigns')
    );
  }

  private extractEntityType(url: string): string {
    if (url.includes('/clients')) return 'CLIENT';
    if (url.includes('/orders')) return 'ORDER';
    if (url.includes('/products')) return 'PRODUCT';
    if (url.includes('/employees')) return 'EMPLOYEE';
    if (url.includes('/instructions')) return 'INSTRUCTION';
    if (url.includes('/marketing-campaigns')) return 'MARKETING_CAMPAIGN';
    return 'UNKNOWN';
  }

  private extractEntityId(url: string): number | null {
    const match = url.match(
      /\/(clients|orders|products|employees|instructions|marketing-campaigns)\/(\d+)/i,
    );
    return match ? Number(match[2]) : null;
  }

  private extractIp(request: any): string {
    const forwardedFor = request?.headers?.['x-forwarded-for'];
    const fromHeader = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : String(forwardedFor || '')
          .split(',')[0]
          .trim();
    const ip = String(
      request?.ip || request?.socket?.remoteAddress || request?.connection?.remoteAddress || '',
    ).trim();
    return fromHeader || ip || 'unknown';
  }

  private safeBody(body: unknown) {
    if (!body || typeof body !== 'object') return body ?? null;
    const cloned: Record<string, unknown> = { ...(body as Record<string, unknown>) };
    for (const key of Object.keys(cloned)) {
      if (/(password|token|secret|code)/i.test(key)) {
        cloned[key] = '***';
      }
    }
    return cloned;
  }

  private safeResponse(data: unknown) {
    if (!data || typeof data !== 'object') return data ?? null;
    const cloned: Record<string, unknown> = { ...(data as Record<string, unknown>) };
    for (const key of Object.keys(cloned)) {
      if (/(token|secret|password|hash)/i.test(key)) {
        cloned[key] = '***';
      }
    }
    return cloned;
  }
}
