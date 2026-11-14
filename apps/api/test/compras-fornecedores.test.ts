import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { CreatePurchaseDto, CreateSupplierDto, PayPurchaseDto } from '../src/purchasing/purchasing.dto';
import { parsePurchaseFilters } from '../src/purchasing/purchasing.controller';
import { prisma, resetDatabase } from './support/database';
import { buy, purchasing, purchasingController, supplierNamed } from './support/purchasing';
import { ingredientWith } from './support/stock';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('RF-01 e RN-01: cadastro de fornecedores', () => {
  it('cria com documento só em dígitos e campos de texto limpos', async () => {
    const supplier = await purchasingController.createSupplier({
      name: '  Peixaria do Mercado  ',
      document: '11.222.333/0001-81',
      phone: ' (91) 3222-1111 ',
      email: ' compras@peixaria.com.br ',
      notes: '',
    });

    expect(supplier).toMatchObject({
      name: 'Peixaria do Mercado',
      document: '11222333000181',
      phone: '(91) 3222-1111',
      email: 'compras@peixaria.com.br',
      notes: null,
      active: true,
    });
  });

  it('recusa nome repetido sem diferenciar maiúsculas e documento inválido', async () => {
    await supplierNamed('Açaí do Porto');

    await expect(purchasing.createSupplier({ name: 'AÇAÍ DO PORTO' })).rejects.toThrow(
      'Já existe um fornecedor chamado Açaí do Porto.',
    );
    await expect(purchasing.createSupplier({ name: 'Outro', document: '111.111.111-11' })).rejects.toThrow(
      'CPF ou CNPJ inválido.',
    );
    expect(await prisma.supplier.count()).toBe(1);
  });

  it('lista só ativos por padrão e todos quando pedido, em ordem alfabética', async () => {
    const hortifruti = await supplierNamed('Hortifruti Guamá');
    await supplierNamed('Açaí do Porto');
    await purchasingController.updateSupplier(hortifruti.id, { active: false });

    const active = await purchasingController.suppliers();
    const all = await purchasingController.suppliers('true');

    expect(active.map((supplier) => supplier.name)).toEqual(['Açaí do Porto']);
    expect(all.map((supplier) => supplier.name)).toEqual(['Açaí do Porto', 'Hortifruti Guamá']);
  });

  it('edita dados, permite manter o próprio nome e limpa documento enviado vazio', async () => {
    const supplier = await purchasing.createSupplier({ name: 'Mercearia', document: '529.982.247-25' });
    await supplierNamed('Atacadão');

    const updated = await purchasing.updateSupplier(supplier.id, { name: 'Mercearia', document: '', phone: '91 99999-0000' });

    expect(updated).toMatchObject({ name: 'Mercearia', document: null, phone: '91 99999-0000' });
    await expect(purchasing.updateSupplier(supplier.id, { name: 'atacadão' })).rejects.toThrow(
      'Já existe um fornecedor chamado Atacadão.',
    );
  });

  it('RN-03: remove fornecedor sem compras; com compras, pede para desativar', async () => {
    const empty = await supplierNamed('Sem compras');
    const busy = await supplierNamed('Com compras');
    const fish = await ingredientWith('Filhote');
    await buy(busy.id, [{ ingredientId: fish.id, quantity: 1, unitCost: 30 }]);

    await expect(purchasingController.deleteSupplier(empty.id)).resolves.toEqual({ success: true });
    await expect(purchasing.deleteSupplier(busy.id)).rejects.toThrow(
      'O fornecedor tem compras registradas. Desative em vez de excluir.',
    );
  });

  it('avisa quando o fornecedor não existe', async () => {
    await expect(purchasingController.supplier(404)).rejects.toThrow('Fornecedor não encontrado.');
    await expect(purchasing.updateSupplier(404, { active: false })).rejects.toBeInstanceOf(NotFoundException);
    await expect(purchasing.deleteSupplier(404)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('filtros da lista de compras', () => {
  it('lê fornecedor e situação da URL', () => {
    expect(parsePurchaseFilters()).toEqual({});
    expect(parsePurchaseFilters('3', 'PAID')).toEqual({ supplierId: 3, status: 'PAID' });
    expect(parsePurchaseFilters('', '')).toEqual({});
  });

  it('recusa fornecedor e situação inválidos', () => {
    expect(() => parsePurchaseFilters('abc')).toThrow('Fornecedor inválido.');
    expect(() => parsePurchaseFilters('0')).toThrow('Fornecedor inválido.');
    expect(() => parsePurchaseFilters(undefined, 'PAGA')).toThrow('Situação inválida. Use OPEN, PAID, CANCELLED.');
  });
});

describe('validação dos dados de entrada', () => {
  async function invalidFields<T extends object>(dto: new () => T, body: Record<string, unknown>) {
    const errors = await validate(plainToInstance(dto, body), { whitelist: true, forbidNonWhitelisted: true });
    return errors.map((error) => error.property).sort();
  }
  const item = { ingredientId: 1, quantity: 2.5, unitCost: 18.9 };

  it('fornecedor: nome de 2 a 100 caracteres e e-mail válido', async () => {
    expect(await invalidFields(CreateSupplierDto, { name: 'Peixaria' })).toEqual([]);
    expect(await invalidFields(CreateSupplierDto, { name: 'P' })).toEqual(['name']);
    const errors = await validate(plainToInstance(CreateSupplierDto, { name: 'Peixaria', email: 'sem-arroba' }));
    expect(errors[0].constraints).toEqual({ isEmail: 'E-mail inválido.' });
  });

  it('compra: de 1 a 50 itens, quantidade com até 3 casas e custo com até 2', async () => {
    const base = { supplierId: 1, dueDate: '2026-11-20' };
    expect(await invalidFields(CreatePurchaseDto, { ...base, items: [item] })).toEqual([]);
    expect(await invalidFields(CreatePurchaseDto, { ...base, items: [] })).toEqual(['items']);
    expect(await invalidFields(CreatePurchaseDto, { ...base, items: Array(51).fill(item) })).toEqual(['items']);
    expect(await invalidFields(CreatePurchaseDto, { ...base, items: [{ ...item, unitCost: 1.005 }] })).toEqual(['items']);
    expect(await invalidFields(CreatePurchaseDto, { ...base, items: [{ ...item, quantity: 0.0001 }] })).toEqual(['items']);
    expect(await invalidFields(CreatePurchaseDto, { items: [item] })).toEqual(['dueDate', 'supplierId']);
  });

  it('pagamento: só Pix, dinheiro, crédito ou débito', async () => {
    expect(await invalidFields(PayPurchaseDto, { paymentMethod: 'PIX', paidAt: '2026-11-13' })).toEqual([]);
    expect(await invalidFields(PayPurchaseDto, { paymentMethod: 'BOLETO' })).toEqual(['paymentMethod']);
  });
});
