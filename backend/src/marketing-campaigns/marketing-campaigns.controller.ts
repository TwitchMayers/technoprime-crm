import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role, Tenant } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateMarketingCampaignDto } from './dto/create-marketing-campaign.dto';
import { MarketingCampaignsService } from './marketing-campaigns.service';

@ApiTags('marketing-campaigns')
@ApiBearerAuth()
@Controller('marketing-campaigns')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
export class MarketingCampaignsController {
  constructor(private readonly service: MarketingCampaignsService) {}

  private resolveTenant(req: any): Tenant | undefined {
    return req?.user?.tenant || undefined;
  }

  @Get()
  @ApiOperation({ summary: 'Список рассылок' })
  list(@Req() req: any) {
    return this.service.list(this.resolveTenant(req));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Детали рассылки и логи отправки' })
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.findOne(id, this.resolveTenant(req));
  }

  @Post()
  @UseInterceptors(
    FilesInterceptor('files', 6, {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Создать рассылку' })
  create(
    @Body() body: CreateMarketingCampaignDto,
    @UploadedFiles() files: any[] = [],
    @Req() req: any,
  ) {
    return this.service.create(
      body,
      files,
      this.resolveTenant(req),
      Number(req?.user?.id || 0) || undefined,
    );
  }

  @Post(':id/send')
  @ApiOperation({ summary: 'Поставить рассылку в очередь на отправку' })
  send(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.enqueueSend(id, this.resolveTenant(req), false);
  }

  @Post(':id/repeat')
  @ApiOperation({ summary: 'Повторно отправить рассылку' })
  repeat(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.enqueueSend(id, this.resolveTenant(req), true);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Дублировать рассылку как новую' })
  duplicate(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.duplicate(
      id,
      this.resolveTenant(req),
      Number(req?.user?.id || 0) || undefined,
    );
  }
}
