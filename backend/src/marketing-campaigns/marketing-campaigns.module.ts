import { Module } from '@nestjs/common';
import { CommunicationModule } from '../communication/communication.module';
import { PrismaService } from '../prisma.service';
import { MarketingCampaignsController } from './marketing-campaigns.controller';
import { MarketingCampaignsService } from './marketing-campaigns.service';

@Module({
  imports: [CommunicationModule],
  controllers: [MarketingCampaignsController],
  providers: [MarketingCampaignsService, PrismaService],
  exports: [MarketingCampaignsService],
})
export class MarketingCampaignsModule {}
