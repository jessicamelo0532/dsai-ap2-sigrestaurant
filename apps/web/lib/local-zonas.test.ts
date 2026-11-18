// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { localRequest, STORAGE_KEY } from './local-store';
import type { Table } from './types';
import type { Zone } from './zonas';

// SPEC/2026-11-17-zonas-do-salao.md (T-05): rotas de zonas no modo navegador.
const json = (method: string, body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const zones = () => localRequest<(Zone & { tableCount: number })[]>('/zones');
const tables = () => localRequest<Table[]>('/tables');

beforeEach(() => { window.localStorage.clear(); });

describe('dados novos e antigos (RF-06, CA-06)', () => {
  it('primeiro acesso já tem a zona padrão com as 5 mesas', async () => {
    expect((await zones()).map((zone) => [zone.name, zone.tableCount])).toEqual([['Salão', 5]]);
    expect((await tables()).every((table) => table.zoneId === 1)).toBe(true);
  });

  it('converte dados salvos antes das zonas sem perder mesas nem comandas', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      tables: [{ id: 7, number: 7, capacity: 2 }, { id: 9, number: 9, capacity: 4 }],
      menu: [], expenses: [],
      orders: [{ id: 1, tableId: 7, tableNumber: 7, status: 'OPEN', openedAt: '2026-11-17T12:00:00.000Z', items: [] }],
    }));

    const list = await tables();
    expect(list.map((table) => [table.number, table.zoneId])).toEqual([[7, 1], [9, 1]]);
    expect(list[0].order?.id).toBe(1);
    expect((await zones()).map((zone) => zone.name)).toEqual(['Salão']);
  });
});

describe('cadastro de zonas (RF-01, RF-02, RN-01 a RN-03, RN-06)', () => {
  it('cria no fim da ordem e recusa nome repetido ou curto', async () => {
    const varanda = await localRequest<Zone>('/zones', json('POST', { name: '  Varanda ' }));
    expect(varanda).toEqual({ id: 2, name: 'Varanda', sortOrder: 2 });

    await expect(localRequest('/zones', json('POST', { name: 'VARANDA' }))).rejects.toThrow('Já existe uma zona chamada Varanda.');
    await expect(localRequest('/zones', json('POST', { name: 'V' }))).rejects.toThrow('Informe o nome da zona, de 2 a 40 caracteres.');
  });

  it('renomeia e recusa o nome de outra zona', async () => {
    await localRequest('/zones', json('POST', { name: 'Varanda' }));

    expect((await localRequest<Zone>('/zones/2', json('PATCH', { name: 'Varanda coberta' }))).name).toBe('Varanda coberta');
    await expect(localRequest('/zones/2', json('PATCH', { name: 'salão' }))).rejects.toThrow('Já existe uma zona chamada Salão.');
    await expect(localRequest('/zones/99', json('PATCH', { name: 'Outra' }))).rejects.toThrow('Zona não encontrada.');
  });

  it('exclui zona vazia e recusa zona com mesas e a última', async () => {
    await localRequest('/zones', json('POST', { name: 'Varanda' }));

    await expect(localRequest('/zones/1', json('DELETE'))).rejects.toThrow('Mova as mesas desta zona antes de excluí-la.');
    expect(await localRequest('/zones/2', json('DELETE'))).toEqual({ success: true });
    for (const table of await tables()) await localRequest(`/tables/${table.id}`, json('DELETE'));
    await expect(localRequest('/zones/1', json('DELETE'))).rejects.toThrow('O salão precisa de pelo menos uma zona.');
  });
});

describe('mesas nas zonas (RF-03, RF-04, RN-05)', () => {
  it('mesa nova entra na primeira zona ou na escolhida', async () => {
    await localRequest('/zones', json('POST', { name: 'Varanda' }));

    expect((await localRequest<Table>('/tables', json('POST', { number: 20 }))).zoneId).toBe(1);
    expect((await localRequest<Table>('/tables', json('POST', { number: 21, zoneId: 2 }))).zoneId).toBe(2);
    await expect(localRequest('/tables', json('POST', { number: 22, zoneId: 99 }))).rejects.toThrow('Zona não encontrada.');
  });

  it('move a mesa e atualiza a contagem', async () => {
    await localRequest('/zones', json('POST', { name: 'Varanda' }));

    expect((await localRequest<Table>('/tables/3', json('PATCH', { zoneId: 2 }))).zoneId).toBe(2);
    expect((await zones()).map((zone) => zone.tableCount)).toEqual([4, 1]);
    await expect(localRequest('/tables/3', json('PATCH', { zoneId: 99 }))).rejects.toThrow('Zona não encontrada.');
    await expect(localRequest('/tables/99', json('PATCH', { zoneId: 1 }))).rejects.toThrow('Mesa não encontrada.');
  });
});
