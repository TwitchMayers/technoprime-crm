import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Гарантируем строку: берём из .env или дефолт
      secretOrKey: config.get<string>('JWT_SECRET', 'dev_secret'),
    });
  }

  async validate(payload: any) {
    // Данные, которые попадут в req.user
    return { id: payload.sub, role: payload.role, name: payload.name };
  }
}