import {
  Controller,
  Post,
  Body,
  Get,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { login: string; password: string }) {
    if (!body?.login || !body?.password) {
      throw new UnauthorizedException('Login and password required');
    }

    const user = await this.authService.validateUser(
      body.login,
      body.password,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.authService.login(user);
  }

  @Get('me')
  async me(@Req() req: any) {
    const auth = req.headers.authorization;

    if (!auth || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException('No token provided');
    }

    const token = auth.replace('Bearer ', '');
    return this.authService.getUserFromToken(token);
  }

  @Post('logout')
  async logout() {
    // JWT stateless — просто подтверждаем выход
    return { success: true };
  }
}
