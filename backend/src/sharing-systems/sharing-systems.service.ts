import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateSharingSystemDto } from './dto/create-sharing-system.dto';
import { AssignClientSlotDto } from './dto/assign-client-slot.dto';
import { 
  ConsoleType, 
  SubscriptionType, 
  SubscriptionPeriod, 
  AccountType, 
  SubscriptionStatus 
} from '@prisma/client';

@Injectable()
export class SharingSystemsService {
  constructor(private prisma: PrismaService) {}

  async createSharingSystem(data: CreateSharingSystemDto) {
    try {
      const existingDonor = await this.prisma.donorAccount.findUnique({
        where: { 
          tenant_email: {
            tenant: 'TECHNOPRIME',
            email: data.donorEmail
          }
        },
      });

      if (existingDonor) {
        throw new BadRequestException('Донорский аккаунт с таким email уже существует');
      }

      return await this.prisma.$transaction(async (tx) => {
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
            totalSlots: 3,  // ✅ 3 КЛИЕНТСКИХ СЛОТА
            availableSlots: 3,  // ✅ ВСЕ СВОБОДНЫ
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
    consoleType?: 'PS4' | 'PS5';
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

        // ✅ МАКСИМУМ 3 КЛИЕНТА:
        // - Если донор PS5: max 2 PS5 клиента + 1 PS4 клиент
        // - Если донор PS4: max 1 PS5 клиент + 2 PS4 клиента
        let maxPs5Slots = 1;
        let maxPs4Slots = 1;
        
        if (donorConsoleType === 'PS5') {
          maxPs5Slots = 2; // 2 клиента на PS5
          maxPs4Slots = 1; // 1 клиент на PS4
        } else {
          maxPs5Slots = 1; // 1 клиент на PS5
          maxPs4Slots = 2; // 2 клиента на PS4
        }

        // Считаем занятые КЛИЕНТСКИЕ слоты
        const ps5Count = activeClientSlots.filter(slot => slot.consoleType === 'PS5').length;
        const ps4Count = activeClientSlots.filter(slot => slot.consoleType === 'PS4').length;

        // ✅ ИТОГО: ТОЛЬКО клиентские слоты (БЕЗ +1 для донора)
        const totalUsedSlots = ps5Count + ps4Count;
        const totalSlots = 3; // ВСЕГДА 3
        const availableSlots = totalSlots - totalUsedSlots;

        const daysLeft = Math.ceil((new Date(system.donor.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

        return {
          ...system,
          usedSlots: totalUsedSlots,
          availableSlots,
          totalSlots,
          daysLeft,
          isExpired: daysLeft <= 0,
          isExpiringSoon: daysLeft > 0 && daysLeft <= 30,
          slotStats: {
            ps5: { used: ps5Count, max: maxPs5Slots, available: maxPs5Slots - ps5Count },
            ps4: { used: ps4Count, max: maxPs4Slots, available: maxPs4Slots - ps4Count },
          },
        };
      });

      let filteredSystems = systemsWithStats;
      if (filters?.withAvailableSlots) {
        filteredSystems = systemsWithStats.filter(system => system.availableSlots > 0);
      }
      if (filters?.consoleType) {
        filteredSystems = filteredSystems.filter(system => system.donor.consoleType === filters.consoleType);
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

    // ✅ Максимум 3 клиента
    let maxPs5Slots = 1;
    let maxPs4Slots = 1;
    
    if (donorConsoleType === 'PS5') {
      maxPs5Slots = 2; // 2 на PS5
      maxPs4Slots = 1; // 1 на PS4
    } else {
      maxPs5Slots = 1; // 1 на PS5
      maxPs4Slots = 2; // 2 на PS4
    }

    // Считаем занятые слоты
    const ps5Slots = activeClientSlots.filter(slot => slot.consoleType === 'PS5');
    const ps4Slots = activeClientSlots.filter(slot => slot.consoleType === 'PS4');

    // ✅ ИТОГО: ТОЛЬКО клиентские
    const totalUsedSlots = ps5Slots.length + ps4Slots.length;
    const totalSlots = 3; // ВСЕГДА 3
    const availableSlots = totalSlots - totalUsedSlots;

    const daysLeft = Math.ceil((new Date(system.donor.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    return {
      ...system,
      usedSlots: totalUsedSlots,
      availableSlots,
      totalSlots,
      daysLeft,
      isExpired: daysLeft <= 0,
      isExpiringSoon: daysLeft > 0 && daysLeft <= 30,
      slotStats: {
        ps5: { 
          used: ps5Slots.length, 
          max: maxPs5Slots, 
          available: maxPs5Slots - ps5Slots.length 
        },
        ps4: { 
          used: ps4Slots.length, 
          max: maxPs4Slots, 
          available: maxPs4Slots - ps4Slots.length 
        },
      },
    };
  }

  async deleteSharingSystem(id: number) {
    const system = await this.prisma.sharingSystem.findUnique({
      where: { id },
      include: {  
        donor: true,
        clientSlots: true, // ✅ Все слоты (активные и неактивные)
      },
    });

    if (!system) throw new NotFoundException('Система шеринга не найдена');
    
    // ✅ ИСПРАВЛЕНО: проверяем ВСЕ слоты, не только активные
    if (system.clientSlots.length > 0) {
      throw new BadRequestException(
        `Невозможно удалить систему. К ней привязано ${system.clientSlots.length} клиент(ов). Сначала отвяжите всех клиентов.`
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // ✅ НОВОЕ: удаляем orphaned подписки системы (на случай если есть)
      await tx.subscription.deleteMany({
        where: {
          donorAccountId: system.donor.id,
        },
      });

      // Удаляем систему шеринга
      await tx.sharingSystem.delete({ where: { id } });
      
      // Удаляем донорский аккаунт
      await tx.donorAccount.delete({ where: { id: system.donor.id } });
      
      console.log(`✅ Система шеринга #${id} удалена вместе с донором`);

      return { message: 'Система шеринга успешно удалена' };
    });
  }

  async updateDonorDetails(donorId: number, data: {
    email?: string;
    password?: string;
    region?: string;
    emailLogin?: string;
    emailPassword?: string;
    accountPassword?: string;
    dateOfBirth?: string;
    backupCodes?: string;
    notes?: string;
  }) {
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

    const donorConsoleType = system.donor.consoleType;
    
    // ✅ Максимум 3 клиента
    let maxPs5Slots = 1;
    let maxPs4Slots = 1;
    
    if (donorConsoleType === 'PS5') {
      maxPs5Slots = 2;
      maxPs4Slots = 1;
    } else {
      maxPs5Slots = 1;
      maxPs4Slots = 2;
    }

    const ps5Slots = system.clientSlots.filter(slot => slot.consoleType === 'PS5');
    const ps4Slots = system.clientSlots.filter(slot => slot.consoleType === 'PS4');

    // ✅ Проверяем лимиты для выбранного типа консоли
    if (data.consoleType === 'PS5') {
      if (ps5Slots.length >= maxPs5Slots) {
        throw new BadRequestException(
          `Все слоты PS5 заняты (${ps5Slots.length}/${maxPs5Slots}). Попробуйте PS4 слоты: ${maxPs4Slots - ps4Slots.length} свободно`
        );
      }
    } else {
      if (ps4Slots.length >= maxPs4Slots) {
        throw new BadRequestException(
          `Все слоты PS4 заняты (${ps4Slots.length}/${maxPs4Slots}). Попробуйте PS5 слоты: ${maxPs5Slots - ps5Slots.length} свободно`
        );
      }
    }

    // ✅ ПРОВЕРКА 1: клиент не должен быть добавлен ни в одну систему шеринга
    const existingClientSlot = await this.prisma.clientSlot.findFirst({
      where: {
        clientId: data.clientId,
        isActive: true,
      },
    });

    if (existingClientSlot) {
      throw new BadRequestException(
        `Клиент уже подключен к другой системе шеринга (${existingClientSlot.consoleType})`
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
        ]
      },
    });

    if (duplicateSlot) {
      throw new BadRequestException(
        `Этот клиент уже подключен к ${data.consoleType} в этой системе`
      );
    }

    const clientSlot = await this.prisma.clientSlot.create({
      data: {
        sharingSystemId: data.sharingSystemId,
        clientId: data.clientId,
        consoleType: data.consoleType,
        emailLogin: data.clientEmailLogin,
        emailPassword: data.clientEmailPassword,
        accountPassword: data.clientAccountPassword,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        isActive: true,
        notes: data.notes,
      },
    });

    await this.prisma.subscription.create({
      data: {
        tenant: 'TECHNOPRIME',
        clientId: data.clientId,
        type: system.donor.subscriptionType,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        status: SubscriptionStatus.ACTIVE,
        accountType: AccountType.SHARING_CLIENT,
        subscriptionPeriod: SubscriptionPeriod.MONTH,
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

    return this.prisma.$transaction(async (tx) => {
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

      console.log(`✅ Клиент ${slot.client?.name} отвязан от системы (слот #${slotId})`);

      return { 
        success: true, 
        message: `Клиент отвязан от системы`,
        deletedSlot 
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

    // ✅ Всего 3 слота на систему
    const utilizationRate = systems.length > 0 
      ? Math.round((totalUsedSlots / (systems.length * 3)) * 100)
      : 0;

    return {
      totalSystems,
      activeSystems,
      expiredSystems,
      totalUsedSlots,
      totalAvailableSlots,
      ps4Systems,
      ps5Systems,
      utilizationRate: utilizationRate.toString()
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

      console.log(`🔍 Найдено ${availableClients.length} доступных клиентов из ${clients.length}`);

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
    consoleType: 'PS4' | 'PS5';
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
        `Консоль клиента (${data.consoleType}) должна совпадать с консолью донора (${system.donor.consoleType})`
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
        `Клиент уже подключен к другой системе шеринга. Один клиент может быть подключен только к одной системе.`
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
        'Этот клиент уже имеет доступ к донорской консоли этой системы'
      );
    }

    const clientSlot = await this.prisma.clientSlot.create({
      data: {
        sharingSystemId: data.sharingSystemId,
        clientId: data.clientId,
        consoleType: data.consoleType,
        emailLogin: data.clientEmailLogin,
        emailPassword: data.clientEmailPassword,
        accountPassword: data.clientAccountPassword,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        isActive: true,
        notes: data.notes || 'Вход через QR для донорской консоли',
      },
    });

    await this.prisma.subscription.create({
      data: {
        tenant: 'TECHNOPRIME',
        clientId: data.clientId,
        type: system.donor.subscriptionType,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        status: SubscriptionStatus.ACTIVE,
        accountType: AccountType.SHARING_CLIENT,
        subscriptionPeriod: SubscriptionPeriod.MONTH,
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
          id: slot.client!.id,
          name: slot.client!.name,
          phone: slot.client!.phone,
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