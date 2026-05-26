import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma.service';

function extractTokenFromCookie(request: any) {
  const header = String(request?.headers?.cookie || '');
  if (!header) return null;
  const part = header
    .split(';')
    .map((entry: string) => entry.trim())
    .find((entry: string) => entry.startsWith('token='));
  if (!part) return null;
  const raw = part.slice('token='.length);
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    const secret = String(process.env.JWT_SECRET || '').trim();
    if (!secret) {
      throw new Error('JWT_SECRET is required');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        extractTokenFromCookie,
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    if (!payload?.id) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const user = await this.prisma.employee.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        login: true,
        name: true,
        role: true,
        position: true,
        tenant: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found');
    }

    // ⚠️ ВАЖНО:
    // Возвращаем ТОЛЬКО реальные данные из БД
    // Никаких дефолтов, никаких фейков
    return {
      id: user.id,
      login: user.login,
      name: user.name,
      role: user.role,
      position: user.position,
      tenant: user.tenant,
    };
  }
}
