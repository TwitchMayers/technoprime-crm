import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { InstructionsService } from './instructions.service';

@Controller('instructions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
export class InstructionsController {
  constructor(private readonly instructions: InstructionsService) {}

  @Get()
  list() {
    return this.instructions.list();
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  create(@Body() body: any, @Req() req: any) {
    return this.instructions.create(body, Number(req?.user?.id || 0) || null);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req: any) {
    return this.instructions.update(id, body, Number(req?.user?.id || 0) || null);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.instructions.remove(id);
  }
}
