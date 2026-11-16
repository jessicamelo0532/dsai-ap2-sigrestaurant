import { BadRequestException } from '@nestjs/common';

// Período de datas AAAA-MM-DD em UTC, com a data final inclusiva.
// Usado pelo relatório financeiro e pelos relatórios de vendas (SPEC/2026-11-16-relatorios-de-vendas.md, RNF-03).
export function dateRange(from?: string, to?: string) {
  const valid = (value?: string) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  if (!valid(from) || !valid(to)) throw new BadRequestException('Informe datas válidas no formato AAAA-MM-DD.');
  const start = new Date(`${from}T00:00:00.000Z`);
  const endInclusive = new Date(`${to}T00:00:00.000Z`);
  if (start > endInclusive) throw new BadRequestException('A data inicial deve ser anterior ou igual à data final.');
  endInclusive.setUTCDate(endInclusive.getUTCDate() + 1);
  return [start, endInclusive] as const;
}
