import { IsString, IsInt, IsBoolean, IsOptional, IsEnum, IsDateString } from 'class-validator';

export class CreateSharingSystemDto {
  @IsString()
  name: string;

  @IsString()
  donorEmail: string;

  @IsString()
  donorPassword: string;

  @IsEnum(['PS4', 'PS5', 'XBOX_1', 'XBOX_2'])
  donorConsoleType: 'PS4' | 'PS5' | 'XBOX_1' | 'XBOX_2';

  @IsEnum(['PS_PLUS', 'GAME_PASS', 'EA_PLAY'])
  subscriptionType: 'PS_PLUS' | 'GAME_PASS' | 'EA_PLAY';

  @IsEnum(['MONTH', 'THREE_MONTHS', 'YEAR'])
  subscriptionPeriod: 'MONTH' | 'THREE_MONTHS' | 'YEAR';

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  emailLogin?: string;

  @IsOptional()
  @IsString()
  emailPassword?: string;

  @IsOptional()
  @IsString()
  accountPassword?: string;

  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  backupCodes?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
