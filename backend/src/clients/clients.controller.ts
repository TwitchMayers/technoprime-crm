import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { ContactClientDto } from './dto/contact-client.dto';
import { ContactHistoryQueryDto } from './dto/contact-history-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '@prisma/client';

@ApiTags('clients')
@ApiBearerAuth()
@Controller('clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @ApiOperation({ summary: 'Получить список клиентов' })
  @ApiResponse({ status: 200, description: 'Список клиентов получен' })
  list(@Query() query: any) {
    return this.clientsService.list(query);
  }

  @Get('communication/conversations')
  @ApiOperation({ summary: 'Список диалогов клиентов с сайта (мессенджер)' })
  @ApiResponse({ status: 200, description: 'Список диалогов получен' })
  conversations(@Req() req: any) {
    return this.clientsService.getWebsiteConversations(req?.user?.tenant || undefined);
  }

  @Post('communication/purge-suspicious')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Удалить из website-чата сообщения с сигнатурами XSS/SQLi пентеста' })
  @ApiResponse({ status: 200, description: 'Подозрительные сообщения очищены' })
  purgeSuspiciousMessages(@Req() req: any) {
    return this.clientsService.purgeSuspiciousWebsiteMessages(req?.user?.tenant || undefined);
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

  @Post(':id/contact')
  @UseInterceptors(
    FilesInterceptor('files', 6, {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Связаться с клиентом через выбранный канал' })
  @ApiResponse({ status: 200, description: 'Сообщение отправлено' })
  contact(
    @Param('id') id: string,
    @Body() body: ContactClientDto,
    @UploadedFiles() files: any[] = [],
    @Req() req: any,
  ) {
    return this.clientsService.contact(
      Number(id),
      body,
      files,
      req?.user?.tenant || undefined,
      Number(req?.user?.id || 0) || undefined,
    );
  }

  @Get(':id/contact/history')
  @ApiOperation({ summary: 'История сообщений с клиентом' })
  history(@Param('id') id: string, @Query() query: ContactHistoryQueryDto, @Req() req: any) {
    return this.clientsService.getContactHistory(Number(id), query, req?.user?.tenant || undefined);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить клиента' })
  @ApiResponse({ status: 200, description: 'Клиент удален' })
  @ApiResponse({ status: 400, description: 'Нельзя удалить клиента с заказами' })
  remove(@Param('id') id: string) {
    return this.clientsService.remove(Number(id));
  }
}
