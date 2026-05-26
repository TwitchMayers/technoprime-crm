import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SharingSystemsService } from './sharing-systems.service';
import { CreateSharingSystemDto } from './dto/create-sharing-system.dto';
import { AssignClientSlotDto } from './dto/assign-client-slot.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

type SharingConsoleType = 'PS4' | 'PS5' | 'XBOX_1' | 'XBOX_2';

@ApiTags('sharing-systems')
@ApiBearerAuth()
@Controller('sharing-systems')
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ transform: true }))
export class SharingSystemsController {
  constructor(private readonly sharingSystemsService: SharingSystemsService) {}

  @Post()
  @ApiOperation({ summary: 'Создать систему шеринга' })
  @ApiResponse({ status: 201, description: 'Система шеринга создана' })
  create(@Body() createSharingSystemDto: CreateSharingSystemDto) {
    return this.sharingSystemsService.createSharingSystem(createSharingSystemDto);
  }

  @Get()
  @ApiOperation({ summary: 'Получить список систем шеринга' })
  @ApiResponse({ status: 200, description: 'Список систем получен' })
  list(
    @Query('isActive') isActive?: string,
    @Query('withAvailableSlots') withAvailableSlots?: string,
    @Query('consoleType') consoleType?: SharingConsoleType,
  ) {
    return this.sharingSystemsService.listSharingSystems({
      isActive: isActive ? isActive === 'true' : undefined,
      withAvailableSlots: withAvailableSlots ? withAvailableSlots === 'true' : undefined,
      consoleType,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Получить статистику по системам шеринга' })
  getStats() {
    return this.sharingSystemsService.getSharingSystemStats();
  }

  @Get('search-clients')
  @ApiOperation({ summary: 'Поиск клиентов для добавления в систему' })
  @ApiResponse({ status: 200, description: 'Результаты поиска клиентов' })
  searchClients(@Query('q') query: string, @Query('sharingSystemId') sharingSystemId?: string) {
    return this.sharingSystemsService.searchClients(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить детали системы шеринга' })
  @ApiResponse({ status: 200, description: 'Детали системы получены' })
  @ApiResponse({ status: 404, description: 'Система не найдена' })
  getOne(@Param('id') id: string) {
    return this.sharingSystemsService.getSharingSystem(Number(id));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить систему шеринга' })
  @ApiResponse({ status: 200, description: 'Система шеринга удалена' })
  delete(@Param('id') id: string) {
    return this.sharingSystemsService.deleteSharingSystem(Number(id));
  }

  @Post('assign-client')
  @ApiOperation({ summary: 'Привязать клиента к слоту в системе шеринга' })
  @ApiResponse({ status: 201, description: 'Клиент привязан к слоту' })
  async assignClient(@Body() data: AssignClientSlotDto) {
    return this.sharingSystemsService.assignClientToSlot(data);
  }

  @Delete('client-slot/:slotId')
  @ApiOperation({ summary: 'Отвязать клиента от слота' })
  @ApiResponse({ status: 200, description: 'Клиент отвязан от слота' })
  removeClient(@Param('slotId') slotId: string) {
    return this.sharingSystemsService.removeClientFromSlot(Number(slotId));
  }

  @Put('donor-account/:donorId/details')
  @ApiOperation({ summary: 'Обновить расширенные данные донорского аккаунта' })
  @ApiResponse({ status: 200, description: 'Данные донора обновлены' })
  updateDonorDetails(
    @Param('donorId') donorId: string,
    @Body()
    data: {
      email?: string;
      password?: string;
      region?: string;
      emailLogin?: string;
      emailPassword?: string;
      accountPassword?: string;
      dateOfBirth?: string;
      backupCodes?: string;
      notes?: string;
    },
  ) {
    return this.sharingSystemsService.updateDonorDetails(Number(donorId), data);
  }

  @Put('donor-account/:donorId/extend')
  @ApiOperation({ summary: 'Продлить подписку донорского аккаунта' })
  @ApiResponse({ status: 200, description: 'Подписка продлена' })
  extendSubscription(@Param('donorId') donorId: string, @Body() data: { newEndDate: string }) {
    return this.sharingSystemsService.extendDonorSubscription(Number(donorId), data.newEndDate);
  }

  @Put('client-slot/:slotId/edit')
  @ApiOperation({ summary: 'Редактировать данные клиентского слота' })
  @ApiResponse({ status: 200, description: 'Данные клиента обновлены' })
  async updateClientSlot(
    @Param('slotId') slotId: string,
    @Body()
    body: {
      emailLogin?: string;
      emailPassword?: string;
      accountPassword?: string;
      startDate?: string;
      endDate?: string;
      notes?: string;
    },
  ) {
    return this.sharingSystemsService.updateClientSlotDetails(Number(slotId), body);
  }

  @Get('system/:id/clients')
  @ApiOperation({ summary: 'Получить клиентов системы' })
  @ApiResponse({ status: 200, description: 'Список клиентов системы' })
  async getSystemClients(@Param('id') id: string) {
    return this.sharingSystemsService.getSystemClients(Number(id));
  }

  @Post('assign-donor-client')
  @ApiOperation({ summary: 'Добавить клиента для доступа к донорской консоли' })
  @ApiResponse({ status: 201, description: 'Клиент добавлен к донору' })
  async assignDonorClient(
    @Body()
    data: {
      sharingSystemId: number;
      clientId: number;
      consoleType: SharingConsoleType;
      startDate: string;
      endDate: string;
      notes?: string;
      clientEmailLogin?: string;
      clientEmailPassword?: string;
      clientAccountPassword?: string;
    },
  ) {
    return this.sharingSystemsService.assignDonorClient(data);
  }
}
