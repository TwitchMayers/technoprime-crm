import { IsInt, IsEnum, IsDateString, IsOptional, IsString } from 'class-validator';

export class AssignClientSlotDto {
  @IsInt()
  sharingSystemId: number;

  @IsInt()
  clientId: number;

  @IsEnum(['PS4', 'PS5', 'XBOX_1', 'XBOX_2'])
  consoleType: 'PS4' | 'PS5' | 'XBOX_1' | 'XBOX_2';

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsString()
  clientEmailLogin?: string;

  @IsOptional()
  @IsString()
  clientEmailPassword?: string;

  @IsOptional()
  @IsString()
  clientAccountPassword?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
