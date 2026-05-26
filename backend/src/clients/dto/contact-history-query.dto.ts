import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

const communicationChannels = ['TELEGRAM', 'VK', 'WEBSITE'] as const;

export class ContactHistoryQueryDto {
  @IsOptional()
  @IsIn(communicationChannels)
  channel?: (typeof communicationChannels)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(20)
  @Max(400)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5000)
  offset?: number;
}
