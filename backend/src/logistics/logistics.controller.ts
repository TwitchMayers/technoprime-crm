import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { LogisticsService } from './logistics.service';

@Controller('logistics')
@UseGuards(JwtAuthGuard)
export class LogisticsController {
  constructor(private readonly logistics: LogisticsService) {}

  @Get('shipments')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  listShipments(@Query() query: any) {
    return this.logistics.listShipments(query);
  }

  @Get('shipments/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  getShipment(@Param('id') id: string) {
    return this.logistics.getShipment(Number(id));
  }

  @Post('resolve-shipment')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  resolveShipment(@Body() body: any, @Req() req: any) {
    return this.logistics.resolveShipmentByReference(body, req.user);
  }

  @Post('orders/:orderId/shipment')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  upsertShipment(@Param('orderId') orderId: string, @Body() body: any, @Req() req: any) {
    return this.logistics.upsertShipmentForOrder(orderId, body, Number(req?.user?.id || 0));
  }

  @Patch('shipments/:id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  updateShipmentStatus(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.logistics.updateShipmentStatus(Number(id), body, Number(req?.user?.id || 0));
  }

  @Post('shipments/:id/funds-received')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  markFundsReceived(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.logistics.markFundsReceived(Number(id), body, Number(req?.user?.id || 0));
  }

  @Post('orders/:orderId/link-token')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  createOrderLinkToken(@Param('orderId') orderId: string, @Req() req: any) {
    return this.logistics.createOrderLinkToken(orderId, Number(req?.user?.id || 0));
  }

  @Get('marketplace-accounts')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  listMarketplaceAccounts() {
    return this.logistics.listMarketplaceAccounts();
  }

  @Get('marketplace-accounts/overview')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  listMarketplaceOverview() {
    return this.logistics.listMarketplaceOverview();
  }

  @Get('marketplace-accounts/avito/connected')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  listConnectedAvitoAccounts() {
    return this.logistics.listConnectedAvitoAccounts();
  }

  @Get('marketplace-accounts/:id/avito/chats')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  listAvitoChats(@Param('id') id: string, @Query() query: any, @Req() req: any) {
    return this.logistics.listAvitoChats(Number(id), query, req.user);
  }

  @Get('marketplace-accounts/:id/avito/pins')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  listPinnedAvitoChats(@Param('id') id: string, @Req() req: any) {
    return this.logistics.listPinnedAvitoChats(Number(id), req.user);
  }

  @Get('marketplace-accounts/:id/avito/chats/:chatId/messages')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  listAvitoChatMessages(
    @Param('id') id: string,
    @Param('chatId') chatId: string,
    @Query() query: any,
    @Req() req: any,
  ) {
    return this.logistics.listAvitoChatMessages(Number(id), chatId, query, req.user);
  }

  @Post('marketplace-accounts/:id/avito/chats/:chatId/messages')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @UseInterceptors(
    FilesInterceptor('image', 1, {
      limits: { fileSize: 24 * 1024 * 1024 },
    }),
  )
  sendAvitoChatMessage(
    @Param('id') id: string,
    @Param('chatId') chatId: string,
    @Body() body: any,
    @UploadedFiles() files: any[] = [],
    @Req() req: any,
  ) {
    return this.logistics.sendAvitoChatMessage(Number(id), chatId, body, files, req.user);
  }

  @Delete('marketplace-accounts/:id/avito/chats/:chatId/messages/:messageId')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  deleteAvitoChatMessage(
    @Param('id') id: string,
    @Param('chatId') chatId: string,
    @Param('messageId') messageId: string,
    @Req() req: any,
  ) {
    return this.logistics.deleteAvitoChatMessage(Number(id), chatId, messageId, req.user);
  }

  @Post('marketplace-accounts/:id/avito/chats/:chatId/pin')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  pinAvitoChat(@Param('id') id: string, @Param('chatId') chatId: string, @Req() req: any) {
    return this.logistics.pinAvitoChat(Number(id), chatId, req.user);
  }

  @Delete('marketplace-accounts/:id/avito/chats/:chatId/pin')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  unpinAvitoChat(@Param('id') id: string, @Param('chatId') chatId: string, @Req() req: any) {
    return this.logistics.unpinAvitoChat(Number(id), chatId, req.user);
  }

  @Post('marketplace-accounts/:id/sync')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  syncMarketplaceAccount(@Param('id') id: string, @Req() req: any) {
    return this.logistics.syncMarketplaceAccount(Number(id), req.user);
  }

  @Post('marketplace-accounts')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  createMarketplaceAccount(@Body() body: any, @Req() req: any) {
    return this.logistics.createMarketplaceAccount(body, req.user);
  }

  @Patch('marketplace-accounts/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  updateMarketplaceAccount(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.logistics.updateMarketplaceAccount(Number(id), body, req.user);
  }

  @Delete('marketplace-accounts/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  disconnectMarketplaceAccount(@Param('id') id: string, @Req() req: any) {
    return this.logistics.disconnectMarketplaceAccount(Number(id), req.user);
  }
}
