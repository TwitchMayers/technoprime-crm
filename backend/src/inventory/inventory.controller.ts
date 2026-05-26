import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('categories')
  categories() {
    return this.inventory.categories();
  }

  @Get()
  list(@Query() query: any) {
    return this.inventory.list(query);
  }

  @Post()
  create(@Body() dto: CreateInventoryDto) {
    return this.inventory.create(dto);
  }

  @Get('by-serial/:serial')
  findBySerial(@Param('serial') serial: string) {
    return this.inventory.getBySerial(serial);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.inventory.remove(Number(id));
  }
}
