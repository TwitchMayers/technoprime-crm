import { IsIn, IsOptional, IsString, IsUrl, MaxLength, ValidateIf, Matches } from 'class-validator';

const contactChannels = ['PHONE', 'TELEGRAM', 'VK', 'WEBSITE'] as const;

export class ContactClientDto {
  @IsIn(contactChannels)
  channel: (typeof contactChannels)[number];

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  text?: string;

  @ValidateIf((dto: ContactClientDto) => Boolean(dto.buttonUrl))
  @IsString()
  @MaxLength(80)
  buttonText?: string;

  @ValidateIf((dto: ContactClientDto) => Boolean(dto.buttonText))
  @IsString()
  @IsUrl()
  @Matches(/^https:\/\//i, { message: 'buttonUrl must start with https://' })
  @MaxLength(500)
  buttonUrl?: string;
}
