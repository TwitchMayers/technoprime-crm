import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';

@ApiTags('clients')
@ApiBearerAuth()
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @ApiOperation({ summary: 'Получить список клиентов' })
  @ApiResponse({ status: 200, description: 'Список клиентов получен' })
  list(@Query() query: any) {
    return this.clientsService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить клиента с полной историей' })
  @ApiResponse({ status: 200, description: 'Клиент получен' })
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(Number(id));
  }

  @Post()
  @ApiOperation({ summary: 'Создать клиента' })
  @ApiResponse({ status: 201, description: 'Клиент создан' })
  @ApiResponse({ status: 400, description: 'Неверные данные' })
  create(@Body() body: CreateClientDto) {
    return this.clientsService.create(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить клиента' })
  update(@Param('id') id: string, @Body() body: Partial<CreateClientDto>) {
    return this.clientsService.update(Number(id), body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить клиента' })
  @ApiResponse({ status: 200, description: 'Клиент удален' })
  @ApiResponse({ status: 400, description: 'Нельзя удалить клиента с заказами' })
  remove(@Param('id') id: string) {
    return this.clientsService.remove(Number(id));
  }
}