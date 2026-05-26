import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { ProductCategory } from '@prisma/client';

export class CreateInventoryDto {
  @IsString()
  serialNumber!: string;

  @IsString()
  @IsOptional()
  brand?: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsEnum(ProductCategory)
  @IsOptional()
  category?: ProductCategory;

  @IsNumber()
  @IsOptional()
  purchasePrice?: number; // пока не пишем в БД, просто принимаем

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
