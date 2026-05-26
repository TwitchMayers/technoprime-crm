import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateSharingSystemDto } from './dto/create-sharing-system.dto';
import { AssignClientSlotDto } from './dto/assign-client-slot.dto';
import {
  SubscriptionType,
  SubscriptionPeriod,
  AccountType,
  SubscriptionStatus,
} from '@prisma/client';

type SharingConsoleType = 'PS4' | 'PS5' | 'XBOX_1' | 'XBOX_2';
type SharingSubscriptionType = 'PS_PLUS' | 'GAME_PASS' | 'EA_PLAY';

@Injectable()
export class SharingSystemsService {
  constructor(private prisma: PrismaService) {}

  private isXboxConsoleType(consoleType?: string | null) {
    return consoleType === 'XBOX_1' || consoleType === 'XBOX_2';
  }

  private assertSubscriptionConsoleCompatible(
    subscriptionType: SharingSubscriptionType,
    donorConsoleType: SharingConsoleType,
  ) {
    const xbox = this.isXboxConsoleType(donorConsoleType);

    if (subscriptionType === 'GAME_PASS' && !xbox) {
      throw new BadRequestException('Game Pass можно создавать только для Xbox #1 или Xbox #2');
    }

    if (subscriptionType !== 'GAME_PASS' && xbox) {
      throw new BadRequestException('PS Plus и EA Play можно создавать только для PS5 или PS4');
    }
  }

  private getSlotStats(
    donorConsoleType: string,
    activeClientSlots: Array<{ consoleType: string; isActive?: boolean }>,
  ) {
    const xbox = this.isXboxConsoleType(donorConsoleType);
    const ps5Count = activeClientSlots.filter(slot => slot.consoleType === 'PS5').length;
    const ps4Count = activeClientSlots.filter(slot => slot.consoleType === 'PS4').length;
    const xbox1Count = activeClientSlots.filter(slot => slot.consoleType === 'XBOX_1').length;
    const xbox2Count = activeClientSlots.filter(slot => slot.consoleType === 'XBOX_2').length;

    const maxPs5Slots = xbox ? 0 : donorConsoleType === 'PS5' ? 2 : 1;
    const maxPs4Slots = xbox ? 0 : donorConsoleType === 'PS5' ? 1 : 2;
    const maxXbox1Slots = xbox ? 1 : 0;
    const maxXbox2Slots = xbox ? 1 : 0;
    const totalSlots = xbox ? 2 : 3;
    const totalUsedSlots = xbox ? xbox1Count + xbox2Count : ps5Count + ps4Count;
    const availableSlots = Math.max(0, totalSlots - totalUsedSlots);

    return {
      totalSlots,
      totalUsedSlots,
      availableSlots,
      isXbox: xbox,
      slotStats: {
        ps5: { used: ps5Count, max: maxPs5Slots, available: Math.max(0, maxPs5Slots - ps5Count) },
        ps4: { used: ps4Count, max: maxPs4Slots, available: Math.max(0, maxPs4Slots - ps4Count) },
        xbox1: {
          used: xbox1Count,
          max: maxXbox1Slots,
          available: Math.max(0, maxXbox1Slots - xbox1Count),
        },
        xbox2: {
          used: xbox2Count,
          max: maxXbox2Slots,
          available: Math.max(0, maxXbox2Slots - xbox2Count),
        },
      },
    };
  }

