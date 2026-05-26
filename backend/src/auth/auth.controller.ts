import {
  Controller,
  Post,
  Body,
  Get,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CustomThrottlerGuard } from '../common/guards/throttle.guard';

function parseTokenFromRequest(request: Request) {
  const authHeader = String(request.headers.authorization || '').trim();
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    return token || null;
  }

  const cookieHeader = String(request.headers.cookie || '');
  if (!cookieHeader) return null;
  const cookiePart = cookieHeader
    .split(';')
    .map(entry => entry.trim())
    .find(entry => entry.startsWith('token='));
  if (!cookiePart) return null;

  const raw = cookiePart.slice('token='.length);
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function extractClientIp(request: Request) {
  const forwardedFor = request.headers['x-forwarded-for'];
  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return String(forwardedFor[0]).split(',')[0].trim();
  }
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }
  const realIp = request.headers['x-real-ip'];
  if (Array.isArray(realIp) && realIp.length > 0) {
    return String(realIp[0]).trim();
  }
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }
  return String(request.ip || request.socket.remoteAddress || '').trim();
}

function tokenCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 1000 * 60 * 60 * 12,
  };
}

function sessionHintCookieOptions() {
  return {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 1000 * 60 * 60 * 12,
  };
}

@Controller('auth')
@UseGuards(CustomThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(
    @Body() body: { login: string; password: string },
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!body?.login || !body?.password) {
      throw new UnauthorizedException('Login and password required');
    }

    const user = await this.authService.validateUser(body.login, body.password, {
      ip: extractClientIp(request),
      userAgent: String(request.headers['user-agent'] || '').slice(0, 256),
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = await this.authService.login(user);
    if (payload?.access_token) {
      response.cookie('token', String(payload.access_token), tokenCookieOptions());
      response.cookie('tp_session', '1', sessionHintCookieOptions());
    }
    return payload;
  }

  @Get('me')
  async me(@Req() req: Request) {
    const token = parseTokenFromRequest(req);
    if (!token) {
      throw new UnauthorizedException('No token provided');
    }
    return this.authService.getUserFromToken(token);
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    response.clearCookie('tp_session', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    // JWT stateless — просто подтверждаем выход
    return { success: true };
  }
}
