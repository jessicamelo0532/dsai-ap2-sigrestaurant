import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { CreatePurchaseDto, CreateSupplierDto, PayPurchaseDto, UpdateSupplierDto } from './purchasing.dto';
import { PurchaseStatus } from './purchase-rules';
import { PurchasingService } from './purchasing.service';

const STATUSES: PurchaseStatus[] = ['OPEN', 'PAID', 'CANCELLED'];

export function parsePurchaseFilters(supplierId?: string, status?: string) {
  const filters: { supplierId?: number; status?: PurchaseStatus } = {};
  if (supplierId !== undefined && supplierId !== '') {
    const id = Number(supplierId);
    if (!Number.isInteger(id) || id < 1) throw new BadRequestException('Fornecedor inválido.');
    filters.supplierId = id;
  }
  if (status !== undefined && status !== '') {
    if (!STATUSES.includes(status as PurchaseStatus)) {
      throw new BadRequestException(`Situação inválida. Use ${STATUSES.join(', ')}.`);
    }
    filters.status = status as PurchaseStatus;
  }
  return filters;
}

// Rotas de fornecedores, compras e contas a pagar
// (SPEC/2026-11-13-fornecedores-e-contas-a-pagar.md, RF-01 a RF-07).
@Controller('api')
export class PurchasingController {
  constructor(private readonly purchasing: PurchasingService) {}

  @Get('suppliers') suppliers(@Query('all') all?: string) {
    return this.purchasing.listSuppliers(all === 'true');
  }

  @Get('suppliers/:id') supplier(@Param('id', ParseIntPipe) id: number) {
    return this.purchasing.getSupplier(id);
  }

  @Post('suppliers') createSupplier(@Body() dto: CreateSupplierDto) {
    return this.purchasing.createSupplier(dto);
  }

  @Patch('suppliers/:id') updateSupplier(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSupplierDto) {
    return this.purchasing.updateSupplier(id, dto);
  }

  @Delete('suppliers/:id') deleteSupplier(@Param('id', ParseIntPipe) id: number) {
    return this.purchasing.deleteSupplier(id);
  }

  @Get('purchases') purchases(@Query('supplierId') supplierId?: string, @Query('status') status?: string) {
    return this.purchasing.listPurchases(parsePurchaseFilters(supplierId, status));
  }

  @Get('purchases/:id') purchase(@Param('id', ParseIntPipe) id: number) {
    return this.purchasing.getPurchase(id);
  }

  @Post('purchases') createPurchase(@Body() dto: CreatePurchaseDto) {
    return this.purchasing.createPurchase(dto);
  }

  @Post('purchases/:id/pay') pay(@Param('id', ParseIntPipe) id: number, @Body() dto: PayPurchaseDto) {
    return this.purchasing.payPurchase(id, dto);
  }

  @Post('purchases/:id/cancel') cancel(@Param('id', ParseIntPipe) id: number) {
    return this.purchasing.cancelPurchase(id);
  }

  @Get('payables') payables() {
    return this.purchasing.payables();
  }
}