  private assertSlotCompatible(
    donorConsoleType: string,
    requestedConsoleType: SharingConsoleType,
    activeClientSlots: Array<{ consoleType: string; isActive?: boolean }>,
  ) {
    const stats = this.getSlotStats(donorConsoleType, activeClientSlots);
    const slotKey =
      requestedConsoleType === 'PS5'
        ? 'ps5'
        : requestedConsoleType === 'PS4'
          ? 'ps4'
          : requestedConsoleType === 'XBOX_1'
            ? 'xbox1'
            : 'xbox2';
    const label =
      requestedConsoleType === 'XBOX_1'
        ? 'Xbox #1'
        : requestedConsoleType === 'XBOX_2'
          ? 'Xbox #2'
          : requestedConsoleType;
    const available = stats.slotStats[slotKey].available;

    if (stats.isXbox && !this.isXboxConsoleType(requestedConsoleType)) {
      throw new BadRequestException('Для Xbox-системы доступны только слоты Xbox #1 и Xbox #2');
    }
    if (!stats.isXbox && this.isXboxConsoleType(requestedConsoleType)) {
      throw new BadRequestException('Xbox-слоты доступны только в Xbox-системах шеринга');
    }
    if (available <= 0) {
      throw new BadRequestException(`Слот ${label} уже занят`);
    }

    return stats;
  }

  private resolveSharingAccessWindow(input: {
    donorStartDate: Date;
    donorEndDate: Date;
    requestedStartDate?: string;
    requestedEndDate?: string;
  }) {
    const donorStartDate = new Date(input.donorStartDate);
    const donorEndDate = new Date(input.donorEndDate);
    const now = new Date();

    let startDate = input.requestedStartDate ? new Date(input.requestedStartDate) : now;
    if (Number.isNaN(startDate.getTime())) {
      startDate = now;
    }
    if (startDate < donorStartDate) {
      startDate = donorStartDate;
    }
    if (startDate > donorEndDate) {
      throw new BadRequestException('Срок донора истек. Нельзя назначить клиента в эту систему.');
    }

    let endDate = input.requestedEndDate ? new Date(input.requestedEndDate) : donorEndDate;
    if (Number.isNaN(endDate.getTime())) {
      endDate = donorEndDate;
    }
    if (endDate > donorEndDate) {
      endDate = donorEndDate;
    }
    if (endDate < startDate) {
      endDate = donorEndDate;
    }

    return { startDate, endDate };
  }

  async createSharingSystem(data: CreateSharingSystemDto) {
    try {
      this.assertSubscriptionConsoleCompatible(data.subscriptionType, data.donorConsoleType);

      const existingDonor = await this.prisma.donorAccount.findUnique({
        where: {
          tenant_email: {
            tenant: 'TECHNOPRIME',
            email: data.donorEmail,
          },
        },
      });

      if (existingDonor) {
        throw new BadRequestException('Донорский аккаунт с таким email уже существует');
      }

      return await this.prisma.$transaction(async tx => {
        const donor = await tx.donorAccount.create({
          data: {
            tenant: 'TECHNOPRIME',
            email: data.donorEmail,
            password: data.donorPassword,
            consoleType: data.donorConsoleType,
            subscriptionType: data.subscriptionType,
            subscriptionPeriod: data.subscriptionPeriod,
            startDate: new Date(data.startDate),
            endDate: new Date(data.endDate),
            region: data.region || '🇺🇦 Украина',
            emailLogin: data.emailLogin,
            emailPassword: data.emailPassword,
            accountPassword: data.accountPassword,
            dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
            backupCodes: data.backupCodes,
            notes: data.notes,
            isActive: true,
          },
        });

        const sharingSystem = await tx.sharingSystem.create({
          data: {
            tenant: 'TECHNOPRIME',
            name: data.name,
            donorAccountId: donor.id,
            totalSlots: this.isXboxConsoleType(data.donorConsoleType) ? 2 : 3,
            availableSlots: this.isXboxConsoleType(data.donorConsoleType) ? 2 : 3,
            isActive: true,
          },
          include: {
            donor: true,
            clientSlots: true,
          },
        });

        return sharingSystem;
      });
    } catch (error) {
      console.error('Error creating sharing system:', error);
      throw error;
    }
  }

