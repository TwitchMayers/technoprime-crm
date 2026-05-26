import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcrypt';

type LoginMeta = {
  ip?: string;
  userAgent?: string;
};

type FailedAttempt = {
  count: number;
  windowStartedAt: number;
  blockedUntil: number;
};

@Injectable()
export class AuthService {
  private failedAttempts = new Map<string, FailedAttempt>();
  private readonly loginFailureLimit = 6;
  private readonly loginFailureWindowMs = 15 * 60 * 1000;
  private readonly loginBlockMs = 30 * 60 * 1000;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(login: string, password: string, meta?: LoginMeta) {
    const attemptKey = this.buildAttemptKey(login, meta?.ip);
    const blockLeftMs = this.getBlockedLeft(attemptKey);
    if (blockLeftMs > 0) {
      throw new UnauthorizedException(
        `Слишком много неудачных попыток входа. Повторите через ${Math.ceil(blockLeftMs / 60000)} мин.`,
      );
    }

    const user = await this.prisma.employee.findUnique({
      where: { login },
    });

    if (!user) {
      await this.registerFailedLogin(attemptKey, login, meta, 'user_not_found');
      return null;
    }

    if (!user.isActive) {
      await this.registerFailedLogin(attemptKey, login, meta, 'user_inactive');
      return null;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      await this.registerFailedLogin(attemptKey, login, meta, 'invalid_password');
      return null;
    }

    this.resetFailedAttempts(attemptKey);
    return user;
  }

  async login(user: any) {
    const payload = {
      id: user.id,
      login: user.login,
      role: user.role,
      name: user.name,
      position: user.position,
      tenant: user.tenant,
    };

    const access_token = this.jwtService.sign(payload);

    await this.prisma.employee
      .update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      })
      .catch(() => undefined);

    await this.prisma.auditLog
      .create({
        data: {
          userId: user.id,
          action: 'AUTH_LOGIN',
          entityType: 'EMPLOYEE',
          entityId: user.id,
          newData: {
            login: user.login,
            role: user.role,
          } as any,
        },
      })
      .catch(() => undefined);

    return {
      access_token,
      user: {
        id: user.id,
        login: user.login,
        name: user.name,
        role: user.role,
        position: user.position,
      },
    };
  }

  async getUserFromToken(token: string) {
    try {
      const decoded = this.jwtService.verify(token);

      const user = await this.prisma.employee.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          name: true,
          login: true,
          role: true,
          position: true,
          firstName: true,
          lastName: true,
          isActive: true,
        },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found');
      }

      return user;
    } catch (e) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private buildAttemptKey(login: string, ip?: string) {
    const normalizedLogin = String(login || '')
      .trim()
      .toLowerCase();
    const normalizedIp = String(ip || 'unknown').trim();
    return normalizedLogin ? `login:${normalizedLogin}` : `ip:${normalizedIp}`;
  }

  private getBlockedLeft(attemptKey: string) {
    const row = this.failedAttempts.get(attemptKey);
    if (!row) return 0;
    const now = Date.now();
    return Math.max(0, row.blockedUntil - now);
  }

  private resetFailedAttempts(attemptKey: string) {
    this.failedAttempts.delete(attemptKey);
  }

  private async registerFailedLogin(
    attemptKey: string,
    login: string,
    meta: LoginMeta | undefined,
    reason: string,
  ) {
    const now = Date.now();
    const previous = this.failedAttempts.get(attemptKey);
    let next: FailedAttempt;
    if (!previous || now - previous.windowStartedAt > this.loginFailureWindowMs) {
      next = { count: 1, windowStartedAt: now, blockedUntil: 0 };
    } else {
      next = { ...previous, count: previous.count + 1 };
    }

    if (next.count >= this.loginFailureLimit) {
      next.blockedUntil = now + this.loginBlockMs;
      next.count = 0;
      next.windowStartedAt = now;
    }

    this.failedAttempts.set(attemptKey, next);
    if (Math.random() < 0.02) this.cleanupFailedAttempts(now);

    await this.prisma.auditLog
      .create({
        data: {
          userId: null,
          action: 'AUTH_LOGIN_FAILED',
          entityType: 'EMPLOYEE',
          entityId: null,
          newData: {
            login: String(login || '').slice(0, 128),
            reason,
            ip: String(meta?.ip || '').slice(0, 128),
            userAgent: String(meta?.userAgent || '').slice(0, 256),
            blockedUntil: next.blockedUntil || null,
          } as any,
        },
      })
      .catch(() => undefined);
  }

  private cleanupFailedAttempts(now: number) {
    for (const [key, row] of this.failedAttempts.entries()) {
      const expired =
        row.blockedUntil > 0
          ? now - row.blockedUntil > this.loginFailureWindowMs
          : now - row.windowStartedAt > this.loginFailureWindowMs;
      if (expired) this.failedAttempts.delete(key);
    }
  }
}
