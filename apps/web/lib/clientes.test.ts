import { describe, expect, it } from 'vitest';
import {
  createBody, formatDay, formatPhone, formFrom, historyPath, listQuery, NAME_ERROR, NOTES_ERROR, PHONE_ERROR,
  phoneDigits, updateBody, validateCustomerForm, validateHistoryPeriod, visitsLabel, type Customer,
} from './clientes';

const ana: Customer = { id: 1, name: 'Ana Souza', phone: '91988887777', notes: 'Sem cebola', active: true };

describe('telefone (RN-02, RNF-01)', () => {
  it.each([
    ['(91) 98888-7777', '91988887777'], ['+55 91 98888-7777', '91988887777'], ['91 3333-4444', '9133334444'],
  ])('tira a máscara de %s', (raw, digits) => {
    expect(phoneDigits(raw)).toBe(digits);
  });

  it('formata celular e fixo', () => {
    expect(formatPhone('91988887777')).toBe('(91) 98888-7777');
    expect(formatPhone('9133334444')).toBe('(91) 3333-4444');
    expect(formatPhone('123')).toBe('123');
    expect(formatPhone(null)).toBe('');
  });
});

describe('formulário (RN-01 a RN-03)', () => {
  it('aceita nome com telefone e observação opcionais', () => {
    expect(validateCustomerForm({ name: 'Ana', phone: '', notes: '' })).toBeNull();
    expect(validateCustomerForm({ name: 'Ana', phone: '(91) 98888-7777', notes: 'VIP' })).toBeNull();
  });

  it('recusa nome curto ou longo', () => {
    expect(validateCustomerForm({ name: ' A ', phone: '', notes: '' })).toBe(NAME_ERROR);
    expect(validateCustomerForm({ name: 'a'.repeat(81), phone: '', notes: '' })).toBe(NAME_ERROR);
  });

  it('recusa telefone sem 10 ou 11 dígitos', () => {
    expect(validateCustomerForm({ name: 'Ana', phone: '98888-777', notes: '' })).toBe(PHONE_ERROR);
    expect(validateCustomerForm({ name: 'Ana', phone: '919888877776', notes: '' })).toBe(PHONE_ERROR);
  });

  it('recusa observação acima de 300 caracteres', () => {
    expect(validateCustomerForm({ name: 'Ana', phone: '', notes: 'x'.repeat(301) })).toBe(NOTES_ERROR);
  });
});

describe('corpos das requisições (RF-03, RF-04)', () => {
  it('cadastro sem campos opcionais vazios', () => {
    expect(createBody({ name: '  Ana   Souza ', phone: ' ', notes: '' })).toEqual({ name: 'Ana Souza' });
    expect(createBody({ name: 'Ana', phone: '(91) 98888-7777', notes: ' VIP ' })).toEqual({ name: 'Ana', phone: '(91) 98888-7777', notes: 'VIP' });
  });

  it('edição sem mudança envia corpo vazio', () => {
    expect(updateBody(ana, formFrom(ana))).toEqual({});
  });

  it('edição envia só o campo alterado', () => {
    expect(updateBody(ana, { ...formFrom(ana), notes: 'Sem pimenta' })).toEqual({ notes: 'Sem pimenta' });
    expect(updateBody(ana, { ...formFrom(ana), name: 'Ana  Lima' })).toEqual({ name: 'Ana Lima' });
    expect(updateBody(ana, { ...formFrom(ana), phone: '91 3333-4444' })).toEqual({ phone: '91 3333-4444' });
  });

  it('apagar telefone ou observação envia null', () => {
    expect(updateBody(ana, { ...formFrom(ana), phone: '', notes: '' })).toEqual({ phone: null, notes: null });
  });

  it('cliente sem telefone continua sem telefone', () => {
    expect(updateBody({ ...ana, phone: null, notes: null }, { name: 'Ana Souza', phone: '', notes: '' })).toEqual({});
  });

  it('preenche o formulário a partir do cliente', () => {
    expect(formFrom(ana)).toEqual({ name: 'Ana Souza', phone: '(91) 98888-7777', notes: 'Sem cebola' });
    expect(formFrom(null)).toEqual({ name: '', phone: '', notes: '' });
  });
});

describe('lista e histórico (RF-02, RF-05, RN-04)', () => {
  it('monta a busca', () => {
    expect(listQuery('', false)).toBe('/customers');
    expect(listQuery(' ana ', false)).toBe('/customers?search=ana');
    expect(listQuery('ana', true)).toBe('/customers?search=ana&all=true');
    expect(listQuery('', true)).toBe('/customers?all=true');
  });

  it('período vazio ou completo em ordem', () => {
    expect(validateHistoryPeriod({ from: '', to: '' })).toBeNull();
    expect(validateHistoryPeriod({ from: '2026-11-01', to: '2026-11-17' })).toBeNull();
    expect(validateHistoryPeriod({ from: '2026-11-01', to: '' })).toMatch(/duas datas/);
    expect(validateHistoryPeriod({ from: '2026-11-18', to: '2026-11-17' })).toMatch(/anterior/);
  });

  it('caminho do histórico com e sem período', () => {
    expect(historyPath(1, { from: '', to: '' })).toBe('/customers/1/history');
    expect(historyPath(1, { from: '2026-11-01', to: '2026-11-17' })).toBe('/customers/1/history?from=2026-11-01&to=2026-11-17');
  });

  it('rótulos', () => {
    expect(visitsLabel(0)).toBe('Nenhuma visita');
    expect(visitsLabel(1)).toBe('1 visita');
    expect(visitsLabel(4)).toBe('4 visitas');
    expect(formatDay(new Date(2026, 10, 7, 20).toISOString())).toBe('07/11/2026');
    expect(formatDay(null)).toBe('—');
  });
});
