import { Body, Controller, Get, Patch, Post, Param } from '@nestjs/common';
import { TasksService } from './tasks.service';

@Controller('tasks')
export class TasksController {
  constructor(private svc: TasksService) {}

  @Get()
  list() { return this.svc.list(); }

  @Post()
  create(@Body() body: any) { return this.svc.create(body); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: { status?: 'NEW'|'IN_PROGRESS'|'DONE'; assignedToId?: number }) {
    return this.svc.update(Number(id), body);
  }
}