import { Body, Controller, Get, Post, Query, Patch, Param, Delete } from '@nestjs/common';
import { ClientsService } from './clients.service';

@Controller('clients')
export class ClientsController {
  constructor(private svc: ClientsService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('city') city?: string,
    @Query('consoleType') consoleType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) { return this.svc.list({ q, city, consoleType, page: Number(page) || 1, limit: Number(limit) || 50 }); }

  @Post()
  create(@Body() body: any) { return this.svc.create(body); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) { return this.svc.update(Number(id), body); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.svc.remove(Number(id)); }
}