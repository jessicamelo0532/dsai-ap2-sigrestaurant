import { describe, expect, it } from 'vitest';
import { assertTestDatabase } from './support/database-guard';

describe('trava do banco de teste', () => {
  it('aceita banco com nome terminado em _test', () => {
    const url = 'postgresql://user:senha@localhost:5432/restaurante_test?schema=public';
    expect(assertTestDatabase(url)).toBe(url);
  });

  it('recusa banco de desenvolvimento ou produção', () => {
    expect(() => assertTestDatabase('postgresql://user:senha@localhost:5432/restaurante?schema=public')).toThrow(
      'Banco "restaurante" recusado',
    );
  });

  it('recusa quando DATABASE_URL não foi definida', () => {
    expect(() => assertTestDatabase(undefined)).toThrow('Defina DATABASE_URL');
  });

  it('recusa endereço inválido', () => {
    expect(() => assertTestDatabase('isto não é uma url')).toThrow('DATABASE_URL inválida.');
  });
});
