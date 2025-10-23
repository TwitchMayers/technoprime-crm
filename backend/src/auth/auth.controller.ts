import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}
  @Post('login')
  login(@Body() body: { login: string; password: string }) {
    return this.auth.login(body.login, body.password);
  }
}