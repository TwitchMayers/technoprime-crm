import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type InstructionSectionInput = {
  key?: string | null;
  title?: string | null;
  content?: string | null;
  sortOrder?: number | null;
};

@Injectable()
export class InstructionsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeText(value: unknown) {
    const text = String(value ?? '').trim();
    return text || null;
  }

  private normalizeConsoleKey(value: unknown) {
    const raw = this.normalizeText(value);
    if (!raw) return null;
    return raw
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private normalizeAliases(value: unknown) {
    if (Array.isArray(value)) {
      return Array.from(
        new Set(
          value
            .map(item =>
              String(item ?? '')
                .trim()
                .toLowerCase(),
            )
            .filter(Boolean),
        ),
      );
    }

    const text = this.normalizeText(value);
    if (!text) return [] as string[];

    return Array.from(
      new Set(
        text
          .split(/[,\n;]/g)
          .map(item => item.trim().toLowerCase())
          .filter(Boolean),
      ),
    );
  }

  private normalizeSections(value: unknown) {
    const source = Array.isArray(value) ? value : [];

    const sections = source
      .map((raw, index) => {
        const row = (raw || {}) as InstructionSectionInput;
        const title = this.normalizeText(row.title);
        const content = this.normalizeText(row.content);
        if (!title || !content) return null;

        const key = this.normalizeConsoleKey(row.key || title) || `section_${index + 1}`;

        return {
          key,
          title,
          content,
          sortOrder:
            typeof row.sortOrder === 'number' && Number.isFinite(row.sortOrder)
              ? row.sortOrder
              : index,
        };
      })
      .filter((item): item is { key: string; title: string; content: string; sortOrder: number } =>
        Boolean(item),
      )
      .sort((a, b) => a.sortOrder - b.sortOrder);

    if (!sections.length) {
      throw new BadRequestException(
        'Добавьте хотя бы один раздел инструкции с заголовком и содержанием.',
      );
    }

    return sections;
  }

  private mapInstruction(row: any) {
    const aliases = Array.isArray(row?.searchAliases) ? row.searchAliases : [];
    const sections = Array.isArray(row?.sections) ? row.sections : [];

    return {
      id: row.id,
      consoleKey: row.consoleKey,
      consoleLabel: row.consoleLabel,
      title: row.title,
      subtitle: row.subtitle || null,
      searchAliases: aliases.map((item: unknown) => String(item ?? '').trim()).filter(Boolean),
      sections: sections
        .map((item: any, index: number) => ({
          key:
            this.normalizeConsoleKey(item?.key || item?.title || `section_${index + 1}`) ||
            `section_${index + 1}`,
          title: this.normalizeText(item?.title) || `Раздел ${index + 1}`,
          content: this.normalizeText(item?.content) || '',
          sortOrder:
            typeof item?.sortOrder === 'number' && Number.isFinite(item.sortOrder)
              ? item.sortOrder
              : index,
        }))
        .sort(
          (left: { sortOrder: number }, right: { sortOrder: number }) =>
            left.sortOrder - right.sortOrder,
        ),
      isPublished: Boolean(row.isPublished),
      sortOrder: Number(row.sortOrder || 0),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdById: row.createdById || null,
      updatedById: row.updatedById || null,
    };
  }

  async list() {
    const rows = await this.prisma.consoleInstruction.findMany({
      where: { tenant: 'TECHNOPRIME' },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
    });
    return rows.map(row => this.mapInstruction(row));
  }

  async create(body: any, actorId?: number | null) {
    const consoleKey = this.normalizeConsoleKey(body?.consoleKey);
    const consoleLabel = this.normalizeText(body?.consoleLabel);
    const title = this.normalizeText(body?.title);

    if (!consoleKey) {
      throw new BadRequestException('Укажите ключ платформы (consoleKey).');
    }
    if (!consoleLabel) {
      throw new BadRequestException('Укажите название платформы (consoleLabel).');
    }
    if (!title) {
      throw new BadRequestException('Укажите заголовок инструкции.');
    }

    const created = await this.prisma.consoleInstruction.create({
      data: {
        tenant: 'TECHNOPRIME',
        consoleKey,
        consoleLabel,
        title,
        subtitle: this.normalizeText(body?.subtitle),
        searchAliases: this.normalizeAliases(body?.searchAliases),
        sections: this.normalizeSections(body?.sections),
        isPublished: body?.isPublished !== undefined ? Boolean(body.isPublished) : true,
        sortOrder: Number(body?.sortOrder || 0),
        createdById: actorId || null,
        updatedById: actorId || null,
      },
    });

    return {
      success: true,
      instruction: this.mapInstruction(created),
    };
  }

  async update(id: number, body: any, actorId?: number | null) {
    if (!id || Number.isNaN(id)) {
      throw new BadRequestException('Некорректный id инструкции.');
    }

    const existing = await this.prisma.consoleInstruction.findFirst({
      where: { id, tenant: 'TECHNOPRIME' },
      select: { id: true, consoleKey: true },
    });
    if (!existing) {
      throw new NotFoundException('Инструкция не найдена.');
    }

    const data: any = {
      updatedById: actorId || null,
    };

    if (body?.consoleKey !== undefined) {
      const consoleKey = this.normalizeConsoleKey(body.consoleKey);
      if (!consoleKey) {
        throw new BadRequestException('Некорректный consoleKey.');
      }
      data.consoleKey = consoleKey;
    }

    if (body?.consoleLabel !== undefined) {
      const label = this.normalizeText(body.consoleLabel);
      if (!label) {
        throw new BadRequestException('consoleLabel не может быть пустым.');
      }
      data.consoleLabel = label;
    }

    if (body?.title !== undefined) {
      const title = this.normalizeText(body.title);
      if (!title) {
        throw new BadRequestException('title не может быть пустым.');
      }
      data.title = title;
    }

    if (body?.subtitle !== undefined) {
      data.subtitle = this.normalizeText(body.subtitle);
    }

    if (body?.searchAliases !== undefined) {
      data.searchAliases = this.normalizeAliases(body.searchAliases);
    }

    if (body?.sections !== undefined) {
      data.sections = this.normalizeSections(body.sections);
    }

    if (body?.isPublished !== undefined) {
      data.isPublished = Boolean(body.isPublished);
    }

    if (body?.sortOrder !== undefined) {
      data.sortOrder = Number(body.sortOrder || 0);
    }

    const updated = await this.prisma.consoleInstruction.update({
      where: { id },
      data,
    });

    return {
      success: true,
      instruction: this.mapInstruction(updated),
    };
  }

  async remove(id: number) {
    if (!id || Number.isNaN(id)) {
      throw new BadRequestException('Некорректный id инструкции.');
    }

    const existing = await this.prisma.consoleInstruction.findFirst({
      where: { id, tenant: 'TECHNOPRIME' },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Инструкция не найдена.');
    }

    await this.prisma.consoleInstruction.delete({ where: { id } });
    return { success: true };
  }
}
