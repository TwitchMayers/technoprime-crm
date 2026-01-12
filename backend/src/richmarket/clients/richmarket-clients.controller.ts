import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { RichMarketClientsService } from './richmarket-clients.service';

@Controller('richmarket/clients')
export class RichMarketClientsController {
  constructor(private readonly service: RichMarketClientsService) {}

  @Get()
  list(@Query() query: any) {
    return this.service.list(query);
  }

  @Post()
  create(@Body() body: any) {
    return this.service.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(Number(id), body);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(Number(id));
  }
}