  async listSharingSystems(filters?: {
    isActive?: boolean;
    withAvailableSlots?: boolean;
    consoleType?: SharingConsoleType;
  }) {
    try {
      const where: any = { tenant: 'TECHNOPRIME' };
      if (filters?.isActive !== undefined) where.isActive = filters.isActive;

      const systems = await this.prisma.sharingSystem.findMany({
        where,
        include: {
          donor: true,
          clientSlots: {
            where: { isActive: true },
            include: { client: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const systemsWithStats = systems.map(system => {
        const donorConsoleType = system.donor.consoleType;
        const activeClientSlots = system.clientSlots.filter(slot => slot.isActive);

        const slotSummary = this.getSlotStats(donorConsoleType, activeClientSlots);

        const daysLeft = Math.ceil(
          (new Date(system.donor.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        );

        return {
          ...system,
          usedSlots: slotSummary.totalUsedSlots,
          availableSlots: slotSummary.availableSlots,
          totalSlots: slotSummary.totalSlots,
          daysLeft,
          isExpired: daysLeft <= 0,
          isExpiringSoon: daysLeft > 0 && daysLeft <= 30,
          slotStats: slotSummary.slotStats,
        };
      });

      let filteredSystems = systemsWithStats;
      if (filters?.withAvailableSlots) {
        filteredSystems = systemsWithStats.filter(system => system.availableSlots > 0);
      }
      if (filters?.consoleType) {
        filteredSystems = filteredSystems.filter(system =>
          this.isXboxConsoleType(filters.consoleType)
            ? this.isXboxConsoleType(system.donor.consoleType)
            : system.donor.consoleType === filters.consoleType,
        );
      }

      return filteredSystems;
    } catch (error) {
      console.error('Error listing sharing systems:', error);
      return [];
    }
  }

  async getSharingSystem(id: number) {
    const system = await this.prisma.sharingSystem.findUnique({
      where: { id },
      include: {
        donor: true,
        clientSlots: {
          include: {
            client: true,
            subscription: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!system) throw new NotFoundException('Система шеринга не найдена');

    const donorConsoleType = system.donor.consoleType;
    const activeClientSlots = system.clientSlots.filter(slot => slot.isActive);

    const slotSummary = this.getSlotStats(donorConsoleType, activeClientSlots);

    const daysLeft = Math.ceil(
      (new Date(system.donor.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );

    return {
      ...system,
      usedSlots: slotSummary.totalUsedSlots,
      availableSlots: slotSummary.availableSlots,
      totalSlots: slotSummary.totalSlots,
      daysLeft,
      isExpired: daysLeft <= 0,
      isExpiringSoon: daysLeft > 0 && daysLeft <= 30,
      slotStats: slotSummary.slotStats,
    };
  }

  async deleteSharingSystem(id: number) {
    const system = await this.prisma.sharingSystem.findUnique({
      where: { id },
      include: {
        donor: true,
        clientSlots: true,
      },
    });

    if (!system) throw new NotFoundException('Система шеринга не найдена');

    const activeClientSlots = system.clientSlots.filter(
      slot => slot.isActive && slot.clientId !== null,
    );
    if (activeClientSlots.length > 0) {
      throw new BadRequestException(
        `Невозможно удалить систему. К ней привязано ${activeClientSlots.length} активных клиент(ов). Сначала отвяжите активные слоты.`,
      );
    }

    return this.prisma.$transaction(async tx => {
      // Удаляем подписки, привязанные к этой системе (включая исторические).
      await tx.subscription.deleteMany({
        where: {
          OR: [
            { donorAccountId: system.donor.id },
            {
              clientSlot: {
                sharingSystemId: id,
              },
            },
          ],
        },
      });

      // Удаляем систему шеринга
      await tx.sharingSystem.delete({ where: { id } });

      // Удаляем донорский аккаунт
      await tx.donorAccount.delete({ where: { id: system.donor.id } });

      return { message: 'Система шеринга успешно удалена' };
    });
  }

  async updateDonorDetails(
    donorId: number,
    data: {
      email?: string;
      password?: string;
      region?: string;
      emailLogin?: string;
      emailPassword?: string;
      accountPassword?: string;
      dateOfBirth?: string;
      backupCodes?: string;
      notes?: string;
    },
  ) {
    const donor = await this.prisma.donorAccount.findUnique({
      where: { id: donorId },
    });

    if (!donor) throw new NotFoundException('Донорский аккаунт не найден');

    const updateData: any = { ...data };
    if (data.dateOfBirth) updateData.dateOfBirth = new Date(data.dateOfBirth);

    return this.prisma.donorAccount.update({
      where: { id: donorId },
      data: updateData,
    });
  }

  async assignClientToSlot(data: AssignClientSlotDto) {
    const system = await this.prisma.sharingSystem.findUnique({
      where: { id: data.sharingSystemId },
      include: {
        donor: true,
        clientSlots: {
          where: { isActive: true },
        },
      },
    });

    if (!system) throw new NotFoundException('Система шеринга не найдена');

    this.assertSlotCompatible(system.donor.consoleType, data.consoleType, system.clientSlots);

    // ✅ ПРОВЕРКА 1: клиент не должен быть добавлен ни в одну систему шеринга
    const existingClientSlot = await this.prisma.clientSlot.findFirst({
      where: {
        clientId: data.clientId,
        isActive: true,
      },
    });

    if (existingClientSlot) {
      throw new BadRequestException(
        `Клиент уже подключен к другой системе шеринга (${existingClientSlot.consoleType})`,
      );
    }

    // ✅ ПРОВЕРКА 2: проверяем что клиент уже не добавлен в эту систему с этой консолью
    const duplicateSlot = await this.prisma.clientSlot.findFirst({
      where: {
        AND: [
          { sharingSystemId: data.sharingSystemId },
          { clientId: data.clientId },
          { consoleType: data.consoleType },
          { isActive: true },
        ],
      },
    });

    if (duplicateSlot) {
      throw new BadRequestException(
        `Этот клиент уже подключен к ${data.consoleType} в этой системе`,
      );
    }

    const accessWindow = this.resolveSharingAccessWindow({
      donorStartDate: system.donor.startDate,
      donorEndDate: system.donor.endDate,
      requestedStartDate: data.startDate,
      requestedEndDate: data.endDate,
    });
    const xboxDonorSlot = data.consoleType === 'XBOX_1';
    const xboxPersonalSlot = data.consoleType === 'XBOX_2';

    if (xboxPersonalSlot && (!data.clientEmailLogin || !data.clientEmailPassword)) {
      throw new BadRequestException('Для Xbox #2 укажите логин и пароль личного аккаунта клиента');
    }

    const clientSlot = await this.prisma.clientSlot.create({
      data: {
        sharingSystemId: data.sharingSystemId,
        clientId: data.clientId,
        consoleType: data.consoleType,
        emailLogin: xboxDonorSlot ? null : data.clientEmailLogin,
        emailPassword: xboxDonorSlot ? null : data.clientEmailPassword,
        accountPassword: xboxDonorSlot ? null : data.clientAccountPassword,
        startDate: accessWindow.startDate,
        endDate: accessWindow.endDate,
        isActive: true,
        notes: xboxDonorSlot
          ? [
              data.notes,
              'Xbox #1: клиент играет с донорского аккаунта, дополнительные данные не нужны.',
            ]
              .filter(Boolean)
              .join('\n')
          : data.notes,
      },
    });

    await this.prisma.subscription.create({
      data: {
        tenant: 'TECHNOPRIME',
        clientId: data.clientId,
        type: system.donor.subscriptionType,
        startDate: accessWindow.startDate,
        endDate: accessWindow.endDate,
        status: SubscriptionStatus.ACTIVE,
        accountType: AccountType.SHARING_CLIENT,
        subscriptionPeriod: system.donor.subscriptionPeriod,
        clientSlotId: clientSlot.id,
        donorAccountId: system.donor.id,
      },
    });

    return {
      ...clientSlot,
      client: await this.prisma.client.findUnique({
        where: { id: data.clientId },
      }),
    };
  }

  async removeClientFromSlot(slotId: number) {
    const slot = await this.prisma.clientSlot.findUnique({
      where: { id: slotId },
      include: {
        subscription: true,
        client: true,
      },
    });

    if (!slot) throw new NotFoundException('Слот не найден');

    return this.prisma.$transaction(async tx => {
      // ✅ НОВОЕ: удаляем ВСЕ подписки этого клиента в этой системе
      // (может быть несколько если клиент подключен к PS5 и PS4)
      await tx.subscription.deleteMany({
        where: {
          clientSlotId: slotId,
        },
      });

      // ✅ Удаляем слот
      const deletedSlot = await tx.clientSlot.delete({
        where: { id: slotId },
      });

      return {
        success: true,
        message: `Клиент отвязан от системы`,
        deletedSlot,
      };
    });
  }

  async getSharingSystemStats() {
    const systems = await this.listSharingSystems();

    const totalSystems = systems.length;
    const activeSystems = systems.filter(s => s.isActive).length;
    const expiredSystems = systems.filter(s => s.isExpired).length;
    const totalUsedSlots = systems.reduce((sum, system) => sum + system.usedSlots, 0);
    const totalAvailableSlots = systems.reduce((sum, system) => sum + system.availableSlots, 0);

    const ps4Systems = systems.filter(s => s.donor.consoleType === 'PS4').length;
    const ps5Systems = systems.filter(s => s.donor.consoleType === 'PS5').length;
    const xboxSystems = systems.filter(s => this.isXboxConsoleType(s.donor.consoleType)).length;

    const totalCapacity = systems.reduce((sum, system) => sum + Number(system.totalSlots || 0), 0);
    const utilizationRate =
      systems.length > 0 ? Math.round((totalUsedSlots / Math.max(1, totalCapacity)) * 100) : 0;

    return {
      totalSystems,
      activeSystems,
      expiredSystems,
      totalUsedSlots,
      totalAvailableSlots,
      ps4Systems,
      ps5Systems,
      xboxSystems,
      utilizationRate: utilizationRate.toString(),
    };
  }

  async searchClients(query: string, sharingSystemId?: number) {
    try {
      const clients = await this.prisma.client.findMany({
        where: {
          tenant: 'TECHNOPRIME',
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query, mode: 'insensitive' } },
          ],
        },
        include: {
          clientSlots: {
            where: { isActive: true }, // ✅ Только активные слоты
          },
        },
        take: 50,
        orderBy: { createdAt: 'desc' },
      });

      // ✅ ИСПРАВЛЕНО: фильтруем корректно
      const availableClients = clients.filter(client => {
        // Исключаем клиентов с активными слотами в любой системе
        const hasActiveSlots = client.clientSlots && client.clientSlots.length > 0;
        return !hasActiveSlots; // Возвращаем ТОЛЬКО доступных
      });

      return availableClients;
    } catch (error) {
      console.error('Error searching clients:', error);
      return [];
    }
  }

  async extendDonorSubscription(donorId: number, newEndDate: string) {
    const donor = await this.prisma.donorAccount.findUnique({
      where: { id: donorId },
    });

    if (!donor) throw new NotFoundException('Донорский аккаунт не найден');

    return this.prisma.donorAccount.update({
      where: { id: donorId },
      data: {
        endDate: new Date(newEndDate),
      },
    });
  }

  async assignDonorClient(data: {
    sharingSystemId: number;
    clientId: number;
    consoleType: SharingConsoleType;
    startDate: string;
    endDate: string;
    notes?: string;
    clientEmailLogin?: string;
    clientEmailPassword?: string;
    clientAccountPassword?: string;
  }) {
    const system = await this.prisma.sharingSystem.findUnique({
      where: { id: data.sharingSystemId },
      include: { donor: true },
    });

    if (!system) {
      throw new NotFoundException('Система шеринга не найдена');
    }

    // Проверяем, что консоль донора совпадает
    if (system.donor.consoleType !== data.consoleType) {
      throw new BadRequestException(
        `Консоль клиента (${data.consoleType}) должна совпадать с консолью донора (${system.donor.consoleType})`,
      );
    }

    // ✅ ПРОВЕРКА: клиент не должен быть добавлен ни в одну систему шеринга
    const existingClientSlot = await this.prisma.clientSlot.findFirst({
      where: {
        clientId: data.clientId,
        isActive: true,
      },
    });

    if (existingClientSlot) {
      throw new BadRequestException(
        `Клиент уже подключен к другой системе шеринга. Один клиент может быть подключен только к одной системе.`,
      );
    }

    // ✅ ПРОВЕРКА: такой же донорский слот в этой системе
    const existingDonorAccess = await this.prisma.clientSlot.findFirst({
      where: {
        sharingSystemId: data.sharingSystemId,
        clientId: data.clientId,
        consoleType: data.consoleType,
        isActive: true,
      },
    });

    if (existingDonorAccess) {
      throw new BadRequestException(
        'Этот клиент уже имеет доступ к донорской консоли этой системы',
      );
    }

    const accessWindow = this.resolveSharingAccessWindow({
      donorStartDate: system.donor.startDate,
      donorEndDate: system.donor.endDate,
      requestedStartDate: data.startDate,
      requestedEndDate: data.endDate,
    });

    const clientSlot = await this.prisma.clientSlot.create({
      data: {
        sharingSystemId: data.sharingSystemId,
        clientId: data.clientId,
        consoleType: data.consoleType,
        emailLogin: data.clientEmailLogin,
        emailPassword: data.clientEmailPassword,
        accountPassword: data.clientAccountPassword,
        startDate: accessWindow.startDate,
        endDate: accessWindow.endDate,
        isActive: true,
        notes: data.notes || 'Вход через QR для донорской консоли',
      },
    });

    await this.prisma.subscription.create({
      data: {
        tenant: 'TECHNOPRIME',
        clientId: data.clientId,
        type: system.donor.subscriptionType,
        startDate: accessWindow.startDate,
        endDate: accessWindow.endDate,
        status: SubscriptionStatus.ACTIVE,
        accountType: AccountType.SHARING_CLIENT,
        subscriptionPeriod: system.donor.subscriptionPeriod,
        clientSlotId: clientSlot.id,
        donorAccountId: system.donor.id,
      },
    });

    return clientSlot;
  }

  async updateClientSlotDetails(
    slotId: number,
    data: {
      emailLogin?: string;
      emailPassword?: string;
      accountPassword?: string;
      notes?: string;
    },
  ) {
    const slot = await this.prisma.clientSlot.findUnique({
      where: { id: slotId },
    });

    if (!slot) throw new NotFoundException('Слот клиента не найден');

    return this.prisma.clientSlot.update({
      where: { id: slotId },
      data: {
        emailLogin: data.emailLogin ?? slot.emailLogin,
        emailPassword: data.emailPassword ?? slot.emailPassword,
        accountPassword: data.accountPassword ?? slot.accountPassword,
        notes: data.notes ?? slot.notes,
      },
      include: { client: true },
    });
  }

  async getSystemClients(sharingSystemId: number) {
    const system = await this.prisma.sharingSystem.findUnique({
      where: { id: sharingSystemId },
      include: {
        donor: true,
        clientSlots: {
          where: { isActive: true },
          include: { client: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!system) throw new NotFoundException('Система шеринга не найдена');

    return {
      donor: {
        id: system.donor.id,
        name: system.donor.email,
        email: system.donor.email,
        consoleType: system.donor.consoleType,
        isDonor: true,
        emailLogin: system.donor.emailLogin,
        emailPassword: system.donor.emailPassword,
        accountPassword: system.donor.accountPassword,
      },
      clients: system.clientSlots
        .filter(slot => slot.client)
        .map(slot => ({
          slotId: slot.id,
          id: slot.client.id,
          name: slot.client.name,
          phone: slot.client.phone,
          consoleType: slot.consoleType,
          isDonor: false,
          emailLogin: slot.emailLogin,
          emailPassword: slot.emailPassword,
          accountPassword: slot.accountPassword,
          startDate: slot.startDate,
          endDate: slot.endDate,
          notes: slot.notes,
        })),
    };
  }
}
