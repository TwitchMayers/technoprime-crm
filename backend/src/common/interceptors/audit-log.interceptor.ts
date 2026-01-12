import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.url;
    const userId = request.user?.id;

    // Логируем только DELETE и важные UPDATE операции
    const shouldLog = ['DELETE', 'PATCH'].includes(method) && 
                      (url.includes('/clients/') || 
                       url.includes('/orders/') || 
                       url.includes('/products/'));

    if (!shouldLog) {
      return next.handle();
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: async (data) => {
          const duration = Date.now() - startTime;
          
          try {
            await this.prisma.$executeRaw`
              INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_data, new_data, created_at)
              VALUES (
                ${userId || null},
                ${method},
                ${this.extractEntityType(url)},
                ${this.extractEntityId(url)},
                ${JSON.stringify({})},
                ${JSON.stringify(data)},
                NOW()
              )
            `;
          } catch (err) {
            console.error('Audit log error:', err);
          }
        },
      }),
    );
  }

  private extractEntityType(url: string): string {
    if (url.includes('/clients')) return 'CLIENT';
    if (url.includes('/orders')) return 'ORDER';
    if (url.includes('/products')) return 'PRODUCT';
    return 'UNKNOWN';
  }

  private extractEntityId(url: string): number | null {
    const match = url.match(/\/(\d+)/);
    return match ? parseInt(match[1]) : null;
  }
}