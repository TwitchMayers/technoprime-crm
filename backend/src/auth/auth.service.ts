import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(login: string, password: string) {
    const user = await this.prisma.employee.findUnique({
      where: { login },
    });

    if (!user) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return null;
    }

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
        },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return user;
    } catch (e) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
