import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('categories')
  categories() {
    return this.inventory.categories();
  }

  @Post()
  create(@Body() dto: CreateInventoryDto) {
    return this.inventory.create(dto);
  }

  @Get('by-serial/:serial')
  findBySerial(@Param('serial') serial: string) {
    return this.inventory.getBySerial(serial);
  }
}