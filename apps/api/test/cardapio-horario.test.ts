import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { OrdersService } from '../src/orders/orders.service';
import { MenuAvailabilityController } from '../src/menu-availability/menu-availability.controller';
import { SetAvailabilityDto } from '../src/menu-availability/menu-availability.dto';
import { MenuAvailabilityService } from '../src/menu-availability/menu-availability.service';
import { createMenuItem, createTable, prisma, resetDatabase } from './support/database';

// Disponibilidade do cardápio por horário (SPEC/2026-11-16-cardapio-por-horario.md).
// 16/11/2026 é segunda-feira; Belém é UTC−3 (14:00Z = 11:00 local).
const clock = { now: new Date('2026-11-16T14:00:00.000Z') };
const at = (iso: string) => { clock.now = new Date(`${iso}.000Z`); };
const app = new AppService(prisma, () => clock.now);
const orders = new OrdersService(prisma, () => clock.now);
const appController = new AppController(app, orders);
const availability = new MenuAvailabilityService(prisma, () => clock.now);
const controller = new MenuAvailabilityController(availability);

beforeEach(async () => {
  await resetDatabase();
  at('2026-11-16T14:00:00');
});
afterAll(() => prisma.$disconnect());

const lunchOnMonday = { windows: [{ weekday: 1, start: '11:00', end: '15:00' }] };

describe('T-01: fora da janela, não entra na comanda (CA-01)', () => {
  it('recusa às 16h de segunda e diz quando volta; aceita dentro da janela', async () => {
    const table = await createTable(1);
    const lunch = await createMenuItem({ name: 'Prato executivo', price: 32 });
    await controller.replace(lunch.id, lunchOnMonday);

    at('2026-11-16T19:00:00');
    await expect(orders.addOrderItem(table.id, { menuItemId: lunch.id, quantity: 1 })).rejects.toThrow(
      'Este item não está disponível neste horário. Volta segunda-feira às 11:00.',
    );
    expect(await prisma.order.count()).toBe(0);

    at('2026-11-23T13:30:00');
    await expect(orders.addOrderItem(table.id, { menuItemId: lunch.id, quantity: 1 })).rejects.toThrow(
      'Este item não está disponível neste horário. Volta hoje às 11:00.',
    );

    at('2026-11-23T14:30:00');
    const order = await appController.addItem(table.id, { menuItemId: lunch.id, quantity: 2 });
    expect(order!.items).toHaveLength(1);
  });
});

describe('T-02: item sem janela continua sempre disponível (CA-02)', () => {
  it('aparece e entra na comanda de madrugada', async () => {
    const table = await createTable(1);
    const water = await createMenuItem({ name: 'Água', price: 4 });
    at('2026-11-17T07:00:00');
    expect((await app.listMenu()).map((item) => item.id)).toEqual([water.id]);
    expect((await orders.addOrderItem(table.id, { menuItemId: water.id, quantity: 1 }))!.items).toHaveLength(1);
    expect(await controller.get(water.id)).toEqual({ menuItemId: water.id, alwaysAvailable: true, availableNow: true, windows: [] });
  });
});

describe('T-03: a lista esconde o que está fora da janela (CA-03)', () => {
  it('mostra dentro, esconde fora e mostra tudo com all=true', async () => {
    const water = await createMenuItem({ name: 'Água', category: 'Bebidas', price: 4 });
    const lunch = await createMenuItem({ name: 'Prato executivo', category: 'Pratos', price: 32 });
    const paused = await createMenuItem({ name: 'Pausado', category: 'Pratos', price: 10, available: false });
    await availability.replace(lunch.id, lunchOnMonday);

    expect((await appController.menu()).map((item) => item.id)).toEqual([water.id, lunch.id]);
    expect((await app.listMenu())[1]).not.toHaveProperty('availability');

    at('2026-11-16T18:00:00');
    expect((await app.listMenu()).map((item) => item.id)).toEqual([water.id]);
    expect((await appController.menu('true')).map((item) => item.id)).toEqual([water.id, paused.id, lunch.id]);
    expect((await availability.get(lunch.id)).availableNow).toBe(false);
  });
});

