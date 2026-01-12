import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'DEV_SECRET_DO_NOT_USE_IN_PROD',
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
      },
    });

    if (!user) {
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
