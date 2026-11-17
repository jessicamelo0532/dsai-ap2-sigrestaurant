import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { toCents } from './common/order-total';
import { AddOrderItemDto } from './dto';
import { isOpenAt, unavailableMessage } from './menu-availability/availability-rules';
import { optionsInclude, storedOptions } from './menu-options/menu-options.service';
import { buildLine } from './menu-options/option-rules';
import { centsToDecimal } from './purchasing/purchase-rules';

// Valida o item e monta a linha da comanda, para a mesa e para o delivery (SPEC/2026-11-16-delivery.md, RF-02).
// Disponibilidade por horário: SPEC/2026-11-16-cardapio-por-horario.md (RF-04, RN-08).
// Variação, adicionais e cópia do preço: SPEC/2026-11-16-variacoes-e-adicionais.md (RF-03, RN-04 a RN-07).
export async function prepareOrderLine(tx: Pick<Prisma.TransactionClient, 'menuItem'>, dto: AddOrderItemDto, now: Date) {
  const item = await tx.menuItem.findFirst({
    where: { id: dto.menuItemId, available: true },
    include: { availability: true, ...optionsInclude },
  });
  if (!item) throw new BadRequestException('Este item não está disponível no cardápio.');
  if (!isOpenAt(item.availability, now)) throw new BadRequestException(unavailableMessage(item.availability, now));
  const line = buildLine({ name: item.name, priceCents: toCents(item.price) }, storedOptions(item.variants), storedOptions(item.addons), dto);
  return {
    menuItemId: item.id,
    nameSnapshot: line.nameSnapshot,
    variantName: line.variantName,
    unitPrice: centsToDecimal(line.unitPriceCents),
    quantity: dto.quantity,
    addons: { create: line.addons.map((addon) => ({ nameSnapshot: addon.name, price: centsToDecimal(addon.priceCents) })) },
  };
}
