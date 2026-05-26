import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';

@Injectable()
export class ShopApiGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredKey = process.env.SHOP_API_KEY;
    const isProd = process.env.NODE_ENV === 'production';
    if (!requiredKey) {
      if (isProd) {
        throw new ForbiddenException('SHOP_API_KEY is not configured');
      }
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const header = req.headers['x-shop-key'];
    const key = Array.isArray(header) ? header[0] : header;

    if (!key || key !== requiredKey) {
      throw new ForbiddenException('Invalid shop API key');
    }

    return true;
  }
}