describe('T-04: limites e virada do dia (CA-04)', () => {
  it('abre no minuto do início e fecha no minuto do fim, no horário de Belém', async () => {
    const lunch = await createMenuItem({ name: 'Prato executivo', price: 32 });
    const late = await createMenuItem({ name: 'Caldo da madrugada', price: 15 });
    await availability.replace(lunch.id, lunchOnMonday);
    await availability.replace(late.id, { windows: [{ weekday: 1, start: '22:00', end: '24:00' }] });

    const visible = async () => (await app.listMenu()).map((item) => item.name);
    at('2026-11-16T13:59:00');
    expect(await visible()).toEqual([]);
    at('2026-11-16T14:00:00');
    expect(await visible()).toEqual(['Prato executivo']);
    at('2026-11-16T17:59:00');
    expect(await visible()).toEqual(['Prato executivo']);
    at('2026-11-16T18:00:00');
    expect(await visible()).toEqual([]);
    at('2026-11-17T02:00:00');
    expect(await visible()).toEqual(['Caldo da madrugada']);
    at('2026-11-17T03:00:00');
    expect(await visible()).toEqual([]);
  });

  it('item pausado não fica disponível nem dentro da janela', async () => {
    const lunch = await createMenuItem({ name: 'Prato executivo', price: 32, available: false });
    expect((await availability.replace(lunch.id, lunchOnMonday)).availableNow).toBe(false);
  });
});

describe('T-05: troca das janelas (CA-05)', () => {
  it('troca todas, devolve em ordem e volta para sempre disponível com lista vazia', async () => {
    const item = await createMenuItem({ name: 'Açaí', price: 18 });
    const saved = await controller.replace(item.id, {
      windows: [
        { weekday: 5, start: '18:00', end: '23:00' },
        { weekday: 1, start: '18:00', end: '22:00' },
      ],
    });
    expect(saved).toEqual({
      menuItemId: item.id,
      alwaysAvailable: false,
      availableNow: false,
      windows: [
        { weekday: 1, day: 'segunda-feira', start: '18:00', end: '22:00' },
        { weekday: 5, day: 'sexta-feira', start: '18:00', end: '23:00' },
      ],
    });

    const replaced = await availability.replace(item.id, { windows: [{ weekday: 1, start: '11:00', end: '12:00' }] });
    expect(replaced.windows).toEqual([{ weekday: 1, day: 'segunda-feira', start: '11:00', end: '12:00' }]);
    expect(replaced.availableNow).toBe(true);

    expect(await availability.replace(item.id, { windows: [] })).toMatchObject({ alwaysAvailable: true, windows: [] });
    expect(await prisma.menuAvailability.count()).toBe(0);
  });

  it('recusa janelas inválidas sem apagar as que existiam', async () => {
    const item = await createMenuItem({ name: 'Açaí', price: 18 });
    await availability.replace(item.id, lunchOnMonday);

    await expect(
      availability.replace(item.id, {
        windows: [
          { weekday: 2, start: '11:00', end: '15:00' },
          { weekday: 2, start: '14:00', end: '16:00' },
        ],
      }),
    ).rejects.toThrow('As janelas de terça-feira se sobrepõem.');
    await expect(availability.replace(item.id, { windows: [{ weekday: 2, start: '22:00', end: '02:00' }] })).rejects.toThrow(
      'O horário de início deve ser antes do fim.',
    );
    await expect(availability.replace(999, lunchOnMonday)).rejects.toThrow(NotFoundException);
    await expect(availability.get(999)).rejects.toThrow('Item do cardápio não encontrado.');

    expect((await availability.get(item.id)).windows).toEqual([{ weekday: 1, day: 'segunda-feira', start: '11:00', end: '15:00' }]);
  });

  it('apagar o item apaga as janelas', async () => {
    const item = await createMenuItem({ name: 'Açaí', price: 18 });
    await availability.replace(item.id, lunchOnMonday);
    await app.deleteMenuItem(item.id);
    expect(await prisma.menuAvailability.count()).toBe(0);
  });
});

describe('validação da rota', () => {
  it('confere a lista de janelas no corpo', async () => {
    expect(await validate(plainToInstance(SetAvailabilityDto, lunchOnMonday))).toEqual([]);
    expect(await validate(plainToInstance(SetAvailabilityDto, { windows: [] }))).toEqual([]);
    expect((await validate(plainToInstance(SetAvailabilityDto, {}))).map((e) => e.property)).toEqual(['windows']);
    const bad = await validate(plainToInstance(SetAvailabilityDto, { windows: [{ weekday: 9, start: 11, end: '15:00' }] }));
    expect(bad[0].children?.[0].children?.map((e) => e.property).sort()).toEqual(['start', 'weekday']);
  });
});
