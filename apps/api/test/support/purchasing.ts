import { CreatePurchaseDto } from '../../src/purchasing/purchasing.dto';
import { PurchasingController } from '../../src/purchasing/purchasing.controller';
import { PurchasingService } from '../../src/purchasing/purchasing.service';
import { prisma } from './database';

// Relógio controlado: "hoje" é 13/11/2026.
export const purchasingClock = { now: new Date('2026-11-13T15:00:00.000Z') };
export const purchasing = new PurchasingService(prisma, () => purchasingClock.now);
export const purchasingController = new PurchasingController(purchasing);

export function supplierNamed(name = 'Distribuidora Ver-o-Peso') {
  return purchasing.createSupplier({ name });
}

export function buy(
  supplierId: number,
  items: { ingredientId: number; quantity: number; unitCost: number }[],
  overrides: Partial<CreatePurchaseDto> = {},
) {
  return purchasing.createPurchase({ supplierId, dueDate: '2026-11-20', items, ...overrides });
}
