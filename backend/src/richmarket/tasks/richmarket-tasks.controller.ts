import { Controller, Get, Patch, Body, Param, Query } from '@nestjs/common';
import { RichMarketTasksService } from './richmarket-tasks.service';


@Controller('richmarket/tasks')
export class RichMarketTasksController {
  constructor(private readonly service: RichMarketTasksService) {}

  @Get()
  list(@Query() query: any) {
    return this.service.list(query);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(Number(id), body);
  }
}