import { IsString, IsInt, IsBoolean, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { SubscriptionType, SubscriptionPeriod } from '@prisma/client';

export class CreateDonorAccountDto {
  @IsString()
  email: string;

  @IsString()
  password: string;

  @IsEnum(SubscriptionType)
  subscriptionType: SubscriptionType;

  @IsEnum(SubscriptionPeriod)
  subscriptionPeriod: SubscriptionPeriod;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
