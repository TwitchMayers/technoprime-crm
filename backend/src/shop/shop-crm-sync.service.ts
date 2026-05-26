import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type UpsertCrmClientInput = {
  phone: string;
  name?: string | null;
  city?: string | null;
  address?: string | null;
  telegramUsername?: string | null;
  telegramId?: string | null;
  vkId?: string | null;
  maxId?: string | null;
  marketingConsent?: boolean;
};

@Injectable()
export class ShopCrmSyncService {
  constructor(private readonly prisma: PrismaService) {}

  normalizePhone(input: string) {
    const digits = String(input || '').replace(/\D/g, '');
    if (digits.length === 10) return `7${digits}`;
    if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
    return digits;
  }

  private buildPhoneAliases(input: string) {
    const normalized = this.normalizePhone(input);
    if (!normalized || normalized.length < 10) return [] as string[];
    const last10 = normalized.slice(-10);
    const aliases = new Set<string>([normalized, `+${normalized}`]);
    if (last10.length === 10) {
      aliases.add(last10);
      aliases.add(`7${last10}`);
      aliases.add(`+7${last10}`);
      aliases.add(`8${last10}`);
      aliases.add(`+8${last10}`);
    }
    return Array.from(aliases).filter(Boolean);
  }

  parsePersonName(name?: string | null) {
    const raw = String(name || '').trim();
    if (!raw) {
      return { firstName: null as string | null, lastName: null as string | null };
    }
    const parts = raw.split(/\s+/).filter(Boolean);
    return {
      firstName: parts[0] || null,
      lastName: parts.length > 1 ? parts.slice(1).join(' ') : null,
    };
  }

  formatDisplayName(
    firstName?: string | null,
    lastName?: string | null,
    fallbackPhone?: string | null,
  ) {
    const full = [String(firstName || '').trim(), String(lastName || '').trim()]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (full) return full;
    return `Клиент ${String(fallbackPhone || '').trim()}`;
  }

  private normalizeText(value?: string | null) {
    const text = String(value || '').trim();
    return text || null;
  }

  private withTelegramTag(existing?: string | null, telegramUsername?: string | null) {
    const username = this.normalizeText(telegramUsername)?.replace(/^@+/, '');
    if (!username) return existing || null;

    const tag = `telegram:@${username}`;
    const notes = String(existing || '').trim();
    if (!notes) return tag;
    if (notes.includes(tag)) return notes;
    return `${notes}\n${tag}`;
  }

  async findClientByPhone(phone: string) {
    const aliases = this.buildPhoneAliases(phone);
    if (!aliases.length) return null;

    return this.prisma.client.findFirst({
      where: {
        tenant: 'TECHNOPRIME',
        phone: { in: aliases },
      },
      orderBy: { id: 'desc' },
      select: {
        id: true,
        name: true,
        phone: true,
        city: true,
        address: true,
        notes: true,
        telegramId: true,
        vkId: true,
        maxId: true,
        marketingConsent: true,
      },
    });
  }

  async upsertClientByPhone(input: UpsertCrmClientInput) {
    const normalizedPhone = this.normalizePhone(input.phone);
    if (!normalizedPhone || normalizedPhone.length < 11) return null;

    const name = this.normalizeText(input.name);
    const city = this.normalizeText(input.city);
    const address = this.normalizeText(input.address);
    const telegramUsername = this.normalizeText(input.telegramUsername);
    const hasTelegramId = input.telegramId !== undefined;
    const hasVkId = input.vkId !== undefined;
    const telegramId = hasTelegramId ? this.normalizeText(input.telegramId) : undefined;
    const vkId = hasVkId ? this.normalizeText(input.vkId) : undefined;
    const hasMarketingConsent = input.marketingConsent !== undefined;
    const marketingConsent = hasMarketingConsent ? Boolean(input.marketingConsent) : undefined;

    const existing = await this.findClientByPhone(normalizedPhone);

    if (existing) {
      const nextName = name || this.normalizeText(existing.name) || `Клиент ${normalizedPhone}`;
      const nextNotes = this.withTelegramTag(existing.notes, telegramUsername);

      return this.prisma.client.update({
        where: { id: existing.id },
        data: {
          phone: normalizedPhone,
          name: nextName,
          city: city || existing.city || undefined,
          address: address || existing.address || undefined,
          ...(hasTelegramId ? { telegramId } : {}),
          ...(hasVkId ? { vkId } : {}),
          ...(hasMarketingConsent ? { marketingConsent } : {}),
          notes: nextNotes || undefined,
        },
        select: {
          id: true,
          name: true,
          phone: true,
          city: true,
          address: true,
          telegramId: true,
          vkId: true,
          maxId: true,
          marketingConsent: true,
        },
      });
    }

    return this.prisma.client.create({
      data: {
        tenant: 'TECHNOPRIME',
        phone: normalizedPhone,
        name: name || `Клиент ${normalizedPhone}`,
        city: city || undefined,
        address: address || undefined,
        ...(hasTelegramId ? { telegramId } : {}),
        ...(hasVkId ? { vkId } : {}),
        marketingConsent: hasMarketingConsent ? Boolean(marketingConsent) : false,
        notes: this.withTelegramTag(null, telegramUsername) || undefined,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        city: true,
        address: true,
        telegramId: true,
        vkId: true,
        maxId: true,
        marketingConsent: true,
      },
    });
  }
}
