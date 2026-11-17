// Regras puras de variações e adicionais (SPEC/2026-11-16-variacoes-e-adicionais.md).
import { BadRequestException } from '@nestjs/common';
import { nameKey } from '../customers/customer-rules';

export const MAX_VARIANTS = 20;
export const MAX_ADDONS = 30;
export const MAX_ADDONS_PER_LINE = 10;

export interface OptionInput {
  name: string;
  priceCents: number;
}
export interface StoredOption extends OptionInput {
  id: number;
}

// RN-02: preço com até 2 casas; variação maior que zero, adicional zero ou mais (P-2).
export function optionPriceCents(value: unknown, allowZero: boolean, name: string): number {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
  const cents = Math.round(number * 100);
  const valid = Number.isFinite(number) && Math.abs(number * 100 - cents) < 1e-6 && (allowZero ? cents >= 0 : cents > 0);
  if (!valid || cents > 10_000_000) throw new BadRequestException(`Informe um preço válido para ${name}.`);
  return cents;
}

// RN-01 e RN-02 para uma lista.
function parseList(raw: unknown, allowZero: boolean): OptionInput[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new BadRequestException('Informe as opções em listas.');
  const seen = new Set<string>();
  return raw.map((entry) => {
    const { name: rawName, price } = (entry ?? {}) as { name?: unknown; price?: unknown };
    const name = typeof rawName === 'string' ? rawName.trim().replace(/\s+/g, ' ') : '';
    if (name.length < 1 || name.length > 60) throw new BadRequestException('Informe o nome de cada opção, de 1 a 60 caracteres.');
    const key = nameKey(name);
    if (seen.has(key)) throw new BadRequestException(`A opção ${name} está repetida.`);
    seen.add(key);
    return { name, priceCents: optionPriceCents(price, allowZero, name) };
  });
}

// RF-01 e RN-01 a RN-03
export function parseOptions(input: { variants?: unknown; addons?: unknown }) {
  const variants = parseList(input.variants, false);
  const addons = parseList(input.addons, true);
  if (variants.length > MAX_VARIANTS || addons.length > MAX_ADDONS) {
    throw new BadRequestException(`Cadastre no máximo ${MAX_VARIANTS} variações e ${MAX_ADDONS} adicionais por item.`);
  }
  return { variants, addons };
}

export interface LineChoice {
  variantId?: number | null;
  addonIds?: readonly number[] | null;
}

// RF-03, RN-04 a RN-07: monta a linha da comanda com cópia de nomes e preços.
export function buildLine(
  item: { name: string; priceCents: number },
  variants: readonly StoredOption[],
  addons: readonly StoredOption[],
  choice: LineChoice,
) {
  let variant: StoredOption | undefined;
  if (choice.variantId !== undefined && choice.variantId !== null) {
    variant = variants.find((option) => option.id === choice.variantId);
    if (!variant) throw new BadRequestException('Variação não encontrada para este item.');
  } else if (variants.length) {
    throw new BadRequestException(`Escolha a variação de ${item.name}: ${variants.map((option) => option.name).join(', ')}.`);
  }
  const ids = choice.addonIds ?? [];
  if (ids.length > MAX_ADDONS_PER_LINE) throw new BadRequestException(`Escolha no máximo ${MAX_ADDONS_PER_LINE} adicionais por item.`);
  const chosen: StoredOption[] = [];
  for (const id of ids) {
    const addon = addons.find((option) => option.id === id);
    if (!addon) throw new BadRequestException('Adicional não encontrado para este item.');
    if (chosen.includes(addon)) throw new BadRequestException(`O adicional ${addon.name} foi escolhido duas vezes.`);
    chosen.push(addon);
  }
  const base = variant ? variant.priceCents : item.priceCents;
  return {
    nameSnapshot: variant ? `${item.name} (${variant.name})` : item.name,
    variantName: variant?.name ?? null,
    unitPriceCents: base + chosen.reduce((sum, addon) => sum + addon.priceCents, 0),
    addons: chosen.map(({ name, priceCents }) => ({ name, priceCents })),
  };
}
