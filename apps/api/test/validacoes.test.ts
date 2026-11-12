import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  AddOrderItemDto,
  CloseOrderDto,
  CreateExpenseDto,
  CreateMenuItemDto,
  CreateTableDto,
  UpdateMenuItemDto,
  UpdateOrderItemDto,
} from '../src/dto';

// Converte o corpo da requisição como o ValidationPipe faz e devolve os campos com erro.
async function invalidFields<T extends object>(dto: new () => T, body: Record<string, unknown>) {
  const errors = await validate(plainToInstance(dto, body), { whitelist: true, forbidNonWhitelisted: true });
  return errors.map((error) => error.property).sort();
}

describe('validação dos dados de entrada (DTOs)', () => {
  it('mesa: número entre 1 e 9999, capacidade entre 1 e 100 e padrão 4', async () => {
    expect(await invalidFields(CreateTableDto, { number: '12' })).toEqual([]);
    expect(plainToInstance(CreateTableDto, { number: 12 }).capacity).toBe(4);
    expect(await invalidFields(CreateTableDto, { number: 0 })).toEqual(['number']);
    expect(await invalidFields(CreateTableDto, { number: 10000, capacity: 101 })).toEqual(['capacity', 'number']);
    expect(await invalidFields(CreateTableDto, { number: 1.5 })).toEqual(['number']);
  });

  it('cardápio: nome obrigatório, preço positivo com até duas casas', async () => {
    expect(await invalidFields(CreateMenuItemDto, { name: 'Tacacá', price: '18.50' })).toEqual([]);
    expect(await invalidFields(CreateMenuItemDto, { name: '', price: 10 })).toEqual(['name']);
    expect(await invalidFields(CreateMenuItemDto, { name: 'Tacacá', price: 0 })).toEqual(['price']);
    expect(await invalidFields(CreateMenuItemDto, { name: 'Tacacá', price: 10.555 })).toEqual(['price']);
    expect(await invalidFields(CreateMenuItemDto, { name: 'x'.repeat(101), price: 10 })).toEqual(['name']);
  });

  it('cardápio: edição aceita corpo parcial, mas recusa campo desconhecido', async () => {
    expect(await invalidFields(UpdateMenuItemDto, { available: false })).toEqual([]);
    expect(await invalidFields(UpdateMenuItemDto, { estoque: 3 })).toEqual(['estoque']);
  });

  it('comanda: quantidade entre 1 e 500', async () => {
    expect(await invalidFields(AddOrderItemDto, { menuItemId: 1, quantity: 500 })).toEqual([]);
    expect(await invalidFields(AddOrderItemDto, { menuItemId: 1, quantity: 501 })).toEqual(['quantity']);
    expect(await invalidFields(UpdateOrderItemDto, { quantity: 0 })).toEqual(['quantity']);
  });

  it('pagamento: só Pix, dinheiro, crédito ou débito', async () => {
    for (const paymentMethod of ['PIX', 'CASH', 'CREDIT', 'DEBIT']) {
      expect(await invalidFields(CloseOrderDto, { paymentMethod })).toEqual([]);
    }
    expect(await invalidFields(CloseOrderDto, { paymentMethod: 'BOLETO' })).toEqual(['paymentMethod']);
  });

  it('despesa: descrição até 160 caracteres e valor positivo', async () => {
    expect(await invalidFields(CreateExpenseDto, { description: 'Gás', amount: 120 })).toEqual([]);
    expect(await invalidFields(CreateExpenseDto, { description: 'x'.repeat(161), amount: 1 })).toEqual([
      'description',
    ]);
    expect(await invalidFields(CreateExpenseDto, { description: 'Gás', amount: -5 })).toEqual(['amount']);
  });
});
