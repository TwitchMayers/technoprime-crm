import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateClientDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsString()
  @MinLength(10)
  @MaxLength(20)
  phone: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  consoleType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  emailLogin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  emailPassword?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  accountPassword?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  telegramId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  vkId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  maxId?: string;

  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;
}
