import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

const channels = ['TELEGRAM', 'VK', 'MAX'] as const;
const audienceTypes = ['ALL', 'ACTIVE_ORDERS', 'SUBSCRIPTIONS', 'REGISTERED_RANGE'] as const;

export class CreateMarketingCampaignDto {
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  message?: string;

  @ValidateIf((dto: CreateMarketingCampaignDto) => Boolean(dto.buttonUrl))
  @IsString()
  @MaxLength(80)
  buttonText?: string;

  @ValidateIf((dto: CreateMarketingCampaignDto) => Boolean(dto.buttonText))
  @IsString()
  @IsUrl()
  @Matches(/^https:\/\//i, { message: 'buttonUrl must start with https://' })
  @MaxLength(500)
  buttonUrl?: string;

  @IsArray()
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : []))
  @ArrayNotEmpty()
  @IsIn(channels, { each: true })
  channels: Array<(typeof channels)[number]>;

  @IsOptional()
  @IsIn(audienceTypes)
  audienceType?: (typeof audienceTypes)[number];

  @IsOptional()
  @IsString()
  registeredFrom?: string;

  @IsOptional()
  @IsString()
  registeredTo?: string;
}
