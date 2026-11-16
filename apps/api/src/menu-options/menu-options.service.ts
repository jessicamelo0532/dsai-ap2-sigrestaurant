import { Injectable, NotFoundException } from '@nestjs/common';
import { MenuAddon, MenuVariant } from '@prisma/client';
import { toCents } from '../common/order-total';
import { PrismaService } from '../prisma.service';
import { centsToDecimal } from '../purchasing/purchase-rules';
import { SetMenuOptionsDto } from './menu-options.dto';
import { parseOptions, StoredOption } from './option-rules';

export const optionsInclude = {
  variants: { orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }] },
  addons: { orderBy: [{ name: 'asc' as const }, { id: 'asc' as const }] },
};

// Opções guardadas no banco, em centavos, para as regras.
export function storedOptions(options: readonly (MenuVariant | MenuAddon)[]): StoredOption[] {
  return options.map((option) => ({ id: option.id, name: option.name, priceCents: toCents(option.price) }));
}

const describe = (option: MenuVariant | MenuAddon) => ({ id: option.id, name: option.name, price: centsToDecimal(toCents(option.price)) });

// Variações e adicionais do item (SPEC/2026-11-16-variacoes-e-adicionais.md).
@Injectable()
export class MenuOptionsService {
  constructor(private readonly prisma: PrismaService) {}

  // RF-02
  async get(menuItemId: number) {
    const item = await this.prisma.menuItem.findUnique({ where: { id: menuItemId }, include: optionsInclude });
    if (!item) throw new NotFoundException('Item do cardápio não encontrado.');
    return { menuItemId, variants: item.variants.map(describe), addons: item.addons.map(describe) };
  }

  // RF-01 e RNF-01: troca as duas listas de uma vez.
  async replace(menuItemId: number, dto: SetMenuOptionsDto) {
    const { variants, addons } = parseOptions(dto);
    await this.prisma.$transaction(async (tx) => {
      const item = await tx.menuItem.findUnique({ where: { id: menuItemId } });
      if (!item) throw new NotFoundException('Item do cardápio não encontrado.');
      await tx.menuVariant.deleteMany({ where: { menuItemId } });
      await tx.menuAddon.deleteMany({ where: { menuItemId } });
      if (variants.length) {
        await tx.menuVariant.createMany({
          data: variants.map((option, sortOrder) => ({ menuItemId, name: option.name, price: centsToDecimal(option.priceCents), sortOrder })),
        });
      }
      if (addons.length) {
        await tx.menuAddon.createMany({
          data: addons.map((option) => ({ menuItemId, name: option.name, price: centsToDecimal(option.priceCents) })),
        });
      }
    });
    return this.get(menuItemId);
  }
}
