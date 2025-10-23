import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private roles: ('ADMIN' | 'MANAGER')[] = []) {}
  canActivate(ctx: ExecutionContext) {
    if (this.roles.length === 0) return true;
    const req = ctx.switchToHttp().getRequest();
    return this.roles.includes(req.user?.role);
  }
}