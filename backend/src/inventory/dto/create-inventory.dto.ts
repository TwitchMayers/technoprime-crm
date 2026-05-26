import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { ProductCategory } from '@prisma/client';

export class CreateInventoryDto {
  @IsString()
  @IsOptional()
  serialNumber?: string;

  @IsNumber()
  @IsOptional()
  productId?: number;

  @IsString()
  @IsOptional()
  name?: string;

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
  purchasePrice?: number;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  version?: string;

  @IsNumber()
  @IsOptional()
  memoryGb?: number;

  @IsString()
  @IsOptional()
  variantKey?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
