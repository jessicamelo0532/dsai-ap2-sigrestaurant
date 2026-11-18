import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { CreateTableDto } from '../src/dto';
import { ZonesController } from '../src/zones/zones.controller';
import { MoveTableDto } from '../src/zones/zones.dto';
import { ZonesService } from '../src/zones/zones.service';
import { createTable, prisma, resetDatabase, service } from './support/database';

// SPEC/2026-11-17-zonas-do-salao.md (T-02)
const zones = new ZonesService(prisma);
const zonesController = new ZonesController(zones);

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('RF-03 e RN-04: zona da mesa nova', () => {
  it('sem zona nenhuma, a primeira mesa cria a zona padrão e entra nela', async () => {
    const table = await createTable(1);

    const [zone] = await zones.list();
    expect(zone).toMatchObject({ name: 'Salão', sortOrder: 1, tableCount: 1 });
    expect(table.zoneId).toBe(zone.id);
  });

  it('sem zoneId, entra na primeira zona da ordem; com zoneId, na zona escolhida', async () => {
    await createTable(1);
    const varanda = await zonesController.create({ name: 'Varanda' });

    const semZona = await service.createTable({ number: 2, capacity: 4 });
    const naVaranda = await service.createTable({ number: 3, capacity: 4, zoneId: varanda.id });

    const [salao] = await zones.list();
    expect(semZona.zoneId).toBe(salao.id);
    expect(naVaranda.zoneId).toBe(varanda.id);
  });

  it('RN-05: recusa zona inexistente ao criar mesa', async () => {
    await expect(service.createTable({ number: 1, capacity: 4, zoneId: 999 })).rejects.toThrow('Zona não encontrada.');
  });

  it('RF-05: a lista de mesas traz o zoneId', async () => {
    const table = await createTable(7);

    const [listed] = await service.listTables();
    expect(listed).toMatchObject({ id: table.id, zoneId: table.zoneId, order: null });
  });
});

describe('RF-01, RF-02, RN-01, RN-02 e RN-06: cadastro de zonas', () => {
  it('cria no fim da ordem e lista com a contagem de mesas', async () => {
    await createTable(1);
    await zonesController.create({ name: '  Varanda  ' });
    await zonesController.create({ name: 'Área externa' });

    const list = await zonesController.list();
    expect(list.map((zone) => [zone.name, zone.sortOrder, zone.tableCount])).toEqual([
      ['Salão', 1, 1], ['Varanda', 2, 0], ['Área externa', 3, 0],
    ]);
  });

  it('recusa nome repetido sem diferenciar maiúsculas e nome curto', async () => {
    await zonesController.create({ name: 'Varanda' });

    await expect(zonesController.create({ name: 'VARANDA' })).rejects.toThrow('Já existe uma zona chamada Varanda.');
    await expect(zonesController.create({ name: 'V' })).rejects.toThrow('Informe o nome da zona, de 2 a 40 caracteres.');
  });

  it('renomeia mantendo o próprio nome e recusa o nome de outra zona', async () => {
    const varanda = await zonesController.create({ name: 'Varanda' });
    await zonesController.create({ name: 'Terraço' });

    expect((await zonesController.rename(varanda.id, { name: 'varanda' })).name).toBe('varanda');
    expect((await zonesController.rename(varanda.id, { name: 'Varanda coberta' })).name).toBe('Varanda coberta');
    await expect(zonesController.rename(varanda.id, { name: 'terraço' })).rejects.toThrow('Já existe uma zona chamada Terraço.');
    await expect(zonesController.rename(999, { name: 'Outra' })).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('RF-04 e RN-05: mover mesa', () => {
  it('muda a zona da mesa e a contagem', async () => {
    const table = await createTable(4);
    const varanda = await zonesController.create({ name: 'Varanda' });

    const moved = await zonesController.moveTable(table.id, { zoneId: varanda.id });

    expect(moved.zoneId).toBe(varanda.id);
    expect((await zones.list()).map((zone) => zone.tableCount)).toEqual([0, 1]);
  });

  it('recusa zona ou mesa inexistente', async () => {
    const table = await createTable(4);

    await expect(zones.moveTable(table.id, { zoneId: 999 })).rejects.toThrow('Zona não encontrada.');
    await expect(zones.moveTable(999, { zoneId: table.zoneId })).rejects.toThrow('Mesa não encontrada.');
  });
});

describe('RN-03: excluir zona', () => {
  it('exclui zona vazia havendo outra', async () => {
    await createTable(1);
    const varanda = await zonesController.create({ name: 'Varanda' });

    expect(await zonesController.remove(varanda.id)).toEqual({ success: true });
    expect((await zones.list()).map((zone) => zone.name)).toEqual(['Salão']);
  });

  it('recusa zona com mesas, a última zona e zona inexistente', async () => {
    const table = await createTable(1);
    const varanda = await zonesController.create({ name: 'Varanda' });

    await expect(zones.remove(table.zoneId)).rejects.toThrow('Mova as mesas desta zona antes de excluí-la.');
    await zones.moveTable(table.id, { zoneId: varanda.id });
    await zones.remove(table.zoneId);
    await expect(zones.remove(varanda.id)).rejects.toThrow('Mova as mesas desta zona antes de excluí-la.');
    await prisma.diningTable.delete({ where: { id: table.id } });
    await expect(zones.remove(varanda.id)).rejects.toThrow('O salão precisa de pelo menos uma zona.');
    await expect(zones.remove(999)).rejects.toThrow('Zona não encontrada.');
  });
});

describe('validação de entrada', () => {
  it('zoneId opcional na mesa e obrigatório ao mover', async () => {
    const fields = async (cls: new () => object, data: object) =>
      (await validate(plainToInstance(cls, data))).map((error) => error.property).sort();

    expect(await fields(CreateTableDto, { number: 1 })).toEqual([]);
    expect(await fields(CreateTableDto, { number: 1, zoneId: 0 })).toEqual(['zoneId']);
    expect(await fields(MoveTableDto, { zoneId: '2' })).toEqual([]);
    expect(await fields(MoveTableDto, {})).toEqual(['zoneId']);
  });
});
